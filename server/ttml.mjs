// TTML (BetterLyrics) -> [{ t, text, words?: [{ s, e, text, sp }] }]  — port of TTMLParser.kt (no XML dependency)
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
const dec = (s) => s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m]);
const tsec = (s) => { if (!s) return 0; const p = s.replace(/s$/, '').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : +s.replace(/s$/, '') || 0; };

export function parseTTML(x) {
  const lines = [];
  for (const m of x.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const begin = /\bbegin="([^"]+)"/.exec(m[1])?.[1]; if (!begin) continue;
    const words = [], stack = []; let skip = 0, cur = null;
    for (const t of m[2].matchAll(/<(\/?)span\b([^>]*?)(\/?)>|([^<]+)/g)) {
      if (t[4] !== undefined) { if (skip) continue; const tx = dec(t[4]); if (cur) cur.text += tx; else if (words.length && /\s/.test(tx)) words.at(-1).sp = true; continue; }
      if (t[3]) continue; // self-closing span
      if (t[1]) { const top = stack.pop(); if (top === 'skip') skip--; else if (top?.w) { top.w.text = top.w.text.trim(); if (top.w.text) words.push(top.w); cur = null; } continue; }
      const a = t[2], role = /role="([^"]+)"/.exec(a)?.[1];
      if (skip || role === 'x-bg' || role === 'x-translation' || role === 'x-roman') { stack.push('skip'); skip++; continue; } // background vocals / translations
      const b = /\bbegin="([^"]+)"/.exec(a)?.[1], e = /\bend="([^"]+)"/.exec(a)?.[1];
      if (b && e) { const w = { s: tsec(b), e: tsec(e), text: '', sp: false }; stack.push({ w }); cur = w; } else stack.push('wrap');
    }
    const text = words.length ? words.map((w) => w.text + (w.sp ? ' ' : '')).join('').trim() : dec(m[2].replace(/<[^>]+>/g, '')).trim();
    if (!text) continue;
    lines.push({ t: words.length ? Math.min(tsec(begin), words[0].s) : tsec(begin), text, ...(words.length ? { words } : {}) });
  }
  return lines.sort((a, b) => a.t - b.t);
}
