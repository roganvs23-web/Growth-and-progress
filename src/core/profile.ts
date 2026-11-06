// Age, consent, pricing tier and privacy settings.
//
// LEGAL AND PRICING CALLS FOR ROGAN (not decided in code):
//  - Under-13s (COPPA in the US, similar rules elsewhere) need *verifiable*
//    parental consent. The in-app parent confirmation below is a placeholder
//    mechanic, not verification. Options: don't allow under-13s at launch
//    (simplest; set MIN_AGE_WITHOUT_PARENT = MIN_AGE = 13), or use a consent
//    service. In the EU/UK the digital age of consent is 13 to 16 by country.
//  - Health data from teens: Apple and Google review this closely.
//  - Prices in PRICING are placeholders until Rogan picks them.
import type { DailyHealth, DayKey, WatchMetric } from './types';

export const MIN_AGE = 13; // below this, the app needs a parent's consent
export type AgeGroup = 'child' | 'teen' | 'adult';

export interface Profile {
  birthYear: number;
  student?: boolean;
  /** Set when a parent or guardian agreed in the app (placeholder for verified consent). */
  parentConsent?: { email: string; at: string };
}

export interface PrivacySettings {
  /** Which watch metrics Momentum may use. Off means the number is never read into the app. */
  metrics: Record<WatchMetric, boolean>;
  /** Send daily summaries to the AI coach. Off: the app runs on built-in rules only. */
  coach: boolean;
  /** When the user agreed to send data to the AI coach (Apple guideline 5.1.2: ask before sharing with an AI service). */
  coachConsentAt?: string;
  /** Set once the user has been asked, whatever they answered. */
  coachAskedAt?: string;
}

/** Shown wherever the user turns the AI coach on. */
export const COACH_ON =
  'Sends your goal, plan, chat and daily totals (never minute-by-minute data) through the Momentum server to Claude, an AI model made by Anthropic, to write replies. Neither keeps them to train AI, and the Momentum server does not store them.';

/** The coach runs only when switched on and the user has agreed to it. */
export const coachAllowed = (p: PrivacySettings) => p.coach && !!p.coachConsentAt;

export const DEFAULT_PRIVACY: PrivacySettings = {
  metrics: { sleepHours: true, steps: true, workoutMinutes: true, restingHR: true, hrvMs: true },
  coach: true,
};

export function ageOf(birthYear: number, now = new Date()): number {
  // Year only (we never ask for a full birth date), so this can be off by one; round down to be safe.
  return now.getFullYear() - birthYear - 1;
}

export function ageGroup(p: Profile | undefined, now = new Date()): AgeGroup {
  if (!p) return 'adult';
  const a = ageOf(p.birthYear, now);
  return a < MIN_AGE ? 'child' : a < 18 ? 'teen' : 'adult';
}

export function needsParentConsent(p: Profile | undefined, now = new Date()): boolean {
  return !!p && ageGroup(p, now) === 'child' && !p.parentConsent;
}

export type PriceTier = 'standard' | 'student' | 'teen';

/** Placeholder prices (USD) until Rogan decides. */
export const PRICING: Record<PriceTier, { monthly: number; yearly: number; label: string }> = {
  standard: { monthly: 7.99, yearly: 49.99, label: 'Standard' },
  student: { monthly: 3.99, yearly: 24.99, label: 'Student' },
  teen: { monthly: 3.99, yearly: 24.99, label: 'Teen (paid by a parent)' },
};

export function priceTier(p: Profile | undefined, now = new Date()): PriceTier {
  const g = ageGroup(p, now);
  if (g !== 'adult') return 'teen';
  return p?.student ? 'student' : 'standard';
}

/** Drops every metric the user switched off, so it never reaches readiness, habits or the coach. */
export function applyPrivacy(health: Record<DayKey, DailyHealth>, privacy: PrivacySettings): Record<DayKey, DailyHealth> {
  const off = (Object.keys(privacy.metrics) as WatchMetric[]).filter((m) => !privacy.metrics[m]);
  if (!off.length) return health;
  const out: Record<DayKey, DailyHealth> = {};
  for (const [k, v] of Object.entries(health)) {
    const c = { ...v };
    for (const m of off) delete c[m];
    out[k] = c;
  }
  return out;
}
