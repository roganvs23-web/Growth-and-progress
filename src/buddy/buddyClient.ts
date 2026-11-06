// Talks to the buddy endpoints on the Momentum server. Unlike the AI coach,
// buddy mode needs the server: with no server configured it is hidden.
import type { BuddyStatus } from '../core/buddy';

const BASE = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');
const KEY = process.env.EXPO_PUBLIC_COACH_KEY;
export const buddyAvailable = () => !!BASE;

export class BuddyError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!BASE) throw new BuddyError('Buddy mode needs the Momentum server.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/buddy/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(KEY ? { 'x-momentum-key': KEY } : {}) }, body: JSON.stringify(body), signal: ctl.signal });
  } catch {
    throw new BuddyError('Could not reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const code = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    const msg = code === 'not_found' ? "That code didn't work. Codes last 48 hours." : code === 'full' ? 'That code has already been used.' : code === 'rate_limited' ? 'Too many tries. Wait a minute.' : 'Something went wrong. Try again.';
    throw new BuddyError(msg, code);
  }
  return (await res.json()) as T;
}

export const createInvite = (name: string) => post<{ code: string; token: string }>('create', { name });
export const joinInvite = (code: string, name: string) => post<{ token: string; buddyName: string }>('join', { code, name });
export const syncBuddy = (token: string, status: { streak: number; todayDone: boolean; day: string }) =>
  post<{ code?: string; cheers: number; buddy: BuddyStatus | null }>('sync', { token, ...status });
export const sendCheer = (token: string) => post<{ ok: true }>('cheer', { token });
export const leaveBuddy = (token: string) => post<{ ok: true }>('leave', { token });
