import { safeWatchTarget, safetyCheck, sanitizePlan } from '../safety';
import { planFromTemplate } from '../templates';

describe('safety check on messages', () => {
  test.each([
    ['honestly I want to die', 'selfHarm'],
    ['I keep thinking about killing myself', 'selfHarm'],
    ['been cutting myself again', 'selfHarm'],
    ['I have chest pain after running', 'emergency'],
    ['I want to quit drinking cold turkey', 'withdrawal'],
    ['how do I stop taking xanax', 'withdrawal'],
    ['I make myself throw up after meals', 'eating'],
  ])('%s', (text, topic) => expect(safetyCheck(text)).toBe(topic));

  test.each(['I want to quit vaping', 'stop drinking coffee after 3pm', 'help me focus on exams', 'this plan is killing me lol, too much'])('no alarm: %s', (text) =>
    expect(safetyCheck(text)).toBeNull(),
  );
});

describe('safe habit targets', () => {
  test('extreme targets are pulled back into a safe range', () => {
    expect(safeWatchTarget('steps', 'atLeast', 40000, 'adult')).toBe(15000);
    expect(safeWatchTarget('workoutMinutes', 'atLeast', 180, 'teen')).toBe(60);
    expect(safeWatchTarget('sleepHours', 'atLeast', 5, 'adult')).toBe(7);
    expect(safeWatchTarget('sleepHours', 'atLeast', 7, 'teen')).toBe(8);
    expect(safeWatchTarget('sleepHours', 'atMost', 6, 'adult')).toBeNull();
    expect(safeWatchTarget('restingHR', 'atMost', 50, 'adult')).toBeNull();
  });

  test('plans are cleaned without touching safe habits', () => {
    const plan = planFromTemplate('fitness', 'Get fit', '', '2026-11-02');
    expect(sanitizePlan(plan, 'adult')).toBe(plan);
    const risky = { ...plan, habits: [...plan.habits, { id: 'hr', name: 'Lower my heart rate', detail: '', source: { kind: 'watch' as const, metric: 'restingHR' as const, comparator: 'atMost' as const, target: 45 } }] };
    expect(sanitizePlan(risky, 'adult').habits.map((h) => h.id)).toEqual(plan.habits.map((h) => h.id));
  });
});

test('a teen gets 8+ hours of sleep, and the habit name says so', () => {
  const plan = planFromTemplate('focus', 'Exams', '', '2026-11-02');
  const sleep = sanitizePlan(plan, 'teen').habits.find((h) => h.id === 'sleep7')!;
  expect(sleep.name).toBe('Sleep 8+ hours');
});
