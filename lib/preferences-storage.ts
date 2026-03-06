/**
 * Persist user preferences with AsyncStorage (React Native).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from './preferences-types';

const STORAGE_KEY = 'mindease_preferences';

export async function getPreferencesAsync(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_USER_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export async function setPreferencesAsync(partial: Partial<UserPreferences>): Promise<UserPreferences> {
  const current = await getPreferencesAsync();
  const next = { ...current, ...partial };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
