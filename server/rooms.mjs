// Listen Together: in-memory rooms over Server-Sent Events. The host posts playback state; guests follow it.
import { randomBytes } from 'node:crypto';
const rooms = new Map(); // code -> { hostKey, clients:Set<res>, state, touched }
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from(randomBytes(6), (b) => ALPHA[b % ALPHA.length]).join(''); } while (rooms.has(c)); return c; };
const send = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (r, ev, data) => { for (const c of r.clients) send(c, ev, data); };
const VID = /^[\w-]{11}$/;

export function registerRooms(app) {
  const room = (req) => rooms.get(String(req.params.code ?? '').toUpperCase());

  app.post('/api/room/create', (_req, res) => {
    const code = newCode(); const hostKey = randomBytes(12).toString('hex');
    rooms.set(code, { hostKey, clients: new Set(), state: null, touched: Date.now() }); res.json({ code, hostKey });
  });

  app.get('/api/room/:code/exists', (req, res) => (room(req) ? res.json({ ok: true }) : res.status(404).json({ error: 'Room not found. Check the code.' })));

  app.get('/api/room/:code/events', (req, res) => {
    const r = room(req); if (!r) return res.status(404).json({ error: 'Room not found. Check the code.' });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders?.();
    r.clients.add(res); r.touched = Date.now();
    send(res, 'hello', { n: r.clients.size }); if (r.state) send(res, 'state', { ...r.state, serverNow: Date.now() });
    broadcast(r, 'listeners', { n: r.clients.size });
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); r.clients.delete(res); broadcast(r, 'listeners', { n: r.clients.size }); });
  });

  app.post('/api/room/:code/state', (req, res) => {
    const r = room(req); const b = req.body ?? {};
    if (!r || b.hostKey !== r.hostKey) return res.status(403).json({ error: 'Not the host' });
    const it = b.item; if (!it || typeof it.id !== 'string' || !VID.test(it.id)) return res.status(400).json({ error: 'Bad track' });
    r.state = { item: { id: it.id, title: String(it.title ?? '').slice(0, 200), subtitle: String(it.subtitle ?? '').slice(0, 200), thumb: typeof it.thumb === 'string' ? it.thumb : undefined },
      pos: Math.max(0, +b.pos || 0), playing: !!b.playing, at: Date.now() };
    r.touched = Date.now(); broadcast(r, 'state', { ...r.state, serverNow: Date.now() }); res.json({ ok: true });
  });

  app.post('/api/room/:code/close', (req, res) => {
    const r = room(req); if (!r || req.body?.hostKey !== r.hostKey) return res.status(403).json({ error: 'Not the host' });
    broadcast(r, 'closed', {}); for (const c of r.clients) c.end(); rooms.delete(String(req.params.code).toUpperCase()); res.json({ ok: true });
  });

  setInterval(() => { for (const [c, r] of rooms) if (!r.clients.size && Date.now() - r.touched > 6 * 3600e3) rooms.delete(c); }, 10 * 60e3).unref();
}
