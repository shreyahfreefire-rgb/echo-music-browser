// YouTube Music account via browser cookies (the same approach the Android app uses with its login WebView).
// A separate, signed-in Innertube instance serves the library, likes and a personalised Home; the shared public
// instance is never signed in, so the rest of the app keeps working even if this fails.
import fs from 'node:fs';
import path from 'node:path';
import { Innertube } from 'youtubei.js';
import * as YT from 'youtubei.js'; // namespace import: a missing export can't crash startup
import { looksSignedIn, toCookie } from './cookies.mjs';

export function registerAuth(app, { getYT, norm, items }) {
  const file = path.join(process.cwd(), '.echo-auth.json');
  let authYT = null, error = '';

  async function connect(cookie) {
    if (!looksSignedIn(cookie)) throw new Error("These cookies don't look signed in (no SAPISID). Copy them while logged in to music.youtube.com.");
    const yt = await Innertube.create({ cookie, retrieve_player: false });
    await yt.account.getInfo(); // throws when the cookies are expired / invalid
    authYT = yt; error = '';
  }
  (async () => { // restore: saved cookie, or the YT_COOKIES_FILE already used for yt-dlp
    try {
      let cookie = ''; try { cookie = JSON.parse(fs.readFileSync(file, 'utf8')).cookie ?? ''; } catch { /* none / old format */ }
      if (!cookie && process.env.YT_COOKIES_FILE) cookie = toCookie(fs.readFileSync(process.env.YT_COOKIES_FILE, 'utf8'));
      if (cookie) await connect(cookie);
    } catch (e) { error = String(e.message ?? e); console.error('YouTube account not restored:', error); }
  })();

  app.get('/api/auth/status', (_req, res) => res.json({ signedIn: !!authYT, error }));

  app.post('/api/auth/cookie', async (req, res) => {
    try {
      const cookie = toCookie(req.body?.cookie); if (!cookie) throw new Error('Paste your cookies first.');
      await connect(cookie); try { fs.writeFileSync(file, JSON.stringify({ cookie })); } catch { /* read-only dir: stays for this session */ }
      res.json({ signedIn: true });
    } catch (e) { authYT = null; res.status(400).json({ error: String(e.message ?? e) }); }
  });

  app.post('/api/auth/signout', (_req, res) => { authYT = null; error = ''; try { fs.unlinkSync(file); } catch { /* none */ } res.json({ ok: true }); });

  app.get('/api/library', async (_req, res) => {
    if (!authYT) return res.status(401).json({ error: 'Not signed in' });
    const out = { liked: [], playlists: [], albums: [], artists: [] };
    try { out.liked = items((await authYT.music.getPlaylist('LM')).items); } catch (e) { console.error('liked:', e.message); }
    try {
      const lib = await authYT.music.getLibrary(); const seen = new Set();
      for (const n of lib.memo?.getType?.(YT.YTNodes?.MusicTwoRowItem) ?? []) {
        const it = norm(n); if (!it.id || !it.title || seen.has(it.id)) continue; seen.add(it.id);
        (it.kind === 'album' ? out.albums : it.kind === 'artist' ? out.artists : out.playlists).push(it);
      }
    } catch (e) { console.error('library:', e.message); }
    res.json(out);
  });

  app.post('/api/like', async (req, res) => { // mirror hearts to your account (best effort)
    if (!authYT) return res.status(401).json({ error: 'Not signed in' });
    const { id, like } = req.body ?? {}; if (typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) return res.status(400).json({ error: 'Bad id' });
    try { await (like ? authYT.interact.like(id) : authYT.interact.removeRating(id)); res.json({ ok: true }); }
    catch (e) { res.status(502).json({ error: String(e.message ?? e) }); }
  });

  return { getAuth: () => authYT };
}
