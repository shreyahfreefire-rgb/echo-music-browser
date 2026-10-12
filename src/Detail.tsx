import { useEffect, useState } from 'react';
import { api, type Detail as D } from './api';
import { Icon } from './icons';
import { back, openItem, type View } from './nav';
import { play, playShuffled } from './player';
import { deletePlaylist, removeFromPlaylist, renamePlaylist, usePlaylists } from './playlists';
import { Cover, Row, Section } from './ui';

function RemoteDetail({ v }: { v: View }) {
  const [d, setD] = useState<D>(); const [err, setErr] = useState('');
  useEffect(() => { setD(undefined); setErr(''); api.detail(v.kind, v.id).then(setD).catch((e) => setErr(e.message)); }, [v.kind, v.id]);
  const all = d ? [...d.items, ...(d.sections ?? []).flatMap((s) => s.items.filter((i) => i.playable))] : [];
  return (<>
    <div className="detail-top"><button className="icon-btn glass" onClick={back} aria-label="Back"><Icon n="back" /></button></div>
    <div className="detail-head">
      <Cover className={`dcover${v.kind === 'artist' ? ' round' : ''}`} src={d?.thumb ?? d?.items.find((i) => i.thumb)?.thumb ?? v.thumb} size={600} title={d?.title || v.title} />
      <div><h1>{d?.title || v.title}</h1><p className="muted">{d?.subtitle}</p>
        {all.length > 0 && <div className="actions"><button className="pill solid" onClick={() => play(all, 0)}>▶ Play</button><button className="pill" onClick={() => playShuffled(all)}>Shuffle</button></div>}</div>
    </div>
    {err && <p className="muted pad">Couldn't load: {err}</p>}
    {!d && !err && <p className="muted pad">Loading…</p>}
    {d && d.items.length > 0 && <div className="list">{d.items.map((it, i) => <Row key={it.id + i} it={it} onPlay={() => openItem(d.items, i)} />)}</div>}
    {d?.sections?.map((s) => <Section key={s.title} title={s.title} items={s.items} max={6} />)}
  </>);
}

/** A playlist you created (stored in this browser). */
function LocalDetail({ v }: { v: View }) {
  const pl = usePlaylists().find((p) => p.id === v.id);
  const top = <div className="detail-top"><button className="icon-btn glass" onClick={back} aria-label="Back"><Icon n="back" /></button></div>;
  if (!pl) return <>{top}<p className="muted pad">This playlist was deleted.</p></>;
  return (<>{top}
    <div className="detail-head">
      <Cover className="dcover" src={pl.items.find((i) => i.thumb)?.thumb} size={600} title={pl.name} />
      <div><h1>{pl.name}</h1><p className="muted">{pl.items.length} {pl.items.length === 1 ? 'song' : 'songs'}</p>
        <div className="actions">
          {pl.items.length > 0 && <><button className="pill solid" onClick={() => play(pl.items, 0)}>▶ Play</button><button className="pill" onClick={() => playShuffled(pl.items)}>Shuffle</button></>}
          <button className="pill" onClick={() => { const n = prompt('Rename playlist', pl.name)?.trim(); if (n) renamePlaylist(pl.id, n); }}>Rename</button>
          <button className="pill" onClick={() => { if (confirm(`Delete "${pl.name}"?`)) { deletePlaylist(pl.id); back(); } }}>Delete</button>
        </div></div>
    </div>
    {pl.items.length === 0 ? <p className="muted pad">Empty. Add songs from any song's ⋮ menu → Add to playlist.</p>
      : <div className="list">{pl.items.map((it, i) => <Row key={it.id} it={it} onPlay={() => play(pl.items, i)} onRemove={() => removeFromPlaylist(pl.id, it.id)} />)}</div>}
  </>);
}

export function Detail({ v }: { v: View }) { return v.kind === 'local' ? <LocalDetail v={v} /> : <RemoteDetail v={v} />; }
