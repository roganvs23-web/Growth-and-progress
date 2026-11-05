// Habit completion, readiness, and streaks with recovery days.
//
// Streak rules (the "forgiving streak"):
//  - A day is a HIT when the share of habits done reaches plan.dayThreshold.
//  - A planned rest day spends one recovery day and keeps the streak alive.
//  - A missed day when readiness was low (body needed rest) is a free rest day.
//  - Any other missed day spends a banked recovery day if one is left.
//  - Only a miss with no recovery days left breaks the streak.
//  - You start with 1 recovery day and earn 1 more for every 6 hits, banking at most 2.
import type { DailyHealth, DayKey, DayLog, DayOutcome, Habit, Logs, Plan } from './types';
import { addDays, daysBetween } from './dates';

export const LOW_READINESS = 40;
export const MAX_RECOVERY = 2;
export const START_RECOVERY = 1;
export const HITS_PER_RECOVERY = 6;

export function emptyLog(): DayLog {
  return { taps: {}, counts: {} };
}

export function isHabitDone(h: Habit, log: DayLog | undefined, health: DailyHealth | undefined): boolean {
  const s = h.source;
  if (s.kind === 'tap') return !!log?.taps[h.id];
  if (s.kind === 'counter') {
    const v = log?.counts[h.id];
    if (s.comparator === 'atLeast') return (v ?? 0) >= s.target;
    // "atMost" habits (stay under a limit) only count once the user has logged the day.
    return v !== undefined && v <= s.target;
  }
  const v = health?.[s.metric];
  if (v === undefined) return false;
  return s.comparator === 'atLeast' ? v >= s.target : v <= s.target;
}

export function completion(plan: Plan, log: DayLog | undefined, health: DailyHealth | undefined): { done: number; total: number; ratio: number } {
  const total = plan.habits.length;
  const done = plan.habits.filter((h) => isHabitDone(h, log, health)).length;
  return { done, total, ratio: total ? done / total : 0 };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * Readiness 0-100 from last night's sleep plus HRV and resting HR compared
 * with the previous 7 days. Returns undefined when the watch gave us nothing.
 */
export function readiness(day: DayKey, history: Record<DayKey, DailyHealth>): number | undefined {
  const today = history[day];
  if (!today) return undefined;
  const prior = Array.from({ length: 7 }, (_, i) => history[addDays(day, -(i + 1))]).filter(Boolean) as DailyHealth[];
  const parts: { score: number; weight: number }[] = [];

  if (today.sleepHours !== undefined) parts.push({ score: clamp((today.sleepHours / 8) * 100), weight: 0.5 });

  const hrvBase = avg(prior.map((p) => p.hrvMs).filter((x): x is number => x !== undefined));
  if (today.hrvMs !== undefined && hrvBase) parts.push({ score: clamp(70 + ((today.hrvMs - hrvBase) / hrvBase) * 150), weight: 0.3 });

  const hrBase = avg(prior.map((p) => p.restingHR).filter((x): x is number => x !== undefined));
  if (today.restingHR !== undefined && hrBase) parts.push({ score: clamp(70 - ((today.restingHR - hrBase) / hrBase) * 300), weight: 0.2 });

  if (!parts.length) return undefined;
  const w = parts.reduce((a, p) => a + p.weight, 0);
  return Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / w);
}

export interface DayResult {
  day: DayKey;
  outcome: DayOutcome;
  ratio: number;
  /** Why the day was a rest day, if it was one. */
  restReason?: 'planned' | 'lowReadiness' | 'recoveryDay';
}

export interface StreakSummary {
  days: DayResult[];
  current: number;
  best: number;
  recoveryLeft: number;
  /** Hits still needed to earn the next recovery day (0 when the bank is full). */
  hitsToNextRecovery: number;
}

export function computeStreak(plan: Plan, logs: Logs, health: Record<DayKey, DailyHealth>, today: DayKey): StreakSummary {
  let bank = START_RECOVERY;
  let hitsSinceEarn = 0;
  let current = 0;
  let best = 0;
  const days: DayResult[] = [];

  const start = plan.createdAt <= today ? plan.createdAt : today;
  for (const day of daysBetween(start, today)) {
    const log = logs[day];
    const { ratio } = completion(plan, log, health[day]);
    const hit = ratio >= plan.dayThreshold - 1e-9;
    let r: DayResult;

    if (log?.plannedRest && bank > 0) {
      bank--;
      r = { day, outcome: 'rest', ratio, restReason: 'planned' };
    } else if (hit) {
      r = { day, outcome: 'hit', ratio };
    } else if (day === today) {
      r = { day, outcome: 'pending', ratio };
    } else if ((readiness(day, health) ?? 100) < LOW_READINESS) {
      r = { day, outcome: 'rest', ratio, restReason: 'lowReadiness' };
    } else if (bank > 0) {
      bank--;
      r = { day, outcome: 'rest', ratio, restReason: 'recoveryDay' };
    } else {
      r = { day, outcome: 'miss', ratio };
    }

    if (r.outcome === 'hit') {
      current++;
      best = Math.max(best, current);
      hitsSinceEarn++;
      if (hitsSinceEarn >= HITS_PER_RECOVERY) {
        hitsSinceEarn = 0;
        bank = Math.min(MAX_RECOVERY, bank + 1);
      }
    } else if (r.outcome === 'miss') {
      current = 0;
    }
    days.push(r);
  }

  return {
    days,
    current,
    best,
    recoveryLeft: bank,
    hitsToNextRecovery: bank >= MAX_RECOVERY ? 0 : HITS_PER_RECOVERY - hitsSinceEarn,
  };
}
