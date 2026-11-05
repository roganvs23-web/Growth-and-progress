import { addDays } from '../dates';
import { planFromTemplate } from '../templates';
import { computeStreak, dayThresholdFor, daysAway, easyDayReason, freshStart, slipTriggers } from '../progress';
import { offlineCheckIn, weekStats } from '../checkin';
import type { DailyHealth, Logs, Plan } from '../types';

const START = '2026-11-02';
const d = (i: number) => addDays(START, i);

function threeHabitPlan(): Plan {
  return {
    path: 'custom', goal: 'x', why: '', createdAt: START, dayThreshold: 1, nudges: [],
    habits: ['a', 'b', 'c'].map((id) => ({ id, name: id, detail: '', source: { kind: 'tap' as const } })),
  };
}
const taps = (...ids: string[]) => ({ taps: Object.fromEntries(ids.map((i) => [i, true])), counts: {} });

describe('bad day and sick mode', () => {
  test('feeling rough lightens the day: one habit of three is enough', () => {
    const plan = threeHabitPlan();
    const logs: Logs = { [d(0)]: { ...taps('a'), morning: { feel: 1 } } };
    expect(easyDayReason(d(0), { [d(0)]: { day: d(0), feel: 1 } }, logs)).toBe('feelingRough');
    const s = computeStreak(plan, logs, { [d(0)]: { day: d(0), feel: 1 } }, d(1));
    expect(s.days[0]).toMatchObject({ outcome: 'hit', easy: true });
  });

  test('resting heart rate 5+ above normal is flagged', () => {
    const health: Record<string, DailyHealth> = {};
    for (let i = 0; i < 7; i++) health[d(i)] = { day: d(i), restingHR: 60 };
    health[d(7)] = { day: d(7), restingHR: 67, sleepHours: 8 };
    expect(easyDayReason(d(7), health, {})).toBe('highRestingHR');
  });

  test('a sick day is a free rest day and does not spend a recovery day', () => {
    const plan = threeHabitPlan();
    const logs: Logs = { [d(0)]: taps('a', 'b', 'c'), [d(1)]: { ...taps(), sick: true }, [d(2)]: taps('a', 'b', 'c') };
    const s = computeStreak(plan, logs, {}, d(2));
    expect(s.days[1]).toMatchObject({ outcome: 'rest', restReason: 'sick' });
    expect(s.recoveryLeft).toBe(1);
    expect(s.current).toBe(2);
  });

  test('easy-day threshold never drops below one habit', () => {
    const plan = { ...threeHabitPlan(), dayThreshold: 0.34 };
    expect(dayThresholdFor(plan, true)).toBeCloseTo(1 / 3);
  });
});

describe('travel mode', () => {
  test('missed travel days are free', () => {
    const plan = threeHabitPlan();
    const logs: Logs = { [d(0)]: taps('a', 'b', 'c'), [d(1)]: { ...taps(), travel: true }, [d(2)]: { ...taps(), travel: true }, [d(3)]: taps('a', 'b', 'c') };
    const s = computeStreak(plan, logs, {}, d(3));
    expect(s.days.map((x) => x.outcome)).toEqual(['hit', 'rest', 'rest', 'hit']);
    expect(s.recoveryLeft).toBe(1);
  });
});

describe('welcome back', () => {
  test('daysAway counts from the last active day', () => {
    const logs: Logs = { [d(0)]: taps('a'), [d(1)]: taps() };
    expect(daysAway(logs, d(6))).toBe(6);
    expect(daysAway({}, d(6))).toBeNull();
  });

  test('a fresh start counts from today and keeps the best streak', () => {
    const plan = threeHabitPlan();
    const logs: Logs = { [d(0)]: taps('a', 'b', 'c'), [d(1)]: taps('a', 'b', 'c'), [d(2)]: taps('a', 'b', 'c') };
    const restarted = freshStart(plan, logs, {}, d(10));
    const s = computeStreak(restarted, logs, {}, d(10));
    expect(s.days.length).toBe(1);
    expect(s.days[0].outcome).toBe('pending');
    expect(s.best).toBe(3);
    expect(s.current).toBe(0);
  });
});

describe('slip-ups on quit goals', () => {
  test('triggers are counted and linked to short sleep in the weekly check-in', () => {
    const plan = planFromTemplate('quit', 'Cut back on vaping', '', START);
    const logs: Logs = {};
    const health: Record<string, DailyHealth> = {};
    for (let i = 0; i < 7; i++) {
      logs[d(i)] = { taps: {}, counts: { uses: i % 3 === 0 ? 8 : 3 }, slips: i % 3 === 0 ? ['Stress'] : undefined };
      health[d(i)] = { day: d(i), sleepHours: i % 3 === 0 ? 5.5 : 7.5, steps: 7000 };
    }
    logs[d(3)].slips = ['Stress', 'Social'];
    expect(slipTriggers(logs, d(0), d(6))[0]).toEqual({ trigger: 'Stress', count: 3 });
    const stats = weekStats(plan, logs, health, d(6));
    expect(stats.slipsAfterShortSleep).toBe(3);
    expect(offlineCheckIn(plan, stats).bullets.some((b) => b.includes('short night'))).toBe(true);
  });
});
