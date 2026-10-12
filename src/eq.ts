// 5-band equalizer on the Web Audio API. The audio graph is only created when the EQ is first switched on,
// so playback is untouched until then.
import { useSyncExternalStore } from 'react';
export const BANDS = [60, 230, 910, 3600, 14000];
export const PRESETS: Record<string, number[]> = { Flat: [0, 0, 0, 0, 0], 'Bass boost': [6, 4, 0, 0, 0], Vocal: [-2, 0, 3, 3, 1], Treble: [0, 0, 0, 3, 6], Rock: [4, 2, -1, 2, 4], Acoustic: [3, 2, 1, 2, 2] };
type E = { on: boolean; gains: number[] };
const load = (): E => { try { const j = JSON.parse(localStorage.getItem('eq') ?? 'null'); if (j && Array.isArray(j.gains) && j.gains.length === 5) return j; } catch { /* default */ } return { on: false, gains: [0, 0, 0, 0, 0] }; };
let st = load(); const subs = new Set<() => void>();
export const useEq = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);

let el: HTMLAudioElement | undefined, ctx: AudioContext | undefined, filters: BiquadFilterNode[] = [], built = false;
export const bindAudio = (a: HTMLAudioElement) => { el = a; };
function build() {
  if (built || !el) return;
  try {
    const C = window.AudioContext ?? (window as any).webkitAudioContext; ctx = new C(); const src = ctx!.createMediaElementSource(el);
    filters = BANDS.map((f, i) => { const b = ctx!.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1; b.gain.value = 0; return b; });
    let n: AudioNode = src; for (const f of filters) { n.connect(f); n = f; } n.connect(ctx!.destination); built = true;
    addEventListener('pointerdown', () => ctx?.resume(), { passive: true }); // a suspended context would mute audio
  } catch (e) { console.warn('Equalizer unavailable', e); }
}
const apply = () => filters.forEach((f, i) => { f.gain.value = st.on ? st.gains[i] : 0; });
/** Called on every play: (re)starts the context if the EQ is in use. */
export const resumeEq = () => { if (st.on) { build(); apply(); } if (built) ctx?.resume(); };
export const setEq = (p: Partial<E>) => {
  st = { ...st, ...p }; localStorage.setItem('eq', JSON.stringify(st)); subs.forEach((f) => f());
  if (st.on) build(); if (built) { apply(); ctx?.resume(); }
};
