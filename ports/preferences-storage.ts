import type { UserPreferences } from "@/domain/preferences";

export interface IPreferencesStorage {
  get(): Promise<UserPreferences>;
  set(partial: Partial<UserPreferences>): Promise<UserPreferences>;
}
