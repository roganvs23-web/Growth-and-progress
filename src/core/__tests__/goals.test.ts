import { addDays } from '../dates';
import { planFromTemplate } from '../templates';
import { activeHabits, computeStreak, crunchOn } from '../progress';
import { addGoal, endCrunch, goalsOf, habitsForGoal, MAX_HABITS, removeGoal, startCrunch } from '../goals';
import type { Logs } from '../types';

const START = '2026-11-02';
const d = (i: number) => addDays(START, i);

describe('more than one goal', () => {
  test('adding a goal adds its habits and shares watch habits instead of duplicating them', () => {
    const plan = addGoal(planFromTemplate('focus', 'Pass my exams', '', START), 'quit', 'Cut back on vaping');
    expect(goalsOf(plan).map((g) => g.title)).toEqual(['Pass my exams', 'Cut back on vaping']);
    expect(habitsForGoal(plan, 'g2').map((h) => h.id)).toEqual(['g2-uses', 'g2-craving', 'g2-walk']);
    // focus has sleep7; fitness also has sleep7 and steps
    const three = addGoal(plan, 'fitness', '');
    expect(three.habits.filter((h) => h.source.kind === 'watch' && h.source.metric === 'sleepHours').length).toBe(1);
    expect(three.habits.length).toBeLessThanOrEqual(MAX_HABITS);
  });

  test('at most three goals', () => {
    let plan = planFromTemplate('focus', 'a', '', START);
    plan = addGoal(addGoal(addGoal(plan, 'quit', 'b'), 'fitness', 'c'), 'custom', 'd');
    expect(goalsOf(plan).length).toBe(3);
  });

  test('removing a goal removes its habits and its exam mode', () => {
    let plan = addGoal(planFromTemplate('fitness', 'Run a 5k', '', START), 'focus', 'Exams');
    plan = startCrunch(plan, 'Finals', 7, START);
    expect(plan.crunch?.goalId).toBe('g2');
    const back = removeGoal(plan, 'g2');
    expect(back.habits.every((h) => !h.goalId)).toBe(true);
    expect(back.crunch).toBeUndefined();
  });
});

describe('exam and deadline mode', () => {
  test('only the study goal and sleep count until the exam', () => {
    let plan = addGoal(planFromTemplate('fitness', 'Get fit', '', START), 'focus', 'Finals');
    plan = startCrunch(plan, 'Finals', 3, START);
    expect(crunchOn(plan, d(2))).toBe(true);
    expect(crunchOn(plan, d(3))).toBe(false);
    const ids = activeHabits(plan, d(0)).map((h) => h.id);
    expect(ids).toContain('g2-deep');
    expect(ids).toContain('sleep7'); // sleep always counts
    expect(ids).not.toContain('steps8k');
    expect(activeHabits(plan, d(3)).length).toBe(plan.habits.length);
  });

  test('a day with only study and sleep done is a good day during exam mode', () => {
    let plan = addGoal(planFromTemplate('fitness', 'Get fit', '', START), 'focus', 'Finals');
    plan = { ...plan, dayThreshold: 1 };
    plan = startCrunch(plan, 'Finals', 2, START);
    const logs: Logs = { [d(0)]: { taps: { 'g2-phonebed': true }, counts: { 'g2-deep': 3 } } };
    const health = { [d(0)]: { day: d(0), sleepHours: 7.5 } };
    const s = computeStreak(plan, logs, health, d(1));
    expect(s.days[0].outcome).toBe('hit');
    expect(computeStreak(endCrunch(plan), logs, health, d(1)).days[0].outcome).not.toBe('hit');
  });
});
