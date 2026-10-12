// Audio quality presets. 'auto' keeps the original, fastest-starting path. YouTube has no lossless / hi-res audio.
import { useSyncExternalStore } from 'react';
export const PRESETS = [
  { id: 'auto', label: 'Auto', desc: 'Fastest start (default)' },
  { id: 'best', label: 'Best available', desc: 'Highest bitrate offered: AAC 256k with Premium, else Opus ~160k' },
  { id: 'opus', label: 'Opus', desc: 'Efficient, about 130–160 kbps (WebM)' },
  { id: 'aac', label: 'AAC (m4a)', desc: 'Most compatible, 128–256 kbps' },
  { id: 'low', label: 'Data saver', desc: 'About 50–70 kbps' },
] as const;
let st = { stream: localStorage.getItem('streamQuality') ?? 'auto' }; const subs = new Set<() => void>();
export const useQuality = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const getStreamQuality = () => st.stream;
export const setStreamQuality = (q: string) => { st = { stream: q }; localStorage.setItem('streamQuality', q); subs.forEach((f) => f()); };
export const label = (f: { codec: string; abr: number }) => `${f.codec === 'mp4a' ? 'AAC' : f.codec === 'opus' ? 'Opus' : f.codec} ${f.abr || '?'} kbps`;
