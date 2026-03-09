import type { IPreferencesStorage } from "@/ports/preferences-storage";
import {
  getPreferredStudyTab as domainGetPreferredStudyTab,
  getSessionDuration as domainGetSessionDuration,
  getDisplayResumo as domainGetDisplayResumo,
  type UserPreferences,
  type NivelResumo,
  type StudyTab,
} from "@/domain/preferences";

export async function getUserPreferences(storage: IPreferencesStorage): Promise<UserPreferences> {
  return storage.get();
}

export async function setUserPreferences(
  storage: IPreferencesStorage,
  partial: Partial<UserPreferences>
): Promise<UserPreferences> {
  return storage.set(partial);
}

export async function getPreferredStudyTab(storage: IPreferencesStorage): Promise<StudyTab> {
  const prefs = await storage.get();
  return domainGetPreferredStudyTab(prefs);
}

export async function getSessionDuration(storage: IPreferencesStorage): Promise<{
  minutes: number;
  label: string;
}> {
  const prefs = await storage.get();
  return domainGetSessionDuration(prefs);
}

export async function getDisplayResumo(
  storage: IPreferencesStorage,
  material: { resumo: string; resumoBreve?: string; resumoMedio?: string; resumoCompleto?: string }
): Promise<string> {
  const prefs = await storage.get();
  return domainGetDisplayResumo(material, prefs.nivelResumo);
}
