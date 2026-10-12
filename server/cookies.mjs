// Turn pasted browser cookies (a "Cookie:" header OR a Netscape cookies.txt export) into one cookie string.
export function toCookie(input) {
  const txt = String(input ?? '').trim().slice(0, 40000); if (!txt) return '';
  let cookie;
  if (txt.includes('\t')) { // Netscape format
    const jar = new Map();
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.startsWith('#HttpOnly_') ? raw.slice(10) : raw; if (!line || line.startsWith('#')) continue;
      const f = line.split('\t'); if (f.length < 7) continue;
      if (/(^|\.)(youtube|google)\.com$/.test(f[0].replace(/^\./, ''))) jar.set(f[5], f[6].trim());
    }
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  } else cookie = txt.replace(/^cookie:\s*/i, '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return cookie;
}
export const looksSignedIn = (c) => /(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=/.test(c);
