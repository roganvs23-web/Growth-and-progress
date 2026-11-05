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
  // No measurement (no watch, or the watch missed it): the user can tick it by hand.
  if (v === undefined) return !!log?.taps[h.id];
  return s.comparator === 'atLeast' ? v >= s.target : v <= s.target;
}

/**
 * Watch data with the morning check-ins folded in. Measured sleep always wins
 * over self-reported sleep; "feel" only ever comes from the check-in.
 */
export function withCheckIns(health: Record<DayKey, DailyHealth>, logs: Logs): Record<DayKey, DailyHealth> {
  const out: Record<DayKey, DailyHealth> = { ...health };
  for (const [day, log] of Object.entries(logs)) {
    const m = log.morning;
    if (!m) continue;
    const h: DailyHealth = { ...(out[day] ?? { day }) };
    if (h.sleepHours === undefined && m.sleepHours !== undefined) h.sleepHours = m.sleepHours;
    h.feel = m.feel;
    out[day] = h;
  }
  return out;
}

export function completion(plan: Plan, log: DayLog | undefined, health: DailyHealth | undefined, day?: DayKey): { done: number; total: number; ratio: number } {
  const habits = day ? activeHabits(plan, day) : plan.habits;
  const total = habits.length;
  const done = habits.filter((h) => isHabitDone(h, log, health)).length;
  return { done, total, ratio: total ? done / total : 0 };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * Readiness 0-100 from last night's sleep, HRV and resting HR compared with
 * the previous 7 days, and how the user said they feel. Works with any subset:
 * with no watch, sleep and feel come from the morning check-in.
 * Returns undefined when there is nothing to go on.
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

  if (today.feel !== undefined) parts.push({ score: clamp(((today.feel - 1) / 4) * 100), weight: 0.4 });

  if (!parts.length) return undefined;
  const w = parts.reduce((a, p) => a + p.weight, 0);
  return Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / w);
}

export interface DayResult {
  day: DayKey;
  outcome: DayOutcome;
  ratio: number;
  /** Why the day was a rest day, if it was one. */
  restReason?: 'planned' | 'sick' | 'travel' | 'lowReadiness' | 'recoveryDay';
  /** The plan was lightened this day (bad night, sick, travel). */
  easy?: boolean;
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
  let best = plan.bestBeforeRestart ?? 0;
  const days: DayResult[] = [];

  const begin = plan.restartedAt && plan.restartedAt > plan.createdAt ? plan.restartedAt : plan.createdAt;
  const start = begin <= today ? begin : today;
  for (const day of daysBetween(start, today)) {
    const log = logs[day];
    const { ratio } = completion(plan, log, health[day], day);
    const easy = !!easyDayReason(day, health, logs);
    const hit = ratio >= dayThresholdFor(plan, easy, day) - 1e-9;
    let r: DayResult;

    if (log?.sick && !hit) {
      r = { day, outcome: 'rest', ratio, restReason: 'sick', easy };
    } else if (log?.travel && !hit) {
      r = { day, outcome: day === today ? 'pending' : 'rest', ratio, restReason: 'travel', easy };
    } else if (log?.plannedRest && bank > 0) {
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

    if (easy) r.easy = true;
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

export type EasyReason = 'sick' | 'travel' | 'lowReadiness' | 'feelingRough' | 'highRestingHR';

/**
 * Why today's plan should be lighter, or null. A bad night, feeling rough,
 * a resting heart rate well above normal (often the first sign of getting
 * sick), being sick, or traveling.
 */
export function easyDayReason(day: DayKey, health: Record<DayKey, DailyHealth>, logs: Logs): EasyReason | null {
  const log = logs[day];
  if (log?.sick) return 'sick';
  if (log?.travel) return 'travel';
  const h = health[day];
  if (h?.feel !== undefined && h.feel <= 1) return 'feelingRough';
  const r = readiness(day, health);
  if (r !== undefined && r < LOW_READINESS) return 'lowReadiness';
  if (h?.restingHR !== undefined) {
    const prior = Array.from({ length: 7 }, (_, i) => health[addDays(day, -(i + 1))]?.restingHR).filter((x): x is number => x !== undefined);
    if (prior.length >= 3) {
      const base = prior.reduce((a, b) => a + b, 0) / prior.length;
      if (h.restingHR >= base + 5) return 'highRestingHR';
    }
  }
  return null;
}

/** On an easy day, about half the usual habits make a good day (at least one). */
export function dayThresholdFor(plan: Plan, easy: boolean, day?: DayKey): number {
  if (!easy) return plan.dayThreshold;
  const n = (day ? activeHabits(plan, day) : plan.habits).length || 1;
  return Math.max(1 / n, Math.floor(plan.dayThreshold * n * 0.5) / n);
}

/** Days since the user last logged anything (tap, count, check-in, rest). */
export function daysAway(logs: Logs, today: DayKey): number | null {
  const active = Object.entries(logs)
    .filter(([d, l]) => d < today && (Object.values(l.taps).some(Boolean) || Object.keys(l.counts).length || l.morning || l.plannedRest || l.sick || l.travel))
    .map(([d]) => d)
    .sort();
  const last = active[active.length - 1];
  if (!last) return null;
  return daysBetween(last, today).length - 1;
}

/** A fresh start after time away: keep history and the best streak, count from today. */
export function freshStart(plan: Plan, logs: Logs, health: Record<DayKey, DailyHealth>, today: DayKey): Plan {
  const s = computeStreak(plan, logs, health, today);
  return { ...plan, restartedAt: today, bestBeforeRestart: s.best };
}

/** Slip-up triggers in a date range, most common first. */
export function slipTriggers(logs: Logs, from: DayKey, to: DayKey): { trigger: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const d of daysBetween(from, to)) for (const t of logs[d]?.slips ?? []) counts[t] = (counts[t] ?? 0) + 1;
  return Object.entries(counts).map(([trigger, count]) => ({ trigger, count })).sort((a, b) => b.count - a.count);
}

/** Is exam or deadline mode on for this day? */
export function crunchOn(plan: Plan, day: DayKey): boolean {
  return !!plan.crunch && day >= plan.crunch.startedAt && day <= plan.crunch.until;
}

/**
 * The habits that count toward this day. In exam or deadline mode only the
 * crunch goal's habits and sleep count; the rest become optional.
 */
export function activeHabits(plan: Plan, day: DayKey): Habit[] {
  if (!crunchOn(plan, day)) return plan.habits;
  const c = plan.crunch!;
  const keep = plan.habits.filter((h) => (h.goalId ?? 'main') === c.goalId || (h.source.kind === 'watch' && h.source.metric === 'sleepHours'));
  return keep.length ? keep : plan.habits;
}
