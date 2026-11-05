// Talks to the Stride coach server (see /server). The Claude API key lives
// only on the server; the phone never holds it. Every call has an offline
// fallback so the app still works with no network or no server configured.
import type { CheckIn, CoachMessage, DailyHealth, GoalPath, Habit, Plan, PlanChange } from '../core/types';
import type { WeekStats } from '../core/checkin';
import { offlineCheckIn } from '../core/checkin';

const BASE = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');

export const coachAvailable = () => !!BASE;

export class CoachError extends Error {}

async function post<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  if (!BASE) throw new CoachError('Coach server is not configured.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) throw new CoachError(res.status === 429 ? 'The coach is busy. Try again in a minute.' : 'The coach could not answer. Try again.');
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof CoachError) throw e;
    throw new CoachError('Could not reach the coach. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

export interface OnboardTurn {
  message: string;
  done: boolean;
}

const OFFLINE_QUESTIONS = [
  'Why does this goal matter to you right now?',
  'What does a normal weekday look like for you?',
  'What got in the way the last time you tried?',
];

export async function onboardTurn(goal: string, path: GoalPath, transcript: CoachMessage[], health: DailyHealth[]): Promise<OnboardTurn> {
  if (!BASE) {
    const asked = transcript.filter((m) => m.role === 'assistant').length;
    return asked < OFFLINE_QUESTIONS.length
      ? { message: OFFLINE_QUESTIONS[asked], done: false }
      : { message: 'Thanks, that gives me enough to build your plan.', done: true };
  }
  return post<OnboardTurn>('/v1/onboard', { goal, path, transcript, health });
}

export interface PlanDraft {
  goal: string;
  why: string;
  habits: Habit[];
  dayThreshold: number;
  nudges: string[];
}

/** Returns null when offline, so the caller keeps the template plan. */
export async function buildPlan(goal: string, path: GoalPath, transcript: CoachMessage[], health: DailyHealth[], template: Plan): Promise<PlanDraft | null> {
  if (!BASE) return null;
  return post<PlanDraft>('/v1/plan', { goal, path, transcript, health, template }, 90000);
}

export interface ChatReply {
  reply: string;
  changes: PlanChange | null;
}

export async function chat(plan: Plan, health: DailyHealth[], messages: CoachMessage[]): Promise<ChatReply> {
  if (!BASE) {
    return { reply: 'I can only chat when the coach server is connected. Your plan, streaks and weekly check-ins still work offline.', changes: null };
  }
  const history = messages.filter((m) => m.role !== 'note').slice(-16);
  return post<ChatReply>('/v1/chat', { plan, health, messages: history });
}

export async function weeklyCheckIn(plan: Plan, stats: WeekStats): Promise<CheckIn> {
  if (!BASE) return offlineCheckIn(plan, stats);
  try {
    const r = await post<{ bullets: string[]; suggestions: PlanChange[] }>('/v1/checkin', { plan, stats });
    return { weekOf: stats.weekOf, bullets: r.bullets, suggestions: r.suggestions, createdAt: new Date().toISOString(), source: 'ai' };
  } catch {
    return offlineCheckIn(plan, stats);
  }
}
