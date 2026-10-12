// YouTube Music account state (the sign-in itself happens on the server).
import { useSyncExternalStore } from 'react';
type A = { signedIn: boolean; busy: boolean; error: string };
let st: A = { signedIn: localStorage.getItem('ytSigned') === '1', busy: false, error: '' }; const subs = new Set<() => void>();
const set = (p: Partial<A>) => { st = { ...st, ...p }; localStorage.setItem('ytSigned', st.signedIn ? '1' : '0'); subs.forEach((f) => f()); };
export const useAccount = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => st);
export const refreshAccount = async () => { try { const j = await (await fetch('/api/auth/status')).json(); set({ signedIn: !!j.signedIn, error: j.error ?? '' }); } catch { /* server offline */ } };
export const connectCookie = async (cookie: string) => {
  set({ busy: true, error: '' });
  try {
    const r = await fetch('/api/auth/cookie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie }) }); const j = await r.json();
    if (!r.ok) throw new Error(j.error); set({ signedIn: true, busy: false });
  } catch (e) { set({ busy: false, error: String((e as Error).message) }); }
};
export const signOut = async () => { await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {}); set({ signedIn: false, busy: false, error: '' }); };
