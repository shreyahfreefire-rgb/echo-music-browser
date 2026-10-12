export type Item = { id: string; kind?: string; playable?: boolean; title: string; subtitle: string; thumb?: string };
export type Home = { chips: string[]; sections: { title: string; items: Item[] }[] };
export type Detail = { title: string; subtitle: string; thumb?: string; items: Item[]; sections?: { title: string; items: Item[] }[] };
export type Word = { s: number; e: number; text: string; sp: boolean };
export type Line = { t: number; text: string; words?: Word[] };
export type Fmt = { id: string; codec: string; abr: number; ext: string; size: number; audioOnly: boolean; note: string };
export type Lyrics = { lines: Line[]; plain: string; source?: 'word' | 'line' };
const e = encodeURIComponent;
const get = async <T,>(u: string): Promise<T> => {
  const r = await fetch(u); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText); return r.json();
};
/** Covers go through our server (/api/img): avoids CORS/hotlink/size failures and lets the browser read pixel colours. */
export const img = (u?: string, size = 544) => u ? `/api/img?u=${e(u).replace(/[()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}&s=${size}` : undefined;
export const api = {
  home: (chip = '') => get<Home>('/api/home' + (chip ? `?chip=${e(chip)}` : '')),
  search: (q: string, type = 'song') => get<{ items: Item[] }>(`/api/search?q=${e(q)}&type=${type}`),
  detail: (kind: string, id: string) => get<Detail>(`/api/${kind}/${e(id)}`),
  lyrics: (title: string, artist: string, dur = 0) => get<Lyrics>(`/api/lyrics?title=${e(title)}&artist=${e(artist)}&dur=${Math.round(dur)}`),
  streamUrl: (id: string, q = 'auto') => `/api/stream/${e(id)}${q && q !== 'auto' ? `?q=${e(q)}` : ''}`,
  formats: (id: string, q = 'best') => get<{ selected?: string; formats: Fmt[] }>(`/api/formats/${e(id)}?q=${e(q)}`),
};
