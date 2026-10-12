// Audio quality selection: list the real formats YouTube serves for a song (via yt-dlp -J) and pick one by preset.
const fcache = new Map(); // id -> { formats, exp }
const ATTEMPTS = [['--extractor-args', 'youtube:player_client=android'], ['--extractor-args', 'youtube:player_client=android_vr'], ['--js-runtimes', 'node']];

export async function formatsFor(id, { run, COOKIES }) {
  const hit = fcache.get(id); if (hit && hit.exp > Date.now()) return hit.formats;
  const attempts = process.env.YT_PLAYER_CLIENTS ? [['--extractor-args', `youtube:player_client=${process.env.YT_PLAYER_CLIENTS}`], ...ATTEMPTS] : ATTEMPTS;
  let last;
  for (const extra of attempts) {
    try {
      const { stdout } = await run('yt-dlp', [...extra, ...COOKIES, '-J', '--no-playlist', `https://www.youtube.com/watch?v=${id}`], { timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
      const fm = (JSON.parse(stdout).formats ?? [])
        .filter((f) => f.url && f.acodec && f.acodec !== 'none' && !f.has_drm && /^https?$/.test(f.protocol ?? 'https'))
        .map((f) => ({ id: String(f.format_id), ext: f.ext, codec: String(f.acodec).split('.')[0], abr: Math.round(f.abr || f.tbr || 0), size: f.filesize || f.filesize_approx || 0,
          audioOnly: !f.vcodec || f.vcodec === 'none', note: f.format_note || '', url: f.url }));
      if (fm.length) { fcache.set(id, { formats: fm, exp: Date.now() + 20 * 60e3 }); return fm; }
    } catch (e) { last = e; }
  }
  throw new Error('No audio formats available' + (last ? `: ${String(last.stderr || last.message).trim().split('\n').pop()}` : ''));
}

/** Candidates in order of preference for a preset (or an exact format id). Prefers audio-only streams. */
export function rank(formats, q) {
  const audio = formats.filter((f) => f.audioOnly); const pool = audio.length ? audio : formats;
  const hi = (a, b) => b.abr - a.abr, lo = (a, b) => a.abr - b.abr;
  const exact = formats.find((f) => f.id === q);
  const by = { opus: pool.filter((f) => f.codec === 'opus').sort(hi), aac: pool.filter((f) => f.codec === 'mp4a').sort(hi),
    low: [...pool].filter((f) => f.abr >= 40).sort(lo).concat([...pool].sort(lo)) }[q] ?? [];
  return [...(exact ? [exact] : []), ...by, ...[...pool].sort(hi)].filter((f, i, a) => a.indexOf(f) === i);
}

export async function resolveQ(id, q, deps) {
  const formats = await formatsFor(id, deps);
  for (const f of rank(formats, q).slice(0, 4)) { // first one the CDN actually serves
    try { const st = await deps.probe(f.url); if (st === 200 || st === 206) return { url: f.url, via: `yt-dlp ${f.codec} ${f.abr}k`, fmt: f }; } catch { /* next */ }
  }
  throw new Error('No playable format for that quality');
}

export function registerQuality(app, deps) {
  app.get('/api/formats/:id', async (req, res) => {
    try {
      const formats = await formatsFor(req.params.id, deps); const q = String(req.query.q ?? 'best'); const pick = rank(formats, q === 'auto' ? 'best' : q)[0];
      res.json({ selected: pick?.id, formats: formats.map(({ url, ...f }) => f).sort((a, b) => b.abr - a.abr) });
    } catch (e) { res.status(502).json({ error: String(e.message ?? e) }); }
  });
}
