// One interface for every watch. Apple Watch data arrives through Apple
// HealthKit on iPhone; Galaxy, Pixel, Fitbit, Garmin, Oura and most others
// sync into Google Health Connect on Android. So two native adapters cover
// nearly every watch, and the rest of the app only sees DailyHealth.
import type { DailyHealth, DayKey } from '../core/types';
import { addDays, toDayKey } from '../core/dates';

export interface HealthSource {
  readonly name: string;
  /** Ask the OS for read permission. Resolves false if the user declines. */
  requestAccess(): Promise<boolean>;
  /** Daily summaries for the last `days` days, keyed by day. */
  dailySummaries(days: number): Promise<Record<DayKey, DailyHealth>>;
}

/** No health store at all: the app runs on morning check-ins and taps. */
export class NoHealthSource implements HealthSource {
  readonly name = 'Check-ins';
  async requestAccess() {
    return true;
  }
  async dailySummaries() {
    return {};
  }
}

/**
 * Realistic sample data (development builds only) so the app is fully usable in Expo Go and in
 * simulators, where no watch is paired. Deterministic per day.
 */
export class SampleHealthSource implements HealthSource {
  readonly name = 'Sample watch data';
  async requestAccess() {
    return true;
  }
  async dailySummaries(days: number) {
    const out: Record<DayKey, DailyHealth> = {};
    const today = toDayKey(new Date());
    for (let i = 0; i < days; i++) {
      const day = addDays(today, -i);
      const r = seeded(day);
      out[day] = {
        day,
        sleepHours: round1(5.6 + r() * 2.4),
        steps: i === 0 ? Math.round(1500 + r() * 4000) : Math.round(4000 + r() * 8000),
        workoutMinutes: r() > 0.55 ? Math.round(15 + r() * 40) : 0,
        restingHR: Math.round(59 + r() * 7),
        hrvMs: Math.round(38 + r() * 18),
      };
    }
    return out;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function seeded(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
