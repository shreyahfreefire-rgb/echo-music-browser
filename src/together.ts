// Listen Together: the host's playback is broadcast through the server; guests follow it.
import { useSyncExternalStore } from 'react';
import { getPlayer, notify, subscribePlayer, syncTo } from './player';
type T = { role: 'none' | 'host' | 'guest'; code: string; n: number; busy: boolean; error: string };
let t: T = { role: 'none', code: '', n: 0, busy: false, error: '' }; let hostKey = '';
const subs = new Set<() => void>(); const set = (p: Partial<T>) => { t = { ...t, ...p }; subs.forEach((f) => f()); };
export const useTogether = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => t);

let es: EventSource | undefined, unsub: (() => void) | undefined, hb = 0, lastKey = '', last = { pos: 0, at: 0, playing: false };
const post = (path: string, body: object) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const push = () => {
  const p = getPlayer(); const it = p.queue[p.index]; if (!it || t.role !== 'host') return;
  post(`/api/room/${t.code}/state`, { hostKey, item: { id: it.id, title: it.title, subtitle: it.subtitle, thumb: it.thumb }, pos: p.pos, playing: p.playing }).catch(() => {});
  last = { pos: p.pos, at: Date.now(), playing: p.playing };
};
const stop = () => { es?.close(); es = undefined; unsub?.(); unsub = undefined; clearInterval(hb); };
const listen = (code: string, guest: boolean) => {
  es = new EventSource(`/api/room/${code}/events`); const count = (e: Event) => set({ n: JSON.parse((e as MessageEvent).data).n });
  es.addEventListener('hello', count); es.addEventListener('listeners', count);
  if (guest) es.addEventListener('state', (e) => { const s = JSON.parse((e as MessageEvent).data); syncTo(s.item, s.pos + (s.playing ? (s.serverNow - s.at) / 1000 : 0), s.playing); });
  es.addEventListener('closed', () => { stop(); set({ role: 'none', code: '', n: 0 }); notify('The host ended the room'); });
};

export const createRoom = async () => {
  set({ busy: true, error: '' });
  try {
    const r = await post('/api/room/create', {}); const j = await r.json(); if (!r.ok) throw new Error(j.error);
    hostKey = j.hostKey; set({ role: 'host', code: j.code, busy: false, n: 1 }); listen(j.code, false); lastKey = '';
    unsub = subscribePlayer(() => { // push on song/play-pause change, or when the host seeks
      const p = getPlayer(); const it = p.queue[p.index]; const key = `${it?.id}|${p.playing}`;
      const exp = last.pos + (last.playing ? (Date.now() - last.at) / 1000 : 0);
      if (key !== lastKey || Math.abs(p.pos - exp) > 2) { lastKey = key; push(); }
    });
    hb = window.setInterval(push, 5000); push();
  } catch (e) { set({ busy: false, error: String((e as Error).message) }); }
};
export const joinRoom = async (raw: string) => {
  const code = raw.trim().toUpperCase(); if (!code) return; set({ busy: true, error: '' });
  try {
    const r = await fetch(`/api/room/${code}/exists`); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Room not found');
    set({ role: 'guest', code, busy: false, n: 0 }); listen(code, true); notify(`Joined room ${code}`);
  } catch (e) { set({ busy: false, error: String((e as Error).message) }); }
};
export const leaveRoom = () => { if (t.role === 'host') post(`/api/room/${t.code}/close`, { hostKey }).catch(() => {}); stop(); set({ role: 'none', code: '', n: 0, error: '' }); };
