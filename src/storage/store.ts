import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '../core/types';

const KEY = 'stride/state/v1';

export const initialState: AppState = { version: 1, plan: null, logs: {}, chat: [], checkIns: [] };

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    return parsed?.version === 1 ? { ...initialState, ...parsed } : initialState;
  } catch {
    return initialState;
  }
}

export async function saveState(s: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or unavailable: keep running from memory.
  }
}
