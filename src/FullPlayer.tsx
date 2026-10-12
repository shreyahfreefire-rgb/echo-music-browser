import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, img, type Fmt, type Line, type Lyrics } from './api';
import { dominant } from './color';
import { Icon } from './icons';
import { PRESETS, label, setStreamQuality, useQuality } from './quality';
import { cycleRepeat, getTime, jump, next, openPlayer, prev, reloadCurrent, seek, setSleep, setSpeed, setStyle, setVolume, toggle, toggleShuffle, usePlayer } from './player';
import { Cookie, Cover, Heart } from './ui';

const useDesktop = () => {
  const [d, setD] = useState(() => matchMedia('(min-width:900px)').matches);
  useEffect(() => { const m = matchMedia('(min-width:900px)'); const f = () => setD(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return d;
};
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const url = (u?: string) => (u ? `url("${u}")` : 'none');

/** Songs with only line timing (LRCLIB): spread each line's duration over its words by length, so the glow still flows. */
const withWords = (lines: Line[], dur: number): Line[] => lines.map((l, i) => {
  if (l.words?.length || !l.text) return l;
  const nextT = lines[i + 1]?.t ?? (dur || l.t + 5); const toks = l.text.split(/\s+/).filter(Boolean); const wt = toks.map((x) => x.length + 1);
  const total = wt.reduce((a, b) => a + b, 0); const span = Math.max(0.8, Math.min(nextT - l.t - 0.08, total * 0.085)); let c = l.t;
  return { ...l, words: toks.map((x, k) => { const d = (span * wt[k]) / total; const w = { s: c, e: c + d, text: x, sp: k < toks.length - 1 }; c += d; return w; }) };
});

/** Word-by-word glow, driven per animation frame from the audio clock (not the 4 Hz timeupdate):
 *  --p = fill progress of the word, --g = glow (full while sung, fading ~0.9s after).
 *  Line behaviour ported from Lyrics.kt: active 100%/1.05x, others 50%, distance blur 0/0/2/4/6px, slow centring scroll, 64px edge fade. */
function LyricsView({ title, artist, dur }: { title: string; artist: string; dur: number }) {
  const [ly, setLy] = useState<Lyrics | null>(null); const [busy, setBusy] = useState(true); const [free, setFree] = useState(false); const [act, setAct] = useState(-1);
  const box = useRef<HTMLDivElement>(null); const raf = useRef(0); const hold = useRef(0); const durRef = useRef(dur); durRef.current = dur;
  useEffect(() => {
    let off = false; setLy(null); setBusy(true); setAct(-1);
    api.lyrics(title, artist, durRef.current).then((r) => !off && setLy(r)).catch(() => !off && setLy({ lines: [], plain: '' })).finally(() => !off && setBusy(false));
    return () => { off = true; };
  }, [title, artist]);
  const lines = useMemo(() => withWords(ly?.lines ?? [], dur), [ly, dur > 0]);
  useEffect(() => { // frame loop: current line + per-word fill/glow
    if (!lines.length) return; let id = 0, cur = -2;
    const tick = () => {
      const t = getTime(); let a = -1; for (let i = 0; i < lines.length && lines[i].t <= t; i++) a = i;
      if (a !== cur) { cur = a; setAct(a); }
      (box.current?.children[a] as HTMLElement | undefined)?.querySelectorAll<HTMLElement>('.w').forEach((w) => {
        const s = +w.dataset.s!, e = +w.dataset.e!; const p = Math.min(1, Math.max(0, (t - s) / Math.max(0.05, e - s)));
        w.style.setProperty('--p', ((p * 1.16 - 0.08) * 100).toFixed(1) + '%');
        w.style.setProperty('--g', (t < s ? 0 : t <= e ? 1 : Math.max(0, 1 - (t - e) / 0.9)).toFixed(2));
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, [lines]);
  useEffect(() => { // slow, spring-like scroll that centres the active line
    const c = box.current; const el = c?.children[act] as HTMLElement | undefined; if (!c || !el || free) return;
    const from = c.scrollTop, to = el.offsetTop - c.clientHeight / 2 + el.offsetHeight / 2, t0 = performance.now();
    const step = (n: number) => { const k = Math.min(1, (n - t0) / 1200); c.scrollTop = from + (to - from) * ease(k); if (k < 1) raf.current = requestAnimationFrame(step); };
    cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(step); return () => cancelAnimationFrame(raf.current);
  }, [act, free]);
  const pause = () => { setFree(true); clearTimeout(hold.current); hold.current = window.setTimeout(() => setFree(false), 4000); };
  if (busy) return <div className="p-panel dim"><span className="dots"><i /><i /><i /></span></div>;
  if (!lines.length) return <div className="p-panel plain">{ly?.plain || 'No lyrics found for this song.'}</div>;
  return (<div className="p-panel lyrics" ref={box} onWheel={pause} onTouchMove={pause}>
    {lines.map((l, i) => { const d = Math.abs(i - act); const b = free || act < 0 ? 0 : d <= 2 ? 0 : d === 3 ? 2 : d === 4 ? 4 : 6;
      return (<p key={i} className={`ly${i === act ? ' on' : ''}`} style={{ '--b': `${b}px` } as CSSProperties} onClick={() => seek(l.t)}>
        {l.words ? l.words.map((w, k) => <Fragment key={k}><span className="w" data-s={w.s} data-e={w.e}>{w.text}</span>{w.sp ? ' ' : ''}</Fragment>) : l.text}</p>); })}
  </div>);
}

/** Three blurred, slowly rotating copies of the cover (as in Player.kt) + dark overlay = full-screen colour wash. */
const Backdrop = ({ u }: { u?: string }) => (
  <div className="bd" key={u}>{['a', 'b', 'c'].map((k) => <i key={k} className={k} style={{ backgroundImage: url(u) }} />)}<u /></div>
);

export function FullPlayer() {
  const p = usePlayer(); const it = p.queue[p.index]; const desk = useDesktop();
  const [view, setView] = useState<'cover' | 'lyrics' | 'queue'>('cover'); const [accent, setAccent] = useState('#3a2a5a'); const [tools, setTools] = useState(false); const sq = useQuality().stream; const [fm, setFm] = useState<{ selected?: string; formats: Fmt[] } | null>(null);
  useEffect(() => { // the real formats YouTube offers for this song (loaded when the menu opens)
    if (!tools || !it) return; let off = false; setFm(null); api.formats(it.id, sq).then((r) => !off && setFm(r)).catch(() => !off && setFm({ formats: [] })); return () => { off = true; };
  }, [tools, it?.id, sq]);
  useEffect(() => { if (it?.thumb) dominant(img(it.thumb, 96)!).then((c) => c && setAccent(c)); }, [it?.thumb]);
  if (!p.open || !it) return null;
  const v = desk && view === 'cover' ? 'lyrics' : view; const showPanel = v !== 'cover';
  const apple = p.style === 'apple'; const showCover = !apple && (desk || !showPanel); const sharp = apple && (desk || !showPanel);
  const tog = (x: 'lyrics' | 'queue') => setView(desk ? x : view === x ? 'cover' : x);
  const hi = img(it.thumb, 1200); const pct = p.dur ? (p.pos / p.dur) * 100 : 0;
  return (
    <div className={`player ${p.style}${desk ? ' desk' : ''}`} style={{ '--accent': accent } as CSSProperties}>
      <Backdrop u={img(it.thumb, 256)} />
      {sharp && <div className="sharp" key={hi} style={{ backgroundImage: url(hi) }} />}
      <div className="p-top">
        <button className="icon-btn glass" onClick={() => openPlayer(false)} aria-label="Close"><Icon n="down" /></button>
        <div className="p-now"><small>Now Playing</small></div>
        <div className="mode glass">{(['apple', 'material'] as const).map((m) => <button key={m} className={p.style === m ? 'on' : ''} onClick={() => setStyle(m)}>{m}</button>)}</div>
        <button className={`icon-btn glass${v === 'queue' ? ' on' : ''}`} onClick={() => tog('queue')} aria-label="Queue"><Icon n="queue" /></button>
        <div className="pwrap"><button className={`icon-btn glass${tools || p.sleep || p.speed !== 1 ? ' on' : ''}`} onClick={() => setTools(!tools)} aria-label="Speed and sleep timer"><Icon n="more" /></button>
          {tools && <><div className="menu-back" onClick={() => setTools(false)} /><div className="pmenu">
            <h4>Playback speed</h4><div className="opts">{[0.75, 1, 1.25, 1.5, 2].map((r) => <button key={r} className={p.speed === r ? 'on' : ''} onClick={() => setSpeed(r)}>{r}×</button>)}</div>
            <h4>Stream quality</h4><div className="opts">{PRESETS.map((q) => <button key={q.id} title={q.desc} className={sq === q.id ? 'on' : ''} onClick={() => { setStreamQuality(q.id); reloadCurrent(); }}>{q.label}</button>)}</div>
            <p className="qinfo">{!fm ? 'Checking available formats…' : fm.formats.length ? <>{sq === 'auto' ? 'Auto starts the fastest stream. ' : `Now: ${label(fm.formats.find((f) => f.id === fm.selected) ?? fm.formats[0])}. `}Available: {[...new Set(fm.formats.map(label))].join(' · ')}</> : 'No format list for this song.'}</p>
            <h4>Sleep timer</h4><div className="opts">{([['Off', 0], ['15 min', 15], ['30 min', 30], ['60 min', 60], ['End of song', 'end']] as const).map(([l, m]) => (
              <button key={l} className={(m === 0 && !p.sleep) || p.sleep === (m === 'end' ? 'End of song' : `${m} min`) ? 'on' : ''} onClick={() => setSleep(m)}>{l}</button>))}</div>
          </div></>}
        </div>
      </div>
      {(desk || !showPanel) && <div className="stage">{showCover && <Cover className={`cover${p.playing ? '' : ' paused'}`} src={it.thumb} size={1000} title={it.title} />}</div>}
      {showPanel && v === 'lyrics' && <LyricsView title={it.title} artist={it.subtitle} dur={p.dur} />}
      {showPanel && v === 'queue' && <div className="p-panel queue">{p.queue.map((q, i) => (
        <button key={q.id + i} className={`qrow${i === p.index ? ' on' : ''}`} onClick={() => jump(i)}>
          <Cover src={q.thumb} size={96} title={q.title} className="qc" /><span className="t"><b>{q.title}</b><small>{q.subtitle}</small></span></button>))}</div>}
      <div className="p-bottom">
        <div className="p-meta">
          <div className="t"><div className="p-title">{it.title}</div><div className="p-artist">{it.subtitle}</div></div>
          <div className="split"><button className={v === 'lyrics' ? 'on' : ''} onClick={() => tog('lyrics')} aria-label="Lyrics"><Icon n="lyrics" /></button><Heart it={it} /></div>
        </div>
        {p.error && <div className="err">{p.error}</div>}
        <input className="seek" type="range" min={0} max={p.dur || 1} step={0.5} value={p.pos} style={{ '--pct': `${pct}%` } as CSSProperties} onChange={(e) => seek(+e.target.value)} aria-label="Seek" />
        <div className="p-times"><span>{fmt(p.pos)}</span><span>{fmt(p.dur)}</span></div>
        <div className="controls">
          <button className={`icon-btn sm${p.shuffle ? ' active' : ''}`} onClick={toggleShuffle} aria-label="Shuffle"><Icon n="shuffle" /></button>
          <button className="round-btn" onClick={prev} aria-label="Previous"><Icon n="prev" /></button>
          {apple ? <button className="plain-play" onClick={toggle} aria-label={p.playing ? 'Pause' : 'Play'}><Icon n={p.playing ? 'pause' : 'play'} /></button>
            : <Cookie playing={p.playing} onClick={toggle} size={desk ? 88 : 96} />}
          <button className="round-btn" onClick={() => next()} aria-label="Next"><Icon n="next" /></button>
          <button className={`icon-btn sm${p.repeat !== 'off' ? ' active' : ''}`} onClick={cycleRepeat} aria-label={`Repeat ${p.repeat}`}><Icon n="repeat" />{p.repeat === 'one' && <i className="one">1</i>}</button>
        </div>
        <label className="vol"><Icon n="volume" /><input className="seek thin" type="range" min={0} max={1} step={0.02} value={p.volume} style={{ '--pct': `${p.volume * 100}%` } as CSSProperties} onChange={(e) => setVolume(+e.target.value)} aria-label="Volume" /></label>
      </div>
    </div>);
}
