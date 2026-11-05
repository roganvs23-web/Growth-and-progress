import { ageGroup, applyPrivacy, DEFAULT_PRIVACY, needsParentConsent, priceTier } from '../profile';

const NOW = new Date(2026, 10, 5);

describe('age and consent', () => {
  test('age groups round down to be safe (year of birth only)', () => {
    expect(ageGroup({ birthYear: 2014 }, NOW)).toBe('child'); // 11 or 12
    expect(ageGroup({ birthYear: 2013 }, NOW)).toBe('child'); // 12 or 13: treated as 12
    expect(ageGroup({ birthYear: 2012 }, NOW)).toBe('teen');
    expect(ageGroup({ birthYear: 2008 }, NOW)).toBe('teen'); // 17 or 18
    expect(ageGroup({ birthYear: 2007 }, NOW)).toBe('adult');
    expect(ageGroup(undefined, NOW)).toBe('adult');
  });

  test('children need a parent before using the app', () => {
    expect(needsParentConsent({ birthYear: 2015 }, NOW)).toBe(true);
    expect(needsParentConsent({ birthYear: 2015, parentConsent: { email: 'p@x.com', at: 'now' } }, NOW)).toBe(false);
    expect(needsParentConsent({ birthYear: 2010 }, NOW)).toBe(false);
  });

  test('price tiers', () => {
    expect(priceTier({ birthYear: 2010 }, NOW)).toBe('teen');
    expect(priceTier({ birthYear: 2004, student: true }, NOW)).toBe('student');
    expect(priceTier({ birthYear: 1990 }, NOW)).toBe('standard');
  });
});

describe('privacy', () => {
  test('switched-off metrics are removed everywhere', () => {
    const h = { '2026-11-05': { day: '2026-11-05', sleepHours: 7, restingHR: 60, hrvMs: 40, steps: 5000 } };
    const out = applyPrivacy(h, { ...DEFAULT_PRIVACY, metrics: { ...DEFAULT_PRIVACY.metrics, restingHR: false, hrvMs: false } });
    expect(out['2026-11-05']).toEqual({ day: '2026-11-05', sleepHours: 7, steps: 5000 });
    expect(h['2026-11-05'].restingHR).toBe(60);
  });
});
