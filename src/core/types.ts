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
  /** Which goal this habit serves. Missing means the main goal. */
  goalId?: string;
}

/** An extra goal next to the main one (the main goal lives on Plan itself). */
export interface Goal {
  id: string;
  path: GoalPath;
  title: string;
  why: string;
}

/** Exam or deadline mode: until `until`, only the crunch goal's habits (and sleep) count. */
export interface Crunch {
  label: string;
  until: DayKey;
  goalId: string;
  startedAt: DayKey;
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
  /** Extra goals, for example studying and quitting vaping at once (max 2 extra). */
  goals?: Goal[];
  /** Exam or deadline mode, if on. */
  crunch?: Crunch;
  /** Set by a "welcome back" fresh start: streaks count from this day. */
  restartedAt?: DayKey;
  /** Best streak before the last fresh start, so it is never lost. */
  bestBeforeRestart?: number;
}

/** One day of watch data. Any field may be missing if the watch did not record it. */
export interface DailyHealth {
  day: DayKey;
  sleepHours?: number;
  steps?: number;
  workoutMinutes?: number;
  restingHR?: number;
  hrvMs?: number;
  /** How the user said they feel this morning, 1 (rough) to 5 (great). From the morning check-in. */
  feel?: number;
}

/** What the user logged by hand for a day. */
export interface DayLog {
  /** habitId -> true for tap habits */
  taps: Record<string, boolean>;
  /** habitId -> count for counter habits */
  counts: Record<string, number>;
  /** User chose to take a planned recovery day. */
  plannedRest?: boolean;
  /** Morning check-in, used when there is no watch (or no sleep data). */
  morning?: MorningCheckIn;
  /** Feeling sick: the day is a free rest day and the plan is lightened. */
  sick?: boolean;
  /** Traveling: missed days are free and the plan is lightened. */
  travel?: boolean;
  /** Quit goals: what triggered each slip today (e.g. "Stress"). */
  slips?: string[];
  /** Focus timer started at (ISO time), for counter habits measured in blocks. */
  timer?: { habitId: string; startedAt: string; minutes: number };
}

export interface MorningCheckIn {
  /** Self-reported hours slept. Ignored if the watch measured sleep. */
  sleepHours?: number;
  /** 1 (rough) to 5 (great). */
  feel: number;
}

export type Logs = Record<DayKey, DayLog>;

export type DayOutcome =
  | 'hit' // enough habits done
  | 'rest' // planned rest, sick, travel, low readiness, or a banked recovery day covered a miss
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
  /** Last seen time zone offset (minutes), to notice travel. */
  tzOffset?: number;
  profile?: import('./profile').Profile;
  privacy?: import('./profile').PrivacySettings;
  buddy?: import('./buddy').BuddyLink;
}
