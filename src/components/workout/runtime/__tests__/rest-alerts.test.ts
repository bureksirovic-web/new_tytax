import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRestAlerts, REST_VIBRATION_PATTERN, type AudioContextLike } from '@/components/workout/runtime/rest-alerts';

function fakeAudio(state = 'running') {
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const oscs: ReturnType<typeof makeOsc>[] = [];
  const gains: { gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn> }[] = [];
  function makeOsc() {
    return { type: '', frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  }
  const ctx = {
    state,
    currentTime: 5,
    destination: { dest: true },
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const o = makeOsc();
      oscs.push(o);
      return o;
    }),
    createGain: vi.fn(() => {
      const g = { gain: param(), connect: vi.fn() };
      gains.push(g);
      return g;
    }),
  };
  return { ctx: ctx as typeof ctx & AudioContextLike, oscs, gains };
}

describe('createRestAlerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('vibrates with [200,100,200] by default', () => {
    const vibrate = vi.fn(() => true);
    const alerts = createRestAlerts({ vibrate, getAudioContext: null, speak: null });
    expect(alerts.vibrate()).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
    expect(REST_VIBRATION_PATTERN).toEqual([200, 100, 200]);
    alerts.vibrate([50]);
    expect(vibrate).toHaveBeenLastCalledWith([50]);
  });

  it('beeps a sine 880->440Hz over 0.2s with gain 0.1->0.001', () => {
    const { ctx, oscs, gains } = fakeAudio();
    const alerts = createRestAlerts({ getAudioContext: () => ctx, vibrate: null, speak: null });
    expect(alerts.beep()).toBe(true);
    const [osc] = oscs;
    const [gain] = gains;
    expect(osc.type).toBe('sine');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 5);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(440, 5.2);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.1, 5);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 5.2);
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(osc.start).toHaveBeenCalledWith(5);
    expect(osc.stop).toHaveBeenCalledWith(5.2);
  });

  it('creates ONE audio context lazily and reuses it', () => {
    const { ctx } = fakeAudio();
    const getAudioContext = vi.fn(() => ctx);
    const alerts = createRestAlerts({ getAudioContext, vibrate: null, speak: null });
    expect(getAudioContext).not.toHaveBeenCalled();
    alerts.beep();
    alerts.beep();
    alerts.unlock();
    expect(getAudioContext).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('resumes a suspended context and tolerates a rejected resume', async () => {
    const { ctx } = fakeAudio('suspended');
    ctx.resume.mockImplementation(() => Promise.reject(new Error('no gesture')));
    const alerts = createRestAlerts({ getAudioContext: () => ctx, vibrate: null, speak: null });
    expect(alerts.beep()).toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it('speaks with the given text and lang at rate 1.2', () => {
    const speak = vi.fn();
    const alerts = createRestAlerts({ speak, vibrate: null, getAudioContext: null });
    expect(alerts.speak('Odmor gotov', 'hr-HR')).toBe(true);
    expect(speak).toHaveBeenCalledWith('Odmor gotov', 'hr-HR', 1.2);
    expect(alerts.speak('')).toBe(false);
  });

  it('fire() respects per-channel toggles', () => {
    const vibrate = vi.fn(() => true);
    const speak = vi.fn();
    const { ctx } = fakeAudio();
    const alerts = createRestAlerts({ vibrate, speak, getAudioContext: () => ctx });
    expect(alerts.fire()).toEqual({ vibrate: true, sound: true, voice: false });
    expect(speak).not.toHaveBeenCalled();

    vibrate.mockClear();
    ctx.createOscillator.mockClear();
    expect(alerts.fire({ vibrate: false, sound: false, voice: { text: 'Rest complete', lang: 'en-US' } })).toEqual({
      vibrate: false,
      sound: false,
      voice: true,
    });
    expect(vibrate).not.toHaveBeenCalled();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Rest complete', 'en-US', 1.2);
  });

  it('never throws when channels fail', () => {
    const alerts = createRestAlerts({
      vibrate: () => {
        throw new Error('v');
      },
      getAudioContext: () => {
        throw new Error('a');
      },
      speak: () => {
        throw new Error('s');
      },
    });
    expect(() => alerts.fire({ vibrate: true, sound: true, voice: { text: 'x' } })).not.toThrow();
    expect(alerts.fire({ vibrate: true, sound: true, voice: { text: 'x' } })).toEqual({
      vibrate: false,
      sound: false,
      voice: false,
    });
    expect(alerts.unlock()).toBe(false);
  });

  it('reports false when channels are disabled via null', () => {
    const alerts = createRestAlerts({ vibrate: null, getAudioContext: null, speak: null });
    expect(alerts.vibrate()).toBe(false);
    expect(alerts.beep()).toBe(false);
    expect(alerts.speak('x')).toBe(false);
    expect(alerts.unlock()).toBe(false);
  });

  it('reports false when vibrate returns false (e.g. no user activation)', () => {
    const alerts = createRestAlerts({ vibrate: () => false, getAudioContext: null, speak: null });
    expect(alerts.vibrate()).toBe(false);
  });
});
