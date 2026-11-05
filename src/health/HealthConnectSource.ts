// Android: reads Health Connect, where Samsung Health (Galaxy Watch), Fitbit
// and Pixel Watch, Garmin Connect, Oura, Whoop and most other watch apps sync.
import {
  aggregateGroupByPeriod,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
  type ReadRecordsResult,
} from 'react-native-health-connect';
import type { DailyHealth, DayKey } from '../core/types';
import { toDayKey } from '../core/dates';
import { dailyAverage, sleepHoursByWakeDay } from '../core/healthMath';
import type { HealthSource } from './HealthSource';

const PERMISSIONS: Permission[] = (['SleepSession', 'Steps', 'ExerciseSession', 'RestingHeartRate', 'HeartRateVariabilityRmssd'] as const).map(
  (recordType) => ({ accessType: 'read', recordType }),
);

// Health Connect sleep stage types that are not sleep.
const AWAKE_STAGES = new Set([1, 3, 7]); // AWAKE, OUT_OF_BED, AWAKE_IN_BED

function startOfDay(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

async function readAll<T extends RecordType>(recordType: T, startTime: Date, endTime: Date) {
  const records: ReadRecordsResult<T>['records'] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      pageSize: 1000,
      pageToken,
    });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

export class HealthConnectSource implements HealthSource {
  readonly name = 'Health Connect';
  private ready = false;

  async requestAccess() {
    if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    this.ready = await initialize();
    if (!this.ready) return false;
    const granted = await requestPermission(PERMISSIONS);
    return granted.length > 0;
  }

  async dailySummaries(days: number) {
    if (!this.ready) return {};
    const start = startOfDay(days - 1);
    const end = new Date();
    const range = { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
    const out: Record<DayKey, DailyHealth> = {};
    const day = (k: DayKey) => (out[k] ??= { day: k });

    // Each read is allowed to fail on its own (for example if one permission was declined).
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

    const [steps, exercise, sleep, rhr, hrv] = await Promise.all([
      // Aggregates de-duplicate data written by several apps for the same steps.
      safe(aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: { period: 'DAYS', length: 1 } }), []),
      safe(aggregateGroupByPeriod({ recordType: 'ExerciseSession', timeRangeFilter: range, timeRangeSlicer: { period: 'DAYS', length: 1 } }), []),
      safe(readAll('SleepSession', new Date(start.getTime() - 12 * 3600_000), end), []),
      safe(readAll('RestingHeartRate', start, end), []),
      safe(readAll('HeartRateVariabilityRmssd', start, end), []),
    ]);

    for (const g of steps) day(toDayKey(new Date(g.startTime))).steps = Math.round(g.result.COUNT_TOTAL ?? 0);
    for (const g of exercise) {
      const min = Math.round((g.result.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0) / 60);
      day(toDayKey(new Date(g.startTime))).workoutMinutes = min;
    }

    const asleep = sleep.flatMap((s) => {
      const stages = (s.stages ?? []).filter((st) => !AWAKE_STAGES.has(st.stage));
      return stages.length
        ? stages.map((st) => ({ start: new Date(st.startTime), end: new Date(st.endTime) }))
        : [{ start: new Date(s.startTime), end: new Date(s.endTime) }];
    });
    for (const [k, v] of Object.entries(sleepHoursByWakeDay(asleep))) day(k).sleepHours = v;

    for (const [k, v] of Object.entries(dailyAverage(rhr.map((r) => ({ time: new Date(r.time), value: r.beatsPerMinute }))))) day(k).restingHR = v;
    for (const [k, v] of Object.entries(dailyAverage(hrv.map((r) => ({ time: new Date(r.time), value: r.heartRateVariabilityMillis }))))) day(k).hrvMs = v;

    const first = toDayKey(start);
    return Object.fromEntries(Object.entries(out).filter(([k]) => k >= first));
  }
}
