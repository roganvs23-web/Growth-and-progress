// Weekly check-in. We compute the numbers on the phone (cheap, private, exact)
// and send only this summary to the AI coach, which turns it into three
// bullets and up to two suggested plan changes the user can accept or skip.
// If the coach is unreachable, offlineCheckIn() gives a rule-based version.
import type { CheckIn, DailyHealth, DayKey, Logs, Plan, PlanChange } from './types';
import { addDays, daysBetween, weekStart } from './dates';
import { computeStreak, isHabitDone, slipTriggers } from './progress';

export interface WeekStats {
  weekOf: DayKey;
  days: number;
  hits: number;
  rests: number;
  misses: number;
  streak: number;
  recoveryLeft: number;
  habits: { id: string; name: string; doneDays: number; rate: number }[];
  avgSleep?: number;
  prevAvgSleep?: number;
  avgSteps?: number;
  prevAvgSteps?: number;
  /** Quit goals: what triggered slips this week, most common first. */
  slipTriggers: { trigger: string; count: number }[];
  /** Of the days with a slip, how many followed a short night (under 6.5h). */
  slipsAfterShortSleep: number;
  slipDays: number;
}

const mean = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};

/** Stats for the 7 days ending `today` (or since the plan began, if shorter). */
export function weekStats(plan: Plan, logs: Logs, health: Record<DayKey, DailyHealth>, today: DayKey): WeekStats {
  const from = [addDays(today, -6), plan.createdAt].sort()[1];
  const days = daysBetween(from, today);
  const prevDays = daysBetween(addDays(today, -13), addDays(today, -7));
  const streak = computeStreak(plan, logs, health, today);
  const inWeek = new Set(days);
  const results = streak.days.filter((d) => inWeek.has(d.day));

  return {
    weekOf: weekStart(today),
    days: days.length,
    hits: results.filter((d) => d.outcome === 'hit').length,
    rests: results.filter((d) => d.outcome === 'rest').length,
    misses: results.filter((d) => d.outcome === 'miss').length,
    streak: streak.current,
    recoveryLeft: streak.recoveryLeft,
    habits: plan.habits.map((h) => {
      const doneDays = days.filter((d) => isHabitDone(h, logs[d], health[d])).length;
      return { id: h.id, name: h.name, doneDays, rate: days.length ? doneDays / days.length : 0 };
    }),
    avgSleep: mean(days.map((d) => health[d]?.sleepHours)),
    prevAvgSleep: mean(prevDays.map((d) => health[d]?.sleepHours)),
    avgSteps: mean(days.map((d) => health[d]?.steps)),
    prevAvgSteps: mean(prevDays.map((d) => health[d]?.steps)),
    slipTriggers: slipTriggers(logs, from, today),
    slipDays: days.filter((d) => logs[d]?.slips?.length).length,
    slipsAfterShortSleep: days.filter((d) => logs[d]?.slips?.length && (health[d]?.sleepHours ?? 99) < 6.5).length,
  };
}

export function offlineCheckIn(plan: Plan, s: WeekStats): CheckIn {
  const bullets: string[] = [];
  const suggestions: PlanChange[] = [];

  if (s.avgSleep !== undefined) {
    const delta = s.prevAvgSleep !== undefined ? s.avgSleep - s.prevAvgSleep : undefined;
    bullets.push(
      `You averaged ${s.avgSleep.toFixed(1)}h of sleep` +
        (delta !== undefined && Math.abs(delta) >= 0.2 ? `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}h on last week.` : '.'),
    );
  }

  if (s.slipTriggers.length) {
    const top = s.slipTriggers[0];
    bullets.push(
      `Slips mostly came with "${top.trigger.toLowerCase()}" (${top.count}x).` +
        (s.slipsAfterShortSleep >= Math.max(1, Math.ceil(s.slipDays / 2)) ? ' Most followed a short night, so sleep is part of the plan.' : ' Plan one thing to do instead next time.'),
    );
  }

  const sorted = [...s.habits].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best) bullets.push(`Win: "${best.name}" on ${best.doneDays} of ${s.days} days. Streak is ${s.streak}.`);

  if (worst && worst.rate < 0.4 && plan.habits.length > 1) {
    bullets.push(`"${worst.name}" only happened ${worst.doneDays} times. Let's make it smaller, not drop it.`);
    const habit = plan.habits.find((h) => h.id === worst.id);
    if (habit && habit.source.kind !== 'tap') {
      const easier = { ...habit, source: { ...habit.source, target: easierTarget(habit.source.comparator, habit.source.target) } };
      suggestions.push({ summary: `Make "${habit.name}" easier for a week`, removeHabitIds: [habit.id], addHabits: [easier] });
    }
  } else if (s.hits >= s.days - 1 && s.days >= 5) {
    bullets.push('You hit almost every day. Ready for a small step up?');
  } else {
    bullets.push(`${s.hits} good days, ${s.rests} rest days. Keep the same plan next week.`);
  }

  return { weekOf: s.weekOf, bullets: bullets.slice(0, 3), suggestions, createdAt: new Date().toISOString(), source: 'offline' };
}

function easierTarget(cmp: 'atLeast' | 'atMost', t: number): number {
  if (cmp === 'atMost') return Math.ceil(t * 1.3);
  if (t >= 1000) return Math.round((t * 0.75) / 500) * 500;
  if (t <= 3) return Math.max(1, t - 1);
  return Math.round(t * 0.75 * 2) / 2;
}

export function applyPlanChange(plan: Plan, c: PlanChange): Plan {
  let habits = plan.habits.filter((h) => !(c.removeHabitIds ?? []).includes(h.id));
  for (const h of c.addHabits ?? []) {
    if (habits.length >= 8) break;
    habits = [...habits.filter((x) => x.id !== h.id), h];
  }
  if (!habits.length) habits = plan.habits;
  return { ...plan, habits, dayThreshold: c.dayThreshold ?? plan.dayThreshold };
}
