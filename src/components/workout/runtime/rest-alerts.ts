/**
 * Rest-complete alerts: vibration, a short beep and optional voice.
 * Every channel is individually switchable and never throws.
 */

export const REST_VIBRATION_PATTERN: readonly number[] = [200, 100, 200];
export const VOICE_RATE = 1.2;

interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
interface AudioNodeLike {
  connect(dest: unknown): unknown;
}
interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}
interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface AudioContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<unknown> | unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface RestAlertDeps {
  vibrate?: ((pattern: number[]) => unknown) | null;
  getAudioContext?: (() => AudioContextLike | null) | null;
  speak?: ((text: string, lang: string | undefined, rate: number) => void) | null;
}

export interface RestAlertChannels {
  vibrate?: boolean;
  sound?: boolean;
  /** Voice line to speak; omitted/null disables voice. */
  voice?: { text: string; lang?: string } | null;
}

export interface RestAlerts {
  vibrate(pattern?: readonly number[]): boolean;
  beep(): boolean;
  speak(text: string, lang?: string): boolean;
  /** Creates/resumes the audio context; call from a user gesture (iOS). */
  unlock(): boolean;
  fire(channels?: RestAlertChannels): { vibrate: boolean; sound: boolean; voice: boolean };
}

function defaultVibrate(pattern: number[]): unknown {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  return navigator.vibrate(pattern);
}

function defaultAudioContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.AudioContext ?? w.webkitAudioContext) as
    | (new () => AudioContextLike)
    | undefined;
  return Ctor ? new Ctor() : null;
}

function defaultSpeak(text: string, lang: string | undefined, rate: number): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (typeof SpeechSynthesisUtterance === 'undefined') return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

function pick<T>(value: T | null | undefined, fallback: T): T | null {
  if (value === null) return null;
  return value ?? fallback;
}

export function createRestAlerts(deps: RestAlertDeps = {}): RestAlerts {
  const vibrateFn = pick(deps.vibrate, defaultVibrate);
  const getCtx = pick(deps.getAudioContext, defaultAudioContext);
  const speakFn = pick(deps.speak, defaultSpeak);
  let ctx: AudioContextLike | null = null;

  function ensureContext(): AudioContextLike | null {
    if (!ctx && getCtx) ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      const resumed = ctx.resume();
      if (resumed && typeof (resumed as Promise<unknown>).catch === 'function') {
        (resumed as Promise<unknown>).catch(() => undefined);
      }
    }
    return ctx;
  }

  const alerts: RestAlerts = {
    vibrate(pattern = REST_VIBRATION_PATTERN) {
      try {
        if (!vibrateFn) return false;
        return vibrateFn([...pattern]) !== false;
      } catch {
        return false;
      }
    },
    unlock() {
      try {
        return ensureContext() !== null;
      } catch {
        return false;
      }
    },
    beep() {
      try {
        const audio = ensureContext();
        if (!audio) return false;
        const t = audio.currentTime;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.2);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.2);
        return true;
      } catch {
        return false;
      }
    },
    speak(text, lang) {
      try {
        if (!speakFn || !text) return false;
        speakFn(text, lang, VOICE_RATE);
        return true;
      } catch {
        return false;
      }
    },
    fire(channels = { vibrate: true, sound: true }) {
      return {
        vibrate: channels.vibrate ? alerts.vibrate() : false,
        sound: channels.sound ? alerts.beep() : false,
        voice: channels.voice ? alerts.speak(channels.voice.text, channels.voice.lang) : false,
      };
    },
  };
  return alerts;
}
