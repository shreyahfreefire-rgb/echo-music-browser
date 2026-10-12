// Replaces :playback (ExoPlayer/MediaSession) with <audio> + Media Session API.
import { useSyncExternalStore } from 'react';
import { api, img, type Item } from './api';
import { bindAudio, resumeEq } from './eq';
import { addHistory } from './lib';
import { isDownloaded, offlineSrc } from './offline';
import { getStreamQuality } from './quality';

type S = { queue: Item[]; index: number; playing: boolean; loading: boolean; error: string; toast: string; pos: number; dur: number; open: boolean;
  style: 'apple' | 'material'; volume: number; speed: number; sleep: string; shuffle: boolean; repeat: 'off' | 'all' | 'one' };
let s: S = { queue: [], index: -1, playing: false, loading: false, error: '', toast: '', pos: 0, dur: 0, open: false,
  style: (localStorage.getItem('playerStyle') as S['style']) ?? 'apple', volume: +(localStorage.getItem('volume') ?? 1), speed: +(localStorage.getItem('speed') ?? 1), sleep: '', shuffle: false, repeat: 'off' };
let pending = 0; // seconds to resume from on the first play after a reload
try {
  const j = JSON.parse(localStorage.getItem('session') ?? 'null');
  if (j?.queue?.length) { s = { ...s, queue: j.queue, index: Math.min(Math.max(0, j.index), j.queue.length - 1), pos: j.pos || 0 }; pending = j.pos || 0; }
} catch { /* ignore corrupt session */ }
const saveSession = () => {
  try { const start = Math.max(0, s.index - 20); localStorage.setItem('session', JSON.stringify({ queue: s.queue.slice(start, start + 100).map(({ id, title, subtitle, thumb }) => ({ id, title, subtitle, thumb, playable: true })), index: s.index - start, pos: s.pos })); } catch { /* storage full */ }
};
let lastSave = 0;
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const usePlayer = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => s);

let toastT: number;
export const notify = (toast: string) => { set({ toast }); clearTimeout(toastT); toastT = window.setTimeout(() => set({ toast: '' }), 3000); };

const audio = new Audio(); audio.preload = 'auto'; audio.volume = s.volume; audio.playbackRate = audio.defaultPlaybackRate = s.speed;
bindAudio(audio);
let loadTok = 0;
export const getTime = () => audio.currentTime;
export const setVolume = (v: number) => { audio.volume = v; localStorage.setItem('volume', String(v)); set({ volume: v }); };
audio.ontimeupdate = () => { set({ pos: audio.currentTime, dur: audio.duration || 0 }); if (Date.now() - lastSave > 5000) { lastSave = Date.now(); saveSession(); } };
audio.onplay = () => resumeEq();
audio.onplaying = () => set({ playing: true, loading: false, error: '' });
audio.onpause = () => set({ playing: false });
audio.onwaiting = () => set({ loading: true });
audio.oncanplay = () => set({ loading: false });
let sleepT = 0, sleepEnd = false;
audio.onended = () => { if (sleepEnd) { sleepEnd = false; set({ sleep: '' }); return; } next(true); };
audio.onerror = async () => { // surface the server's real reason instead of failing silently
  set({ playing: false, loading: false });
  const it = s.queue[s.index]; let msg = 'Playback failed';
  try { const r = await fetch(api.streamUrl(it.id), { headers: { Range: 'bytes=0-1' } }); if (!r.ok) msg = (await r.json()).error ?? msg; } catch { /* keep default */ }
  set({ error: msg });
};

function load(resume = 0) {
  const it = s.queue[s.index]; if (!it) return;
  set({ loading: true, error: '', pos: resume, dur: 0 }); addHistory(it); saveSession();
  const tok = ++loadTok;
  const start = (src: string) => {
    audio.src = src; audio.play().catch(() => {});
    if (resume > 1) audio.addEventListener('loadedmetadata', () => { audio.currentTime = resume; }, { once: true });
  };
  if (isDownloaded(it.id)) offlineSrc(it.id).then((u) => { if (tok === loadTok) start(u ?? api.streamUrl(it.id)); }); // played from the device
  else start(api.streamUrl(it.id, getStreamQuality()));
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: it.subtitle, artwork: it.thumb ? [{ src: img(it.thumb, 512)!, sizes: '512x512' }] : [] });
}
export const play = (items: Item[], index = 0) => {
  const q = items.filter((i) => i.playable !== false); const i = q.findIndex((x) => x.id === items[index]?.id);
  if (i < 0) return notify('Nothing playable here');
  set({ queue: q, index: i }); load();
};
export const playShuffled = (items: Item[]) => {
  const q = items.filter((i) => i.playable !== false).sort(() => Math.random() - 0.5); if (q.length) { set({ queue: q, index: 0, shuffle: true }); load(); }
};
export const playNext = (it: Item) => { if (!s.queue.length) return play([it]); const q = [...s.queue]; q.splice(s.index + 1, 0, { ...it, playable: true }); set({ queue: q }); notify('Playing next'); };
export const enqueue = (it: Item) => { if (!s.queue.length) return play([it]); set({ queue: [...s.queue, { ...it, playable: true }] }); notify('Added to queue'); };
/** Re-open the current song (e.g. after a quality change), continuing from the same position. */
export const reloadCurrent = () => { if (audio.getAttribute('src') && s.queue[s.index]) load(audio.currentTime); };
export const jump = (i: number) => { set({ index: i }); load(); };
export const subscribePlayer = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getPlayer = () => s;
/** Listen Together (guest): follow the host's song, position and play/pause. */
export const syncTo = (item: Item, pos: number, playing: boolean) => {
  if (s.queue[s.index]?.id !== item.id || !audio.getAttribute('src')) {
    set({ queue: [{ ...item, playable: true }], index: 0 }); pending = 0; load(pos);
    if (!playing) audio.addEventListener('loadedmetadata', () => audio.pause(), { once: true });
    return;
  }
  if (Math.abs(audio.currentTime - pos) > 1.5) audio.currentTime = pos;
  if (playing && audio.paused) audio.play().catch(() => {});
  if (!playing && !audio.paused) audio.pause();
};
export const toggle = () => {
  if (!audio.getAttribute('src') && s.queue[s.index]) { const r = pending; pending = 0; load(r); return; } // restored session: first play
  return audio.paused ? audio.play() : audio.pause();
};
export const setSpeed = (r: number) => { audio.playbackRate = audio.defaultPlaybackRate = r; localStorage.setItem('speed', String(r)); set({ speed: r }); };
export const setSleep = (m: number | 'end') => {
  clearTimeout(sleepT); sleepEnd = false;
  if (m === 'end') { sleepEnd = true; set({ sleep: 'End of song' }); notify('Sleep timer: end of song'); }
  else if (m) { sleepT = window.setTimeout(() => { audio.pause(); set({ sleep: '' }); }, m * 60000); set({ sleep: `${m} min` }); notify(`Sleep timer: ${m} min`); }
  else set({ sleep: '' });
};
export const next = (auto = false) => {
  if (auto && s.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  let i = s.index + 1;
  if (s.shuffle && s.queue.length > 1) do { i = Math.floor(Math.random() * s.queue.length); } while (i === s.index);
  if (i >= s.queue.length) { if (s.repeat === 'all') i = 0; else return set({ playing: false }); }
  set({ index: i }); load();
};
export const prev = () => { if (audio.currentTime > 3) audio.currentTime = 0; else if (s.index > 0) { set({ index: s.index - 1 }); load(); } };
export const seek = (t: number) => { audio.currentTime = t; };
export const openPlayer = (open: boolean) => set({ open });
export const toggleShuffle = () => set({ shuffle: !s.shuffle });
export const cycleRepeat = () => set({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' });
export const setStyle = (style: S['style']) => { localStorage.setItem('playerStyle', style); set({ style }); };

if ('mediaSession' in navigator) {
  const m = navigator.mediaSession;
  m.setActionHandler('play', toggle); m.setActionHandler('pause', toggle);
  m.setActionHandler('nexttrack', () => next()); m.setActionHandler('previoustrack', prev);
  m.setActionHandler('seekto', (d) => d.seekTime != null && seek(d.seekTime));
}
