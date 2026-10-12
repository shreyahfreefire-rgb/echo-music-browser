import { useEffect, useRef, useState, type ReactNode } from 'react';
import { img, type Item } from './api';
import { Icon } from './icons';
import { toggleLike, useLib } from './lib';
import { openItem } from './nav';
import { PRESETS } from './quality';
import { downloadSong, removeDownload, useDownloads } from './offline';
import { addToPlaylist, createPlaylist, usePlaylists } from './playlists';
import { enqueue, notify, play, playNext } from './player';

/** Cover with graceful fallbacks: YouTube thumb → colour placeholder with initial. */
export function Cover({ src, size = 400, className = '', title = '' }: { src?: string; size?: number; className?: string; title?: string }) {
  const [bad, setBad] = useState(false); useEffect(() => setBad(false), [src]);
  const u = img(src, size);
  return u && !bad ? <img className={className} src={u} alt="" loading="lazy" onError={() => setBad(true)} />
    : <div className={`ph ${className}`} aria-hidden>{title.slice(0, 1).toUpperCase()}</div>;
}

export const Heart = ({ it }: { it: Item }) => {
  const on = useLib().liked.some((x) => x.id === it.id);
  return <button className={`icon-btn${on ? ' liked' : ''}`} aria-label={on ? 'Unlike' : 'Like'} onClick={(e) => { e.stopPropagation(); toggleLike(it); }}><Icon n={on ? 'heartOn' : 'heart'} /></button>;
};

/** Material-3 "cookie" (scalloped circle) used for the play button, as in the Android app. */
const COOKIE = (() => {
  let d = ''; for (let i = 0; i <= 120; i++) { const t = (i / 120) * Math.PI * 2, r = 48 * (1 + 0.07 * Math.cos(10 * t)) * 0.93;
    d += `${i ? 'L' : 'M'}${(50 + r * Math.cos(t)).toFixed(2)} ${(50 + r * Math.sin(t)).toFixed(2)}`; } return d + 'Z';
})();
export const Cookie = ({ playing, onClick, size = 76 }: { playing: boolean; onClick: () => void; size?: number }) => (
  <button className="cookie" style={{ width: size, height: size }} onClick={onClick} aria-label={playing ? 'Pause' : 'Play'}>
    <svg viewBox="0 0 100 100" className={`shape${playing ? ' spin' : ''}`}><path d={COOKIE} /></svg><span><Icon n={playing ? 'pause' : 'play'} /></span>
  </button>
);

export function Row({ it, onPlay, onRemove }: { it: Item; onPlay: () => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false); const [sub, setSub] = useState<'' | 'pl' | 'dl'>(''); const [nm, setNm] = useState('');
  const on = useLib().liked.some((x) => x.id === it.id); const pls = usePlaylists(); const has = useDownloads().some((d) => d.id === it.id);
  const act = (f: () => void) => () => { f(); setOpen(false); };
  const newPl = () => { const n = nm.trim(); if (!n) return; createPlaylist(n, it); notify(`Added to ${n}`); setNm(''); setOpen(false); };
  const dl = (q: string) => { notify('Downloading…'); downloadSong(it, q).then(() => notify('Saved for offline')).catch((e) => notify(String(e?.message ?? e))); };
  const rm = () => removeDownload(it.id).then(() => notify('Download removed'));
  return (<div className={`row${open ? ' menu-open' : ''}`} role="button" tabIndex={0} onClick={onPlay} onKeyDown={(e) => e.key === 'Enter' && onPlay()}>
    <Cover src={it.thumb} size={192} title={it.title} className="rc" />
    <span className="t"><b>{it.title}</b><small>{has && <span className="dl" title="Downloaded">⬇ </span>}{it.subtitle}</small></span>
    {it.playable && <button className="icon-btn" aria-label="More" onClick={(e) => { e.stopPropagation(); setSub(''); setOpen(!open); }}><Icon n="more" /></button>}
    {open && <><div className="menu-back" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
      <div className="menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {sub === '' && <>
          <button onClick={act(() => playNext(it))}>Play next</button><button onClick={act(() => enqueue(it))}>Add to queue</button>
          <button onClick={act(() => toggleLike(it))}>{on ? 'Remove from liked' : 'Add to liked'}</button>
          <button onClick={() => setSub('pl')}>Add to playlist…</button>
          {has ? <button onClick={act(rm)}>Remove download</button> : <button onClick={() => setSub('dl')}>Download…</button>}
          {onRemove && <button onClick={act(onRemove)}>Remove from this playlist</button>}
        </>}
        {sub === 'dl' && <>
          <button onClick={() => setSub('')}>‹ Back</button>
          {PRESETS.filter((q) => q.id !== 'auto').map((q) => <button key={q.id} onClick={act(() => dl(q.id))}>{q.label}<small>{q.desc}</small></button>)}
        </>}
        {sub === 'pl' && <>
          <button onClick={() => setSub('')}>‹ Back</button>
          {pls.map((pl) => <button key={pl.id} onClick={act(() => { addToPlaylist(pl.id, it); notify(`Added to ${pl.name}`); })}>{pl.name}</button>)}
          <div className="newpl"><input placeholder="New playlist" value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newPl()} /><button onClick={newPl}>Add</button></div>
        </>}
      </div></>}
  </div>);
}

/** Horizontal scroller with arrow buttons (mouse users can't swipe). */
export function Scroller({ cls, children }: { cls: string; children: ReactNode }) {
  const r = useRef<HTMLDivElement>(null);
  const go = (d: number) => r.current?.scrollBy({ left: d * r.current.clientWidth * 0.8, behavior: 'smooth' });
  return (<div className="scroller">
    <button className="scroll-btn l glass" onClick={() => go(-1)} aria-label="Scroll left">‹</button>
    <div ref={r} className={cls}>{children}</div>
    <button className="scroll-btn r glass" onClick={() => go(1)} aria-label="Scroll right">›</button>
  </div>);
}

/** Titled section: grouped song rows when mostly songs, otherwise cover cards that open detail pages. */
export function Section({ title, items, max = 8, i = 0 }: { title: string; items: Item[]; max?: number; i?: number }) {
  const songs = items.filter((x) => x.playable).length >= items.length / 2;
  return (<section className="rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
    <div className="section-head"><h2>{title}</h2>{songs && <button className="pill" onClick={() => play(items, 0)}>Play all</button>}</div>
    {songs ? <div className="list">{items.slice(0, max).map((it, k) => <Row key={it.id + k} it={it} onPlay={() => openItem(items, k)} />)}</div>
      : <Scroller cls="cards">{items.map((it, k) => (
          <button key={it.id + k} className="card" onClick={() => openItem(items, k)}>
            <Cover src={it.thumb} size={400} title={it.title} className={it.kind === 'artist' ? 'cc round' : 'cc'} /><b>{it.title}</b><small>{it.subtitle}</small></button>))}</Scroller>}
  </section>);
}
