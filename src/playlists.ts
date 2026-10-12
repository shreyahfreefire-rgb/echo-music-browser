// User playlists in localStorage (replaces the Room playlist tables for now).
import { useSyncExternalStore } from 'react';
import type { Item } from './api';
export type PL = { id: string; name: string; items: Item[] };
const load = (): PL[] => { try { return JSON.parse(localStorage.getItem('playlists') ?? '[]'); } catch { return []; } };
let st = load(); const subs = new Set<() => void>();
const save = (n: PL[]) => { st = n; localStorage.setItem('playlists', JSON.stringify(st)); subs.forEach((f) => f()); };
const slim = (i: Item): Item => ({ id: i.id, title: i.title, subtitle: i.subtitle, thumb: i.thumb, playable: true });
export const usePlaylists = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const createPlaylist = (name: string, first?: Item) => { const id = 'pl' + Date.now().toString(36); save([{ id, name, items: first ? [slim(first)] : [] }, ...st]); return id; };
export const addToPlaylist = (id: string, it: Item) => save(st.map((p) => (p.id === id && !p.items.some((x) => x.id === it.id) ? { ...p, items: [...p.items, slim(it)] } : p)));
export const removeFromPlaylist = (id: string, itemId: string) => save(st.map((p) => (p.id === id ? { ...p, items: p.items.filter((x) => x.id !== itemId) } : p)));
export const renamePlaylist = (id: string, name: string) => save(st.map((p) => (p.id === id ? { ...p, name } : p)));
export const deletePlaylist = (id: string) => save(st.filter((p) => p.id !== id));
