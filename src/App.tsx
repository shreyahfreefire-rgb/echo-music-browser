import { useEffect, useState } from 'react';
import { api, img, type Home, type Item } from './api';
import { Detail } from './Detail';
import { FullPlayer } from './FullPlayer';
import { Icon } from './icons';
import { connectCookie, refreshAccount, signOut, useAccount } from './account';
import { BANDS, PRESETS as EQ_PRESETS, setEq, useEq } from './eq';
import { PRESETS, setStreamQuality, useQuality } from './quality';
import { clearHistory, clearLiked, useLib } from './lib';
import { clearDownloads, useDownloads } from './offline';
import { createRoom, joinRoom, leaveRoom, useTogether } from './together';
import { openItem, openLocal, resetNav, useNav } from './nav';
import { next, openPlayer, prev, setStyle, toggle, usePlayer } from './player';
import { createPlaylist, usePlaylists } from './playlists';
import { SEEDS, setSetting, useSettings } from './settings';
import { Cookie, Cover, Heart, Row, Scroller, Section } from './ui';

type Tab = 'home' | 'search' | 'library' | 'settings';
const TABS: { id: Tab; label: string; icon: 'home' | 'search' | 'library' | 'tune' }[] = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'search', label: 'Search', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'library' }, { id: 'settings', label: 'Settings', icon: 'tune' },
];

function HomeScreen() {
  const [home, setHome] = useState<Home>(); const [chips, setChips] = useState<string[]>([]); const [chip, setChip] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false; setBusy(true); setErr('');
    api.home(chip).then((h) => { if (!off) { setHome(h); setChips((c) => (c.length ? c : h.chips)); } }).catch((e) => !off && setErr(e.message)).finally(() => !off && setBusy(false));
    return () => { off = true; };
  }, [chip]);
  if (err && !home) return <p className="muted pad">Couldn't load home: {err}</p>;
  if (!home) return (<><div className="chips">{[110, 90, 80, 100, 90].map((w, i) => <span key={i} className="chip sk" style={{ width: w, height: 48 }} />)}</div>
    <div className="carousel">{[0, 1, 2].map((i) => <div key={i} className="hero sk" />)}</div>
    <div className="list" style={{ marginTop: 32 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="row sk" style={{ height: 84 }} />)}</div></>);
  const [first, ...rest] = home.sections;
  return (<div className={busy ? 'busy' : ''}>
    {chips.length > 0 && <div className="chips">{chips.map((c) => <button className={`chip${chip === c ? ' sel' : ''}`} key={c} onClick={() => setChip(chip === c ? '' : c)}>{c}</button>)}</div>}
    {first && <Scroller cls="carousel">{first.items.slice(0, 12).map((it, i) => (
      <button key={it.id + i} className="hero" style={{ backgroundImage: `url("${img(it.thumb, 800) ?? ''}")` }} onClick={() => openItem(first.items, i)}>
        <div><b>{it.title}</b><span>{it.subtitle}</span></div></button>))}</Scroller>}
    {rest.map((sec, i) => <Section key={sec.title + i} i={i} title={sec.title} items={sec.items} />)}
  </div>);
}

const TYPES = [['song', 'Songs'], ['album', 'Albums'], ['artist', 'Artists'], ['playlist', 'Playlists']] as const;
function SearchScreen() {
  const [q, setQ] = useState(''); const [type, setType] = useState<string>('song'); const [res, setRes] = useState<Item[]>([]);
  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => api.search(q, type).then((r) => setRes(r.items)).catch(() => setRes([])), 350);
    return () => clearTimeout(t);
  }, [q, type]);
  return (<>
    <label className="search"><Icon n="search" /><input placeholder="Search songs, albums, artists" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
    <div className="chips">{TYPES.map(([id, label]) => <button key={id} className={`chip${type === id ? ' sel' : ''}`} onClick={() => setType(id)}>{label}</button>)}</div>
    <div className="list">{res.map((it, i) => <Row key={it.id + i} it={it} onPlay={() => openItem(res, i)} />)}</div>
  </>);
}

function YtLibrary() {
  const a = useAccount(); const [d, setD] = useState<{ liked: Item[]; playlists: Item[]; albums: Item[]; artists: Item[] }>(); const [err, setErr] = useState('');
  useEffect(() => {
    if (!a.signedIn) { setD(undefined); return; } let off = false; setErr('');
    fetch('/api/library').then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); if (!off) setD(j); }).catch((e) => !off && setErr(String(e.message)));
    return () => { off = true; };
  }, [a.signedIn]);
  if (!a.signedIn) return null; if (err) return <p className="muted pad">YouTube Music library: {err}</p>;
  if (!d) return <p className="muted pad">Loading your YouTube Music library…</p>;
  return (<>
    {d.liked.length > 0 && <Section title="YouTube Music · Liked" items={d.liked} max={30} i={3} />}
    {d.playlists.length > 0 && <Section title="YouTube Music · Playlists" items={d.playlists} i={4} />}
    {d.albums.length > 0 && <Section title="YouTube Music · Albums" items={d.albums} i={5} />}
    {d.artists.length > 0 && <Section title="YouTube Music · Artists" items={d.artists} i={6} />}
  </>);
}

function Library() {
  const { liked, history } = useLib(); const pls = usePlaylists(); const dls = useDownloads();
  const create = () => { const n = prompt('Playlist name')?.trim(); if (n) openLocal(createPlaylist(n), n); };
  return (<>
    <section className="rise"><div className="section-head"><h2>Your playlists</h2><button className="pill" onClick={create}>+ New</button></div>
      {pls.length ? <Scroller cls="cards">{pls.map((pl) => (
        <button key={pl.id} className="card" onClick={() => openLocal(pl.id, pl.name)}>
          <Cover src={pl.items.find((i) => i.thumb)?.thumb} size={400} title={pl.name} className="cc" /><b>{pl.name}</b><small>{pl.items.length} songs</small></button>))}</Scroller>
        : <p className="muted pad">Create a playlist, then add songs from any song's ⋮ menu.</p>}
    </section>
    {dls.length > 0 && <Section title="Downloaded" items={dls.map((d) => ({ id: d.id, title: d.title, subtitle: d.subtitle, thumb: d.thumb, playable: true }))} max={50} i={1} />}
    {liked.length > 0 && <Section title="Liked songs" items={liked} max={50} i={2} />}
    <YtLibrary />
    {history.length > 0 && <Section title="Recently played" items={history} max={20} i={7} />}
    {!liked.length && !history.length && !dls.length && <p className="muted pad">Songs you like (♥) and play will show up here.</p>}
  </>);
}

function SettingsPage() {
  const s = useSettings(); const p = usePlayer(); const lib = useLib(); const acct = useAccount(); const tg = useTogether(); const eq = useEq(); const sq = useQuality().stream; const dls = useDownloads(); const [join, setJoin] = useState(''); const [ck, setCk] = useState('');
  const mb = (dls.reduce((n, d) => n + d.size, 0) / 1048576).toFixed(1);
  const seg = <T extends string>(opts: readonly T[], val: T, on: (v: T) => void) => <div className="seg">{opts.map((m) => <button key={m} className={val === m ? 'on' : ''} onClick={() => on(m)}>{m}</button>)}</div>;
  return (<div className="settings">
    <section className="panel"><h3>YouTube Music account</h3>
      {acct.signedIn ? <><p className="muted">Connected. Your library appears under Library, Home is personalised, and hearts sync to your account.</p><div className="actions"><button className="pill" onClick={signOut}>Disconnect</button></div></>
        : <><p className="muted">Connect your account like the Android app does, with your browser's login cookies. They stay on this computer (file <code>.echo-auth.json</code>); use a spare Google account to be safe.</p>
          <ol className="how"><li>Open <b>music.youtube.com</b> signed in, press <b>F12</b> → <b>Network</b>, reload.</li><li>Click any request to music.youtube.com → <b>Headers</b> → copy the <b>cookie</b> value (or export cookies.txt with a cookies extension).</li><li>Paste it below.</li></ol>
          <textarea className="cookie-box" rows={3} placeholder="Paste cookie header or cookies.txt contents" value={ck} onChange={(e) => setCk(e.target.value)} />
          <div className="actions"><button className="pill solid" disabled={acct.busy || !ck.trim()} onClick={() => connectCookie(ck).then(() => setCk(''))}>{acct.busy ? 'Connecting…' : 'Connect'}</button></div></>}
      {acct.error && <p className="bad">{acct.error}</p>}</section>
    <section className="panel"><h3>Listen Together</h3>
      {tg.role === 'none' ? <>
        <p className="muted">Listen in sync with a friend. The host chooses the music; guests follow along.</p>
        <div className="actions"><button className="pill solid" disabled={tg.busy} onClick={createRoom}>Start a room</button></div>
        <div className="newpl joinrow"><input placeholder="Room code" value={join} maxLength={8} onChange={(e) => setJoin(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && joinRoom(join)} /><button onClick={() => joinRoom(join)}>Join</button></div></>
        : <><p className="muted">{tg.role === 'host' ? 'You are the host. Share this code:' : 'You are listening along. Room code:'}</p><div className="bigcode">{tg.code}</div>
          <p className="muted">{Math.max(0, tg.n - (tg.role === 'host' ? 1 : 0))} {tg.role === 'host' ? 'listening' : 'others here'}</p>
          <div className="actions"><button className="pill" onClick={() => navigator.clipboard?.writeText(tg.code)}>Copy code</button><button className="pill" onClick={leaveRoom}>{tg.role === 'host' ? 'End room' : 'Leave'}</button></div></>}
      {tg.error && <p className="bad">{tg.error}</p>}</section>
    <section className="panel"><h3>Audio quality</h3>
      <p className="muted">Streaming quality. YouTube Music tops out around 256 kbps AAC (Premium account) or 160 kbps Opus, with no lossless or hi-res audio. Pick the quality for a download from a song's ⋮ menu → Download.</p>
      <div className="presets">{PRESETS.map((q) => <button key={q.id} title={q.desc} className={`chip${sq === q.id ? ' sel' : ''}`} onClick={() => setStreamQuality(q.id)}>{q.label}</button>)}</div>
      <p className="muted small">{PRESETS.find((q) => q.id === sq)?.desc}. The 256 kbps stream needs a Premium account: start the server with YT_COOKIES_BROWSER=firefox (or YT_COOKIES_FILE).</p></section>
    <section className="panel"><h3>Equalizer</h3>
      <label className="switch"><input type="checkbox" checked={eq.on} onChange={(e) => setEq({ on: e.target.checked })} /><span>{eq.on ? 'On' : 'Off'}</span></label>
      <div className="presets">{Object.keys(EQ_PRESETS).map((n) => <button key={n} className={`chip${EQ_PRESETS[n].every((g, i) => g === eq.gains[i]) ? ' sel' : ''}`} onClick={() => setEq({ on: true, gains: EQ_PRESETS[n] })}>{n}</button>)}</div>
      {BANDS.map((f, i) => <label className="band" key={f}><span>{f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}</span>
        <input type="range" min={-12} max={12} step={1} value={eq.gains[i]} onChange={(e) => { const g = [...eq.gains]; g[i] = +e.target.value; setEq({ on: true, gains: g }); }} /><em>{eq.gains[i] > 0 ? '+' : ''}{eq.gains[i]} dB</em></label>)}</section>
    <section className="panel"><h3>Offline downloads</h3><p className="muted">{dls.length} {dls.length === 1 ? 'song' : 'songs'} saved · {mb} MB. Use a song's ⋮ menu → Download for offline.</p>
      {dls.length > 0 && <div className="actions"><button className="pill" onClick={() => { if (confirm('Remove all downloaded songs?')) clearDownloads(); }}>Remove all downloads</button></div>}</section>
    <section className="panel"><h3>Theme colour</h3><div className="swatches">{SEEDS.map(([n, c]) => <button key={c} title={n} aria-label={n} className={s.seed === c ? 'on' : ''} style={{ background: c }} onClick={() => setSetting({ seed: c })} />)}</div></section>
    <section className="panel"><h3>Appearance</h3>{seg(['system', 'light', 'dark'] as const, s.mode, (mode) => setSetting({ mode }))}</section>
    <section className="panel"><h3>Player style</h3>{seg(['apple', 'material'] as const, p.style, setStyle)}</section>
    <section className="panel"><h3>Keyboard shortcuts</h3><dl className="keys"><dt>Space</dt><dd>Play / pause</dd><dt>Shift + ← / →</dt><dd>Previous / next song</dd><dt>Esc</dt><dd>Close the player</dd></dl></section>
    <section className="panel"><h3>Your data</h3><p className="muted">{lib.liked.length} liked songs · {lib.history.length} recently played. Stored in this browser only.</p>
      <div className="actions"><button className="pill" onClick={clearHistory}>Clear history</button><button className="pill" onClick={clearLiked}>Clear liked songs</button></div></section>
    <section className="panel"><h3>About</h3><p className="muted">Echo Music Web, a browser and installable-app port of the open-source Echo Music for Android (GPL-3.0).</p></section>
  </div>);
}

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const p = usePlayer(); const it = p.queue[p.index]; const top = useNav().at(-1); const tg = useTogether();
  useEffect(() => { refreshAccount(); }, []);
  useEffect(() => { // desktop shortcuts: Space play/pause, Shift+←/→ prev/next, Esc closes player
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|TEXTAREA|BUTTON/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.shiftKey && e.key === 'ArrowRight') next(); else if (e.shiftKey && e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') openPlayer(false);
    };
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, []);
  const go = (t: Tab) => { setTab(t); resetNav(); };
  const tabs = () => TABS.map((t) => (
    <button key={t.id} className="tab" aria-current={!top && tab === t.id} aria-label={t.label} onClick={() => go(t.id)}><Icon n={t.icon} /><span>{t.label}</span></button>));
  const C = 2 * Math.PI * 26; const pr = p.dur ? p.pos / p.dur : 0;
  return (<>
    <nav className="rail glass">{tabs()}</nav>
    <main className="app"><div className="content">
      {top ? <Detail key={top.kind + top.id} v={top} /> : (<>
        <header className="header"><h1>{tab === 'home' ? 'Echo Music' : TABS.find((t) => t.id === tab)!.label}</h1>
          {tg.role !== 'none' && <button className="pill live" onClick={() => go('settings')}>● Together · {tg.code}</button>}
          <button className="icon-btn" aria-label="Listen together" onClick={() => go('settings')}><Icon n="group" /></button>
          <button className="icon-btn" aria-label="History" onClick={() => go('library')}><Icon n="history" /></button>
          <button className="icon-btn avatar" aria-label="Settings" onClick={() => go('settings')}><Icon n="palette" /></button>
        </header>
        <div className="view" key={tab}>
          {tab === 'home' && <HomeScreen />}{tab === 'search' && <SearchScreen />}{tab === 'library' && <Library />}{tab === 'settings' && <SettingsPage />}
        </div>
      </>)}
    </div></main>
    <div className="dock">
      {p.toast && <div className="toast glass">{p.toast}</div>}
      {it && <div className="mini glass">
        <button className="mini-main" onClick={() => openPlayer(true)}>
          <span className="ring"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" className="trk" /><circle cx="28" cy="28" r="26" className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - pr)} /></svg>
            <Cover src={it.thumb} size={160} title={it.title} className={`mc${p.playing ? ' spin' : ''}`} /></span>
          <span className="t"><b>{it.title}</b><small className={p.error ? 'bad' : 'muted'}>{p.error || (p.loading ? 'Loading…' : it.subtitle)}</small></span></button>
        <Heart it={it} />
        <button className="icon-btn" onClick={prev} aria-label="Previous"><Icon n="prev" /></button>
        <Cookie playing={p.playing} onClick={toggle} size={52} />
        <button className="icon-btn" onClick={() => next()} aria-label="Next"><Icon n="next" /></button>
      </div>}
      <nav className="tabs glass">{tabs()}</nav>
    </div>
    <FullPlayer />
  </>);
}
