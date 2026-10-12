// Library (likes + history) in localStorage. Replaces Room; swap for IndexedDB later if it grows.
import { useSyncExternalStore } from 'react';
import type { Item } from './api';
const load = (k: string): Item[] => { try { return JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { return []; } };
let st = { liked: load('liked'), history: load('history') };
const subs = new Set<() => void>();
const save = (p: Partial<typeof st>) => { st = { ...st, ...p }; for (const k of Object.keys(p)) localStorage.setItem(k, JSON.stringify((st as any)[k])); subs.forEach((f) => f()); };
const slim = (i: Item): Item => ({ id: i.id, title: i.title, subtitle: i.subtitle, thumb: i.thumb, playable: true });
export const useLib = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const isLiked = (id: string) => st.liked.some((x) => x.id === id);
const syncLike = (id: string, like: boolean) => { // mirrored to your YouTube Music account when signed in
  if (localStorage.getItem('ytSigned') === '1') fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, like }) }).catch(() => {});
};
export const toggleLike = (i: Item) => { const was = isLiked(i.id); save({ liked: was ? st.liked.filter((x) => x.id !== i.id) : [slim(i), ...st.liked] }); syncLike(i.id, !was); };
export const addHistory = (i: Item) => save({ history: [slim(i), ...st.history.filter((x) => x.id !== i.id)].slice(0, 100) });
export const clearHistory = () => save({ history: [] });
export const clearLiked = () => save({ liked: [] });
