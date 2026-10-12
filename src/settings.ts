import { useSyncExternalStore } from 'react';
import { applyTheme } from './theme';
export const SEEDS: [string, string][] = [['Lavender', '#6A6FB0'], ['Echo red', '#ED5564'], ['Ocean', '#1E88E5'], ['Mint', '#2E9E7B'], ['Amber', '#E5972B']];
type St = { seed: string; mode: 'system' | 'light' | 'dark' };
let st: St = { seed: localStorage.getItem('seed') ?? SEEDS[0][1], mode: (localStorage.getItem('mode') as St['mode']) ?? 'system' };
const subs = new Set<() => void>();
export const useSettings = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const applySettings = () => applyTheme(st.seed, st.mode === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : st.mode === 'dark');
export const setSetting = (p: Partial<St>) => { st = { ...st, ...p }; localStorage.setItem('seed', st.seed); localStorage.setItem('mode', st.mode); applySettings(); subs.forEach((f) => f()); };
