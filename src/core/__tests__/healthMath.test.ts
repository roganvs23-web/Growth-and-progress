import { dailyAverage, sleepHoursByWakeDay } from '../healthMath';

const at = (s: string) => new Date(s); // local time

describe('sleepHoursByWakeDay', () => {
  test('a night that crosses midnight counts for the wake-up day', () => {
    const r = sleepHoursByWakeDay([{ start: at('2026-11-02T23:30:00'), end: at('2026-11-03T07:00:00') }]);
    expect(r).toEqual({ '2026-11-03': 7.5 });
  });

  test('watch and phone recording the same night are not double counted', () => {
    const r = sleepHoursByWakeDay([
      { start: at('2026-11-02T23:00:00'), end: at('2026-11-03T06:00:00') },
      { start: at('2026-11-02T23:15:00'), end: at('2026-11-03T06:30:00') },
    ]);
    expect(r['2026-11-03']).toBe(7.5);
  });

  test('a short wake-up in the night stays in one night; stage gaps are excluded', () => {
    const r = sleepHoursByWakeDay([
      { start: at('2026-11-02T23:00:00'), end: at('2026-11-03T03:00:00') },
      { start: at('2026-11-03T03:30:00'), end: at('2026-11-03T07:00:00') },
    ]);
    expect(r).toEqual({ '2026-11-03': 7.5 });
  });

  test('an afternoon nap adds to the same day', () => {
    const r = sleepHoursByWakeDay([
      { start: at('2026-11-02T23:00:00'), end: at('2026-11-03T06:00:00') },
      { start: at('2026-11-03T14:00:00'), end: at('2026-11-03T14:30:00') },
    ]);
    expect(r).toEqual({ '2026-11-03': 7.5 });
  });
});

describe('dailyAverage', () => {
  test('averages per local day', () => {
    const r = dailyAverage([
      { time: at('2026-11-03T08:00:00'), value: 60 },
      { time: at('2026-11-03T20:00:00'), value: 64 },
      { time: at('2026-11-04T08:00:00'), value: 58 },
    ]);
    expect(r).toEqual({ '2026-11-03': 62, '2026-11-04': 58 });
  });
});
