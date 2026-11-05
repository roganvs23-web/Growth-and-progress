import { addDays } from '../dates';
import { planFromTemplate } from '../templates';
import { buddyLine, myBuddyStatus, normalizeCode } from '../buddy';

const START = '2026-11-02';

describe('buddy mode', () => {
  test('shares only streak, today result and the date', () => {
    const plan = { ...planFromTemplate('focus', 'Exams', '', START), dayThreshold: 1 };
    const today = addDays(START, 1);
    const s = myBuddyStatus(plan, { [today]: { taps: { phonebed: true }, counts: {} } }, {}, today);
    expect(Object.keys(s).sort()).toEqual(['day', 'streak', 'todayDone']);
    expect(s.day).toBe(today);
  });

  test('a buddy whose last update is another day has not checked in today', () => {
    const b = { name: 'Sam', streak: 3, todayDone: true, day: '2026-11-04', updatedAt: 0 };
    expect(buddyLine(b, '2026-11-05')).toMatch(/Hasn't opened/);
    expect(buddyLine({ ...b, day: '2026-11-05' }, '2026-11-05')).toMatch(/already a good day/);
    expect(buddyLine({ ...b, streak: 1, todayDone: false, day: '2026-11-05' }, '2026-11-05')).toBe('1-day streak. Still working on today.');
  });

  test('codes are cleaned up as people type them', () => {
    expect(normalizeCode('ab-c d2e9x')).toBe('ABCD2E');
  });
});
