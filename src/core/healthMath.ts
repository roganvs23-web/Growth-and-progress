// Pure helpers that turn raw watch samples into one number per day.
// Shared by the Apple Health and Health Connect readers.
import type { DayKey } from './types';
import { toDayKey } from './dates';

export interface Interval {
  start: Date;
  end: Date;
}

/**
 * Hours asleep per night, credited to the day you woke up.
 * Overlapping intervals are merged first, because a watch and a phone (or two
 * apps) often both record the same night and we must not count it twice.
 * A night is a run of sleep with gaps under 3 hours (so a 3am wake-up does
 * not split it, but an afternoon nap counts toward the same day).
 */
export function sleepHoursByWakeDay(intervals: Interval[]): Record<DayKey, number> {
  const sorted = intervals
    .filter((i) => i.end.getTime() > i.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Interval[] = [];
  for (const i of sorted) {
    const last = merged[merged.length - 1];
    if (last && i.start.getTime() <= last.end.getTime()) {
      if (i.end.getTime() > last.end.getTime()) last.end = new Date(i.end.getTime());
    } else merged.push({ start: new Date(i.start.getTime()), end: new Date(i.end.getTime()) });
  }

  const GAP = 3 * 3600_000;
  const out: Record<DayKey, number> = {};
  let night: Interval[] = [];
  const flush = () => {
    if (!night.length) return;
    const ms = night.reduce((a, i) => a + (i.end.getTime() - i.start.getTime()), 0);
    const day = toDayKey(night[night.length - 1].end);
    out[day] = Math.round(((out[day] ?? 0) + ms / 3600_000) * 10) / 10;
    night = [];
  };
  for (const i of merged) {
    const prev = night[night.length - 1];
    if (prev && i.start.getTime() - prev.end.getTime() > GAP) flush();
    night.push(i);
  }
  flush();
  return out;
}

/** Mean of the samples that fall on each local day. */
export function dailyAverage(samples: { time: Date; value: number }[], decimals = 0): Record<DayKey, number> {
  const sums: Record<DayKey, { s: number; n: number }> = {};
  for (const x of samples) {
    if (!Number.isFinite(x.value)) continue;
    const d = toDayKey(x.time);
    const acc = (sums[d] ??= { s: 0, n: 0 });
    acc.s += x.value;
    acc.n++;
  }
  const f = 10 ** decimals;
  return Object.fromEntries(Object.entries(sums).map(([d, { s, n }]) => [d, Math.round((s / n) * f) / f]));
}
