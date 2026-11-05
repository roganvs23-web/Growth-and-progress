import type { DayKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(k: DayKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: DayKey, n: number): DayKey {
  const d = fromDayKey(k);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Inclusive list of days from `start` to `end`. */
export function daysBetween(start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Monday of the week containing `k`. */
export function weekStart(k: DayKey): DayKey {
  const d = fromDayKey(k);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return addDays(k, -dow);
}
