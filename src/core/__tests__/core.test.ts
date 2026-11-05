import { addDays, daysBetween, weekStart } from '../dates';
import { guessPath, planFromTemplate } from '../templates';
import { computeStreak, isHabitDone, LOW_READINESS, readiness, START_RECOVERY, withCheckIns } from '../progress';
import { applyPlanChange, offlineCheckIn, weekStats } from '../checkin';
import type { DailyHealth, Logs, Plan } from '../types';

const START = '2026-11-02'; // a Monday

function tapPlan(): Plan {
  return {
    path: 'custom', goal: 'Read more', why: '', createdAt: START, dayThreshold: 1, nudges: [],
    habits: [{ id: 'read', name: 'Read 10 pages', detail: '', source: { kind: 'tap' } }],
  };
}

function logsFor(pattern: string): Logs {
  // pattern like "HHxHR": H = tapped, x = missed, R = planned rest
  const logs: Logs = {};
  [...pattern].forEach((c, i) => {
    const day = addDays(START, i);
    logs[day] = { taps: { read: c === 'H' }, counts: {}, plannedRest: c === 'R' };
  });
  return logs;
}

describe('dates', () => {
  test('daysBetween and weekStart', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });
});

describe('templates', () => {
  test('guessPath picks the right launch path', () => {
    expect(guessPath('I want to cut back on vaping')).toBe('quit');
    expect(guessPath('Run a 5k by spring')).toBe('fitness');
    expect(guessPath('Focus when I study')).toBe('focus');
    expect(guessPath('Learn guitar')).toBe('custom');
  });
  test('planFromTemplate copies habits so plans do not share state', () => {
    const a = planFromTemplate('fitness', '', '', START);
    const b = planFromTemplate('fitness', '', '', START);
    (a.habits[0].source as { target: number }).target = 1;
    expect((b.habits[0].source as { target: number }).target).toBe(8000);
  });
});

describe('habits', () => {
  test('watch, counter and limit habits', () => {
    const plan = planFromTemplate('quit', 'x', '', START);
    const limit = plan.habits.find((h) => h.id === 'uses')!;
    const walk = plan.habits.find((h) => h.id === 'walk')!;
    expect(isHabitDone(limit, undefined, undefined)).toBe(false); // not logged yet
    expect(isHabitDone(limit, { taps: {}, counts: { uses: 3 } }, undefined)).toBe(true);
    expect(isHabitDone(limit, { taps: {}, counts: { uses: 7 } }, undefined)).toBe(false);
    expect(isHabitDone(walk, undefined, { day: START, steps: 6500 })).toBe(true);
    expect(isHabitDone(walk, undefined, { day: START })).toBe(false);
  });
});

describe('streaks with recovery days', () => {
  test('one miss is covered by the starting recovery day', () => {
    const s = computeStreak(tapPlan(), logsFor('HHxHH'), {}, addDays(START, 4));
    expect(s.days.map((d) => d.outcome)).toEqual(['hit', 'hit', 'rest', 'hit', 'hit']);
    expect(s.current).toBe(4);
    expect(s.recoveryLeft).toBe(START_RECOVERY - 1);
  });

  test('second miss with no recovery left breaks the streak', () => {
    const s = computeStreak(tapPlan(), logsFor('HxHxHH'), {}, addDays(START, 5));
    expect(s.days.map((d) => d.outcome)).toEqual(['hit', 'rest', 'hit', 'miss', 'hit', 'hit']);
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });

  test('six hits earn another recovery day, capped at 2', () => {
    const s = computeStreak(tapPlan(), logsFor('HHHHHHHHHHHHH'), {}, addDays(START, 12));
    expect(s.recoveryLeft).toBe(2);
    expect(s.hitsToNextRecovery).toBe(0);
  });

  test('low readiness turns a miss into a free rest day', () => {
    const health: Record<string, DailyHealth> = {};
    for (let i = -7; i < 3; i++) health[addDays(START, i)] = { day: addDays(START, i), sleepHours: 7.5, hrvMs: 50, restingHR: 60 };
    health[addDays(START, 1)] = { day: addDays(START, 1), sleepHours: 3, hrvMs: 30, restingHR: 70 };
    expect(readiness(addDays(START, 1), health)!).toBeLessThan(40);
    const s = computeStreak(tapPlan(), logsFor('Hx'), health, addDays(START, 2));
    expect(s.days[1]).toMatchObject({ outcome: 'rest', restReason: 'lowReadiness' });
    expect(s.recoveryLeft).toBe(START_RECOVERY); // not spent
  });

  test('today is pending, not a miss', () => {
    const s = computeStreak(tapPlan(), logsFor('Hx'), {}, addDays(START, 1));
    expect(s.days[1].outcome).toBe('pending');
    expect(s.current).toBe(1);
  });

  test('planned rest spends a recovery day', () => {
    const s = computeStreak(tapPlan(), logsFor('HRH'), {}, addDays(START, 2));
    expect(s.days[1]).toMatchObject({ outcome: 'rest', restReason: 'planned' });
    expect(s.recoveryLeft).toBe(0);
  });
});

describe('weekly check-in', () => {
  test('offline check-in finds the weak habit and suggests an easier target', () => {
    const plan = planFromTemplate('fitness', 'Run a 5k', '', START);
    const health: Record<string, DailyHealth> = {};
    const logs: Logs = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(START, i);
      health[d] = { day: d, steps: 9000, sleepHours: 7.2, workoutMinutes: i === 2 ? 30 : 0 };
      logs[d] = { taps: {}, counts: { water: 6 } };
    }
    const stats = weekStats(plan, logs, health, addDays(START, 6));
    expect(stats.days).toBe(7);
    const ci = offlineCheckIn(plan, stats);
    expect(ci.bullets.length).toBe(3);
    expect(ci.suggestions[0].summary).toContain('20 min workout');
    const next = applyPlanChange(plan, ci.suggestions[0]);
    const w = next.habits.find((h) => h.id === 'workout20')!;
    expect((w.source as { target: number }).target).toBe(15);
    expect(next.habits.length).toBe(plan.habits.length);
  });
});

describe('phone-only mode (no watch)', () => {
  test('morning check-in fills in sleep, but measured sleep wins', () => {
    const logs: Logs = {
      [START]: { taps: {}, counts: {}, morning: { sleepHours: 6, feel: 4 } },
      [addDays(START, 1)]: { taps: {}, counts: {}, morning: { sleepHours: 5, feel: 2 } },
    };
    const health: Record<string, DailyHealth> = { [addDays(START, 1)]: { day: addDays(START, 1), sleepHours: 7.8, steps: 4000 } };
    const merged = withCheckIns(health, logs);
    expect(merged[START]).toEqual({ day: START, sleepHours: 6, feel: 4 });
    expect(merged[addDays(START, 1)]).toMatchObject({ sleepHours: 7.8, steps: 4000, feel: 2 });
    expect(health[addDays(START, 1)].feel).toBeUndefined(); // input not mutated
  });

  test('readiness works from the check-in alone', () => {
    const great = readiness(START, { [START]: { day: START, sleepHours: 8, feel: 5 } })!;
    const rough = readiness(START, { [START]: { day: START, sleepHours: 5, feel: 1 } })!;
    expect(great).toBeGreaterThan(85);
    expect(rough).toBeLessThan(LOW_READINESS);
  });

  test('a watch habit with no reading can be ticked by hand; a reading overrides the tick', () => {
    const plan = planFromTemplate('fitness', '', '', START);
    const workout = plan.habits.find((h) => h.id === 'workout20')!;
    const log = { taps: { workout20: true }, counts: {} };
    expect(isHabitDone(workout, log, { day: START })).toBe(true);
    expect(isHabitDone(workout, log, { day: START, workoutMinutes: 5 })).toBe(false);
  });
});
