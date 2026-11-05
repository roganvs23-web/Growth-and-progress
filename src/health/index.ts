import { Platform } from 'react-native';
import { SampleHealthSource, type HealthSource } from './HealthSource';

export type { HealthSource };

/**
 * Connects to the phone's health store: Apple Health on iPhone, Health
 * Connect on Android. Between them they cover nearly every smartwatch.
 *
 * Falls back to sample data when the real store is not usable: in Expo Go
 * (no native health modules), on a simulator, when Health Connect is not
 * installed, or when the user declines access. The returned source's `name`
 * says which one is in use, and the UI shows it.
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
  return new SampleHealthSource();
}
