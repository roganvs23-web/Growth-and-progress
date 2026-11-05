// Shared domain types for Momentum. Pure data, no React Native imports,
// so everything in src/core can be unit tested in plain Node.

/** A calendar day in the user's local time, formatted YYYY-MM-DD. */
export type DayKey = string;

export type GoalPath = 'focus' | 'fitness' | 'quit' | 'custom';

/** The watch metrics we can read from HealthKit / Health Connect. */
export type WatchMetric = 'sleepHours' | 'steps' | 'workoutMinutes' | 'restingHR' | 'hrvMs';

/** How a habit gets marked done. */
export type HabitSource =
  | { kind: 'watch'; metric: WatchMetric; comparator: 'atLeast' | 'atMost'; target: number }
  | { kind: 'tap' }
  | { kind: 'counter'; unit: string; comparator: 'atLeast' | 'atMost'; target: number };

export interface Habit {
  id: string;
  name: string;
  detail: string;
  source: HabitSource;
}

export interface Plan {
  path: GoalPath;
  goal: string;
  why: string;
  habits: Habit[];
  /** Share of habits needed for a day to count toward the streak (0-1). */
  dayThreshold: number;
  nudges: string[];
  createdAt: DayKey;
}

/** One day of watch data. Any field may be missing if the watch did not record it. */
export interface DailyHealth {
  day: DayKey;
  sleepHours?: number;
  steps?: number;
  workoutMinutes?: number;
  restingHR?: number;
  hrvMs?: number;
}

/** What the user logged by hand for a day. */
export interface DayLog {
  /** habitId -> true for tap habits */
  taps: Record<string, boolean>;
  /** habitId -> count for counter habits */
  counts: Record<string, number>;
  /** User chose to take a planned recovery day. */
  plannedRest?: boolean;
}

export type Logs = Record<DayKey, DayLog>;

export type DayOutcome =
  | 'hit' // enough habits done
  | 'rest' // planned rest, or low readiness, or a banked recovery day covered a miss
  | 'miss' // streak broken
  | 'pending'; // today, not finished yet

export interface CheckIn {
  weekOf: DayKey;
  bullets: string[];
  suggestions: PlanChange[];
  createdAt: string;
  source: 'ai' | 'offline';
}

export interface PlanChange {
  summary: string;
  addHabits?: Habit[];
  removeHabitIds?: string[];
  dayThreshold?: number;
}

export interface CoachMessage {
  role: 'user' | 'assistant' | 'note';
  content: string;
}

export interface AppState {
  version: 1;
  plan: Plan | null;
  logs: Logs;
  chat: CoachMessage[];
  checkIns: CheckIn[];
}
