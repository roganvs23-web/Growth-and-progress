// iPhone: reads Apple Health, which holds Apple Watch data plus anything other
// watches (Garmin, Oura, Whoop, Fitbit via apps) sync into it.
import {
  CategoryValueSleepAnalysis,
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { DailyHealth, DayKey } from '../core/types';
import { toDayKey } from '../core/dates';
import { dailyAverage, sleepHoursByWakeDay } from '../core/healthMath';
import type { HealthSource } from './HealthSource';

const READ = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
] as const;

const ASLEEP = new Set<number>([
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

function startOfDay(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

export class HealthKitSource implements HealthSource {
  readonly name = 'Apple Health';

  async requestAccess() {
    if (!isHealthDataAvailable()) return false;
    // iOS never says whether reading was allowed (privacy). We get empty data if not.
    return requestAuthorization({ toRead: READ });
  }

  async dailySummaries(days: number) {
    const start = startOfDay(days - 1);
    const end = new Date();
    // Sleep that ends on the first day started the evening before.
    const sleepStart = new Date(start.getTime() - 12 * 3600_000);
    const filter = { date: { startDate: start, endDate: end } };

    const [sleep, steps, exercise, rhr, hrv] = await Promise.all([
      queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter: { date: { startDate: sleepStart, endDate: end } } }),
      queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], start, { day: 1 }, { filter, unit: 'count' }),
      queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierAppleExerciseTime', ['cumulativeSum'], start, { day: 1 }, { filter, unit: 'min' }),
      queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { limit: 0, filter, unit: 'count/min' }),
      queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', { limit: 0, filter, unit: 'ms' }),
    ]);

    const out: Record<DayKey, DailyHealth> = {};
    const day = (k: DayKey) => (out[k] ??= { day: k });

    const sleepH = sleepHoursByWakeDay(sleep.filter((s) => ASLEEP.has(Number(s.value))).map((s) => ({ start: s.startDate, end: s.endDate })));
    for (const [k, v] of Object.entries(sleepH)) day(k).sleepHours = v;

    // Statistics queries de-duplicate overlapping watch and phone samples for us.
    for (const s of steps) if (s.startDate && s.sumQuantity) day(toDayKey(s.startDate)).steps = Math.round(s.sumQuantity.quantity);
    for (const s of exercise) if (s.startDate && s.sumQuantity) day(toDayKey(s.startDate)).workoutMinutes = Math.round(s.sumQuantity.quantity);

    for (const [k, v] of Object.entries(dailyAverage(rhr.map((s) => ({ time: s.startDate, value: s.quantity }))))) day(k).restingHR = v;
    for (const [k, v] of Object.entries(dailyAverage(hrv.map((s) => ({ time: s.startDate, value: s.quantity }))))) day(k).hrvMs = v;

    const first = toDayKey(start);
    return Object.fromEntries(Object.entries(out).filter(([k]) => k >= first));
  }
}
