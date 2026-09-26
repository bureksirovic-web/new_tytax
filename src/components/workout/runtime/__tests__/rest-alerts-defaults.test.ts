import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRestAlerts, type AudioContextLike } from '@/components/workout/runtime/rest-alerts';

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

describe('createRestAlerts window defaults', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses navigator.vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    createRestAlerts().vibrate();
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
  });

  it('returns false when navigator.vibrate is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(createRestAlerts().vibrate()).toBe(false);
  });

  it('constructs window.AudioContext once', () => {
    const { ctx } = fakeAudio();
    const Ctor = vi.fn(function FakeCtx() {
      return ctx;
    });
    vi.stubGlobal('AudioContext', Ctor);
    const alerts = createRestAlerts();
    alerts.beep();
    alerts.beep();
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('falls back to webkitAudioContext, and to no sound without either', () => {
    const { ctx } = fakeAudio();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', vi.fn(function FakeCtx() {
      return ctx;
    }));
    expect(createRestAlerts().beep()).toBe(true);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(createRestAlerts().beep()).toBe(false);
  });

  it('uses speechSynthesis with an utterance (lang, rate 1.2)', () => {
    const speak = vi.fn();
    class FakeUtterance {
      lang = '';
      rate = 1;
      constructor(public text: string) {}
    }
    vi.stubGlobal('speechSynthesis', { speak });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    expect(createRestAlerts().speak('Rest complete', 'en-US')).toBe(true);
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Rest complete', lang: 'en-US', rate: 1.2 }),
    );
  });

  it('does not throw without speechSynthesis', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    expect(() => createRestAlerts().speak('x')).not.toThrow();
  });
});
