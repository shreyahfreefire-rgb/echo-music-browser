// Echo Music web backend: browsers can't call InnerTube / googlevideo directly (CORS),
// so this proxy replaces the Android :innertube + :playback modules.
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { Innertube } from 'youtubei.js';
import { parseTTML } from './ttml.mjs';
import { registerAuth } from './auth.mjs';
import { registerRooms } from './rooms.mjs';
import { registerQuality, resolveQ } from './quality.mjs';

const run = promisify(execFile);
const app = express();
app.use(express.json({ limit: '100kb' }));
let ytP; const getYT = () => (ytP ??= Innertube.create({ retrieve_player: true }));

const txt = (x) => (x && (x.text ?? (typeof x === 'string' ? x : ''))) || '';
const VID = /^[\w-]{11}$/;
const pickThumb = (n) => { const a = n?.thumbnails ?? n?.thumbnail?.contents ?? n?.thumbnail ?? n?.background?.contents; if (Array.isArray(a) && a.length) return a.at(-1)?.url; };
const deepThumb = (o, d = 0) => {
  if (!o || typeof o !== 'object' || d > 4) return; const t = pickThumb(o); if (t) return t;
  for (const k of ['header', 'thumbnail', 'background', 'content', 'image', 'contents']) { let v = o[k]; if (Array.isArray(v)) v = v[0]; const r = deepThumb(v, d + 1); if (r) return r; }
};
const norm = (n) => {
  const kind = n.item_type;
  const id = n.id ?? n.video_id ?? n.endpoint?.payload?.videoId ?? n.endpoint?.payload?.browseId;
  return {
    id, kind,
    playable: kind === 'song' || kind === 'video' || (!kind && VID.test(id ?? '')),
    title: txt(n.title) || n.name || '',
    subtitle: n.artists?.map((a) => a.name).join(', ') || txt(n.subtitle) || n.author?.name || '',
    thumb: (() => { const a = n.thumbnails ?? n.thumbnail?.contents; return Array.isArray(a) ? a.at(-1)?.url : undefined; })() ?? deepThumb(n) ?? ((kind === 'song' || kind === 'video' || (!kind && VID.test(id ?? ''))) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined),
  };
};
const items = (c = []) => c.map(norm).filter((i) => i.id && i.title);
const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req)); } catch (e) { console.error(e); res.status(502).json({ error: String(e.message ?? e) }); }
};

let getAuth = () => null; // set by registerAuth (cookie-signed instance, or null)
app.get('/api/home', wrap(async (req) => {
  const chip = String(req.query.chip ?? '');
  const build = async (yt) => {
    let feed = await yt.music.getHomeFeed(); const chips = (feed.filters ?? []).map((f) => txt(f));
    if (chip && chips.includes(chip)) feed = await feed.applyFilter(chip);
    return { chips, sections: (feed.sections ?? []).map((x) => ({ title: txt(x.header?.title), items: items(x.contents) })).filter((x) => x.items.length) };
  };
  const a = getAuth();
  if (a) { try { return await build(a); } catch (e) { console.error('Personalised home failed, using the public feed:', e.message); } }
  return build(await getYT());
}));
const SHELF = { song: 'songs', video: 'videos', album: 'albums', artist: 'artists', playlist: 'playlists' };
app.get('/api/search', wrap(async (req) => {
  const type = SHELF[req.query.type] ? req.query.type : 'song';
  const res = await (await getYT()).music.search(String(req.query.q ?? ''), { type });
  return { items: items(res[SHELF[type]]?.contents ?? res.contents?.flatMap((x) => x.contents ?? [])) };
}));

// ---- Detail pages (album / playlist / artist) ----
const thumbs = (h) => deepThumb(h);
const detail = (h, list, fallback = {}) => {
  const first = items(list).find((i) => i.thumb)?.thumb; const thumb = thumbs(h) ?? first; const who = h?.strapline_text_one?.text || fallback.who || '';
  return {
    title: txt(h?.title) || txt(h?.name) || fallback.title || '', subtitle: txt(h?.subtitle) || who, thumb,
    items: items(list).map((i) => ({ ...i, thumb: i.thumb ?? thumb, subtitle: i.subtitle || who })),
  };
};
app.get('/api/album/:id', wrap(async (req) => { const a = await (await getYT()).music.getAlbum(req.params.id); return detail(a.header, a.contents); }));
app.get('/api/playlist/:id', wrap(async (req) => { const p = await (await getYT()).music.getPlaylist(req.params.id); return detail(p.header, p.items); }));
app.get('/api/artist/:id', wrap(async (req) => {
  const a = await (await getYT()).music.getArtist(req.params.id); const h = a.header;
  return { title: txt(h?.title) || txt(h?.name), subtitle: 'Artist', thumb: thumbs(h), items: [],
    sections: (a.sections ?? []).map((x) => ({ title: txt(x.header?.title), items: items(x.contents) })).filter((x) => x.items.length) };
}));

// ---- Image proxy: same-origin covers with size rewrite + fallbacks (allow-listed hosts only) ----
const IMG_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|ytimg\.com)$/;
const imgCache = new Map();
const sized = (u, n) => u.replace(/=(?:w\d+-h\d+|s\d+)[^/?&]*$/, `=w${n}-h${n}-l90-rj`);
app.get('/api/img', async (req, res) => {
  const u = String(req.query.u ?? ''); const n = Math.min(1600, Math.max(48, +req.query.s || 544)); const key = `${u}|${n}`;
  let hit = imgCache.get(key);
  if (!hit) {
    for (const c of new Set([sized(u, n), u])) {
      try {
        const url = new URL(c); if (url.protocol !== 'https:' || !IMG_HOST.test(url.hostname)) continue;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
        const type = r.headers.get('content-type') ?? '';
        if (r.ok && type.startsWith('image/')) { hit = { buf: Buffer.from(await r.arrayBuffer()), type }; break; }
      } catch { /* try next candidate */ }
    }
    if (hit) { if (imgCache.size > 400) imgCache.delete(imgCache.keys().next().value); imgCache.set(key, hit); }
  }
  if (!hit) return res.status(404).end();
  res.set({ 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=604800, immutable' }).send(hit.buf);
});

// ---- Lyrics: BetterLyrics (word-level TTML, same source as the Android app) -> LRCLIB (line-level) ----
const lyricsCache = new Map();
app.get('/api/lyrics', wrap(async (req) => {
  const rawTitle = String(req.query.title ?? ''); const artist = String(req.query.artist ?? '').split(',')[0].trim(); const dur = Math.round(+req.query.dur || 0);
  const key = `${rawTitle}|${artist}`; if (lyricsCache.has(key)) return lyricsCache.get(key);
  let out = null;
  try {
    const q = new URLSearchParams({ s: rawTitle, a: artist }); if (dur > 0) q.set('d', dur);
    const r = await fetch('https://lyrics-api.boidu.dev/getLyrics?' + q, { signal: AbortSignal.timeout(6000) });
    if (r.ok) { const lines = parseTTML((await r.json()).ttml ?? ''); if (lines.length) out = { lines, plain: '', source: 'word' }; }
  } catch { /* fall through to LRCLIB */ }
  if (!out) {
    const title = rawTitle.replace(/\s*[([].*?[)\]]/g, '').trim();
    const get = async (q) => { try { const r = await fetch('https://lrclib.net/api/search?' + new URLSearchParams(q), { headers: { 'User-Agent': 'EchoMusicWeb/0.5' }, signal: AbortSignal.timeout(6000) }); return r.ok ? r.json() : []; } catch { return []; } };
    let arr = await get({ track_name: title, artist_name: artist }); if (!arr.length) arr = await get({ q: `${title} ${artist}` });
    const j = arr.find((x) => x.syncedLyrics) ?? arr[0];
    const lines = (j?.syncedLyrics ?? '').split('\n').map((l) => { const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); return m ? { t: +m[1] * 60 + +m[2], text: m[3].trim() } : null; }).filter(Boolean);
    out = { lines, plain: j?.plainLyrics ?? '', source: 'line' };
  }
  if (out.lines.length || out.plain) lyricsCache.set(key, out);
  return out;
}));

// ---- Stream resolution: try several InnerTube clients, then yt-dlp, and probe each URL ----
const cache = new Map(); // videoId -> { url, via, exp }
const probe = async (url) => { const r = await fetch(url, { headers: { Range: 'bytes=0-1' } }); r.body?.cancel?.(); return r.status; };
const basicInfo = async (yt, id, client) => {
  try {
    return await yt.getBasicInfo(id, client);
  } catch (e) {
    if (/toUpperCase/.test(String(e.message))) {
      return yt.getBasicInfo(id, client);
    }
    throw e;
  }
};
const CLIENTS = ['ANDROID_VR', 'IOS', 'TV'];
// Optional: let yt-dlp use YOUR logged-in session (set one env var before starting)
const COOKIES = process.env.YT_COOKIES_FILE ? ['--cookies', process.env.YT_COOKIES_FILE]
  : process.env.YT_COOKIES_BROWSER ? ['--cookies-from-browser', process.env.YT_COOKIES_BROWSER] : [];
const cooldown = new Map(); // videoId -> { until, err }  (don't hammer YouTube after a failure)

let noDlp = false; // set when yt-dlp isn't installed -> then (and only then) try the youtubei.js fallback
const ok = (st) => st === 200 || st === 206;
const remember = (id, url, via) => { const v = { url, via, exp: Date.now() + 20 * 60e3 }; cache.set(id, v); return v; };

// Primary: yt-dlp with the Android client (works for the user: --extractor-args "youtube:player_client=android")
async function viaYtDlp(id, errors) {
  const base = [...COOKIES, '-f', 'ba[ext=m4a]/ba/18/b', '-g', '--no-playlist', `https://www.youtube.com/watch?v=${id}`];
  const attempts = [
    ['--extractor-args', 'youtube:player_client=android'],
    ['--extractor-args', 'youtube:player_client=android_vr'],
    ['--js-runtimes', 'node'],
  ];
  for (const extra of attempts) {
    try {
      const { stdout } = await run('yt-dlp', [...extra, ...base], { timeout: 60000 });
      const url = stdout.trim().split('\n')[0]; const st = await probe(url);
      if (ok(st)) return remember(id, url, 'yt-dlp ' + extra[1]);
      errors.push(`yt-dlp ${extra[1]}: googlevideo HTTP ${st}`);
    } catch (e) {
      if (e.code === 'ENOENT') { errors.push('yt-dlp: not installed'); noDlp = true; return; }
      errors.push(`yt-dlp ${extra[1]}: ${String(e.stderr || e.message).trim().split('\n').slice(-1)[0]}`);
    }
  }
}

async function resolve(id) {
  const hit = cache.get(id); if (hit && hit.exp > Date.now()) return hit;
  const cd = cooldown.get(id); if (cd && cd.until > Date.now()) throw cd.err;
  const errors = [];
  const viaDlp = await viaYtDlp(id, errors); if (viaDlp) return viaDlp;
  const yt = noDlp ? await getYT() : null;
  for (const client of noDlp ? CLIENTS : []) { // fallback: youtubei.js direct URLs
    try {
      const info = await basicInfo(yt, id, client);
      const fmts = (info.streaming_data?.adaptive_formats ?? [])
        .filter((f) => f.has_audio && !f.has_video)
        .sort((a, b) => (b.mime_type.includes('mp4') - a.mime_type.includes('mp4')) || b.bitrate - a.bitrate);
      if (!fmts.length) { errors.push(`${client}: no audio formats`); continue; }
      const url = fmts[0].url ?? await fmts[0].decipher(yt.session.player);
      const st = await probe(url);
      if (ok(st)) return remember(id, url, client);
      errors.push(`${client}: googlevideo HTTP ${st}`);
    } catch (e) { errors.push(`${client}: ${e.message}`); }
  }
  const err = Object.assign(new Error('Could not get a playable stream. ' + errors.join(' | ')), { errors });
  cooldown.set(id, { until: Date.now() + 90e3, err });
  throw err;
}

app.get('/api/debug/:id', async (req, res) => {
  try { const v = await resolve(req.params.id); res.json({ ok: true, via: v.via }); }
  catch (e) { res.status(502).json({ ok: false, errors: e.errors ?? [String(e.message)] }); }
});

app.get('/api/stream/:id', async (req, res) => {
  try {
    const q = String(req.query.q ?? 'auto');
    let v; // 'auto' = the original, proven path; other presets try the quality picker and fall back to it on any failure
    if (q === 'auto') v = await resolve(req.params.id);
    else { try { v = await resolveQ(req.params.id, q, { run, COOKIES, probe }); } catch (e) { console.error('quality fallback:', e.message); v = await resolve(req.params.id); } }
    const up = await fetch(v.url, { headers: { Range: req.headers.range ?? 'bytes=0-' } });
    if (up.status >= 400) { cache.delete(req.params.id); return res.status(502).json({ error: `googlevideo returned HTTP ${up.status}` }); }
    res.status(up.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const x = up.headers.get(h); if (x) res.set(h, x); }
    const body = Readable.fromWeb(up.body);
    res.on('close', () => body.destroy()); body.on('error', () => res.end()); body.pipe(res);
  } catch (e) { console.error(e.message); res.status(502).json({ error: String(e.message ?? e) }); }
});

({ getAuth } = registerAuth(app, { getYT, norm, items }));
registerRooms(app);
registerQuality(app, { run, COOKIES, probe });

app.use(express.static(new URL('../dist', import.meta.url).pathname));
app.get('*', (_, res) => res.sendFile(new URL('../dist/index.html', import.meta.url).pathname));
app.listen(process.env.PORT ?? 3001, () => console.log('Echo server on :' + (process.env.PORT ?? 3001)));
