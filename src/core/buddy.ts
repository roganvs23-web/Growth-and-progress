// Buddy mode helpers. The server only ever sees a nickname, the current
// streak and whether today is a good day yet (see server/src/buddy.ts).
import type { DailyHealth, DayKey, Logs, Plan } from './types';
import { computeStreak } from './progress';

export interface BuddyLink {
  token: string;
  name: string;
  /** Set while the invite is open and nobody has joined yet. */
  code?: string;
  buddy?: BuddyStatus;
  lastSync?: string;
}

export interface BuddyStatus {
  name: string;
  streak: number;
  todayDone: boolean;
  day?: DayKey;
  updatedAt: number;
}

/** What gets sent: nothing else leaves the phone for buddy mode. */
export function myBuddyStatus(plan: Plan, logs: Logs, health: Record<DayKey, DailyHealth>, today: DayKey) {
  const s = computeStreak(plan, logs, health, today);
  const last = s.days[s.days.length - 1];
  return { streak: s.current, todayDone: last?.day === today && last.outcome === 'hit', day: today };
}

/** A short line about the buddy's day. Their "today" may be a different date across time zones. */
export function buddyLine(b: BuddyStatus, today: DayKey): string {
  const streak = b.streak === 1 ? '1-day streak' : `${b.streak}-day streak`;
  if (b.day !== today) return `${streak}. Hasn't opened Momentum today yet.`;
  return b.todayDone ? `${streak}. Today is already a good day.` : `${streak}. Still working on today.`;
}

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
