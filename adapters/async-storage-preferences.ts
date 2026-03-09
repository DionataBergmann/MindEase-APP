import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/domain/preferences";
import type { IPreferencesStorage } from "@/ports/preferences-storage";

const STORAGE_KEY = "mindease_preferences";

export class AsyncStoragePreferencesStorage implements IPreferencesStorage {
  async get(): Promise<UserPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_USER_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      const merged = { ...DEFAULT_USER_PREFERENCES, ...parsed };
      merged.pomodoroWorkMinutes = merged.pomodoroWorkMinutes ?? null;
      merged.pomodoroBreakMinutes =
        typeof merged.pomodoroBreakMinutes === "number" && merged.pomodoroBreakMinutes >= 1
          ? Math.min(60, merged.pomodoroBreakMinutes)
          : 5;
      return merged;
    } catch {
      return DEFAULT_USER_PREFERENCES;
    }
  }

  async set(partial: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get();
    const next = { ...current, ...partial };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}

export const asyncStoragePreferencesStorage = new AsyncStoragePreferencesStorage();
