// Offline downloads: whole songs saved in the browser's Cache Storage and played from a blob URL.
import { useSyncExternalStore } from 'react';
import { api, type Item } from './api';
export type DL = { id: string; title: string; subtitle: string; thumb?: string; size: number; at: number };
const CACHE = 'echo-songs';
const load = (): DL[] => { try { return JSON.parse(localStorage.getItem('downloads') ?? '[]'); } catch { return []; } };
let st = load(); const subs = new Set<() => void>(); const busy = new Set<string>();
const save = (n: DL[]) => { st = n; localStorage.setItem('downloads', JSON.stringify(st)); subs.forEach((f) => f()); };
export const useDownloads = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const isDownloaded = (id: string) => st.some((d) => d.id === id);

export async function downloadSong(it: Item, q = 'best') {
  if (typeof caches === 'undefined') throw new Error('Downloads need https:// or localhost');
  if (isDownloaded(it.id) || busy.has(it.id)) return; busy.add(it.id);
  try {
    const r = await fetch(api.streamUrl(it.id, q)); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Download failed');
    const type = r.headers.get('content-type') || 'audio/mp4'; const blob = new Blob([await r.arrayBuffer()], { type });
    await (await caches.open(CACHE)).put('/offline/' + it.id, new Response(blob, { headers: { 'Content-Type': type } }));
    save([{ id: it.id, title: it.title, subtitle: it.subtitle, thumb: it.thumb, size: blob.size, at: Date.now() }, ...st]);
  } finally { busy.delete(it.id); }
}
export async function removeDownload(id: string) { try { await (await caches.open(CACHE)).delete('/offline/' + id); } catch { /* ignore */ } save(st.filter((d) => d.id !== id)); }
export async function clearDownloads() { try { await caches.delete(CACHE); } catch { /* ignore */ } save([]); }
let objUrl = '';
export async function offlineSrc(id: string): Promise<string | undefined> {
  try {
    const hit = await (await caches.open(CACHE)).match('/offline/' + id); if (!hit) return;
    if (objUrl) URL.revokeObjectURL(objUrl); objUrl = URL.createObjectURL(await hit.blob()); return objUrl;
  } catch { return; }
}
