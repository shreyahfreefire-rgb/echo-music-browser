# Echo Music → Web: migration map

## Run it
```bash
npm install
npm run dev      # Vite on :5173 (proxies /api) + backend on :3001
npm run build && npm start   # production: backend serves dist/ on :3001
```
Install as an app: open the site in Chrome/Edge → "Install Echo Music" (manifest + service worker via vite-plugin-pwa).

## Status
**Untested:** this was written without network access, so `npm install`, the build, and the
youtubei.js response mapping in `server/index.mjs` have not been run. Expect small fixes
(youtubei.js shapes change between versions). `server/index.mjs` passes `node --check`.

## Android module → web
| Android | Web |
|---|---|
| `:app` ui/screens, ui/component, ui/player | `src/App.tsx` (+ split per screen as it grows) |
| `ui/theme/Theme.kt` (materialKolor, seed `0xFFED5564`) | `src/theme.ts` (material-color-utilities → CSS vars) |
| `DESIGN.md`: translucent cards, 24dp radii, Liquid Glass | `src/theme.css` (`.glass`, `.list`, `.row`) |
| `GlassEffect.kt` (RenderEffect blur, 1.5x saturation, 0.4 tint) | CSS `backdrop-filter: blur() saturate(1.5)` |
| `:innertube` (YouTube.kt, 2.6k lines) | `server/index.mjs` via youtubei.js (replace, don't port) |
| `:playback` ExoPlayer + MediaSession | `src/player.ts` (`<audio>` + Media Session API) |
| `utils/cipher`, `utils/potoken`, `utils/sabr` | handled server-side by youtubei.js; not ported |
| Room database (library, history, likes) | IndexedDB (Dexie) – TODO |
| DataStore preferences | localStorage / IndexedDB – TODO |
| WorkManager downloads / offline | Cache Storage + service worker – TODO |
| `:lyrics`, `:lrclib`, `:kugou`, `:betterlyrics`, `:simpmusic`, `:youlyplus`, `:paxsenixlyrics` | one `/api/lyrics` endpoint calling LRCLIB first (`lrclib` is plain REST) – TODO |
| `:shazamkit`, `:audio-dsp`, `:usbaudio`, `:dsp-core`, `vibrafp` (C++) | skip, or Web Audio API (EQ) / WASM later |
| `:canvas`, `:echomusiccanvas`, `:applecanvas` | muted `<video>` layer inside the cover square – TODO |
| Cast (`gms/`) | Web Cast / Remote Playback API – TODO |
| Listen Together | WebSocket room on the same server – TODO |

## Suggested order
1. Get dev running, fix any youtubei.js mapping errors in `norm()`.
2. Queue screen + shuffle/repeat; cover-art color extraction for the player (`PlayerColorExtractor.kt`).
3. Album / artist / playlist pages (`/api/album`, `/api/artist`, `/api/playlist`).
4. Synced lyrics (LRCLIB), then library + history in IndexedDB.
5. Google login for the synced library (Android uses a WebView cookie flow; web needs a different approach).
6. Desktop layout: keep the mobile look, add side rail ≥1100px, keyboard shortcuts.

## Things to know
- **License:** Echo Music is GPL-3.0. A web port is a derivative work, so keep it GPL-3.0 and publish the source if you host it.
- **YouTube ToS:** the app works by using YouTube Music's private API and extracting stream URLs. Hosting a public site that does this is a bigger exposure than a personal APK (server IPs get rate-limited or blocked, and it can draw takedowns). Fine for personal/self-hosted use; think twice before running it publicly.
- Browsers can't call the API directly (CORS), so the backend is mandatory, and audio is streamed through it.

## v0.3 status
Done: queue/shuffle/repeat, album/artist/playlist pages (+ browser Back), synced lyrics (LRCLIB), likes + history (localStorage),
typed search, cover-colour player theming, keyboard shortcuts (Space, Shift+←/→, Esc).
Streams: yt-dlp (android client) first; set YT_COOKIES_BROWSER=firefox if YouTube asks to sign in.
Next: Listen Together (WebSocket), downloads/offline, Google login sync, user playlists, equalizer (Web Audio).

## v0.7 status
Added: your own playlists (create / add from ⋮ menu / rename / delete), resume last queue + position after reload,
playback speed (0.75–2x) and sleep timer (15/30/60 min, end of song), word-synced lyrics (BetterLyrics → LRCLIB),
image proxy (/api/img), working Home filter chips, Settings tab, Apple vs Material players.
Still to do: Listen Together (SSE/WebSocket rooms), offline downloads, Google login sync, equalizer (Web Audio).

## v0.8 status (everything on the original roadmap is now implemented)
- Equalizer: 5-band Web Audio EQ with presets (Settings). The audio graph is only created when you first switch it on.
- Offline downloads: song ⋮ menu → Download for offline; stored in Cache Storage, played from the device (needs https or localhost).
- Listen Together: host creates a room (server-side, SSE); guests join with the 6-letter code and follow the host.
- YouTube Music account: Settings → Connect (paste browser cookies, like the Android app's login; saved in ./.echo-auth.json, or set YT_COOKIES_FILE). Library, personalised Home, likes sync. (Google's TV code sign-in was removed: it returns HTTP 400 for YouTube Music requests.)
- Best-effort / depends on youtubei.js internals: account library parsing (server/auth.mjs). Everything else is plain web APIs.

## v0.9 status
Audio quality: stream presets (Auto / Best available / Opus / AAC / Data saver) in Settings and in the full player's ⋯ menu (which also lists the
real formats for the song); per-download quality in a song's ⋮ → Download…. Server: server/quality.mjs (yt-dlp -J format list + ranking).
'Auto' is the original path; any failure in a chosen quality falls back to it. YouTube has no lossless/hi-res audio.
