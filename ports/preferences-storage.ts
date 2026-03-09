import type { UserPreferences } from "@/domain/preferences";

/** Porta: contrato para persistir preferências. Quem implementa é o adapter. */
export interface IPreferencesStorage {
  get(): Promise<UserPreferences>;
  set(partial: Partial<UserPreferences>): Promise<UserPreferences>;
}
