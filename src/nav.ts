import { useSyncExternalStore } from 'react';
import type { Item } from './api';
import { play } from './player';
export type View = { kind: 'album' | 'playlist' | 'artist' | 'local'; id: string; title: string; thumb?: string };
let stack: View[] = []; const subs = new Set<() => void>(); const emit = () => subs.forEach((f) => f());
export const useNav = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => stack);
export const kindOf = (it: Item): View['kind'] =>
  it.kind === 'album' || it.kind === 'artist' || it.kind === 'playlist' ? it.kind : /^MPRE/.test(it.id) ? 'album' : /^UC/.test(it.id) ? 'artist' : 'playlist';
/** Songs play; albums/artists/playlists open a detail page (browser Back works). */
export const openItem = (items: Item[], i: number) => {
  const it = items[i]; if (it.playable) return play(items, i);
  stack = [...stack, { kind: kindOf(it), id: it.id, title: it.title, thumb: it.thumb }]; history.pushState({ e: 1 }, ''); emit();
};
export const openLocal = (id: string, title: string) => { stack = [...stack, { kind: 'local', id, title }]; history.pushState({ e: 1 }, ''); emit(); };
export const back = () => history.back();
export const resetNav = () => { stack = []; emit(); };
addEventListener('popstate', () => { stack = stack.slice(0, -1); emit(); });
