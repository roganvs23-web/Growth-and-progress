import { Platform } from 'react-native';
import { NoHealthSource, SampleHealthSource, type HealthSource } from './HealthSource';

export type { HealthSource };

/**
 * Connects to the phone's health store: Apple Health on iPhone, Health
 * Connect on Android. Between them they cover nearly every smartwatch.
 *
 * No watch is needed: the phone itself records steps (and often walks and
 * runs) into the same store, and sleep and readiness come from the morning
 * check-in when there is no watch data.
 *
 * When the health store is not usable (declined, Health Connect missing),
 * real users get NoHealthSource and run on check-ins and taps. Only
 * development builds (Expo Go, simulators) fall back to sample data, so
 * nobody ever sees made-up numbers in the store app.
 */
export async function connectHealthSource(): Promise<HealthSource> {
  try {
    let real: HealthSource | null = null;
    if (Platform.OS === 'ios') {
      const { HealthKitSource } = require('./HealthKitSource') as typeof import('./HealthKitSource');
      real = new HealthKitSource();
    } else if (Platform.OS === 'android') {
      const { HealthConnectSource } = require('./HealthConnectSource') as typeof import('./HealthConnectSource');
      real = new HealthConnectSource();
    }
    if (real && (await real.requestAccess())) return real;
  } catch {
    // Native module missing (Expo Go) or the health store errored.
  }
  return __DEV__ ? new SampleHealthSource() : new NoHealthSource();
}
