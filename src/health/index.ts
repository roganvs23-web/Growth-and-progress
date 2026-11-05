import { SampleHealthSource, type HealthSource } from './HealthSource';

export type { HealthSource };

/**
 * Picks the health source for this device.
 *
 * Next step for real watch data (needs a development build, not Expo Go):
 *  - iOS: add `@kingstinct/react-native-healthkit` and its config plugin in
 *    app.json, then implement HealthKitSource reading sleepAnalysis,
 *    stepCount, appleExerciseTime, restingHeartRate and
 *    heartRateVariabilitySDNN into DailyHealth.
 *  - Android: add `react-native-health-connect` + `expo-health-connect`,
 *    then implement HealthConnectSource reading SleepSession, Steps,
 *    ExerciseSession, RestingHeartRate and HeartRateVariabilityRmssd.
 * Both just need to return Record<DayKey, DailyHealth>; nothing else changes.
 */
export function getHealthSource(): HealthSource {
  return new SampleHealthSource();
}
