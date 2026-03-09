/**
 * Preferences facade — uses domain + adapter (Clean Architecture).
 */

import {
  getPreferredStudyTab as domainGetPreferredStudyTab,
  getSessionDuration as domainGetSessionDuration,
  getDisplayResumo as domainGetDisplayResumo,
  type UserPreferences,
  type NivelResumo,
  type StudyTab,
} from "@/domain/preferences";
import { asyncStoragePreferencesStorage } from "@/adapters";

export type {
  FormatoPreferido,
  DuracaoSessao,
  TamanhoFonte,
  Contraste,
  Espacamento,
  Animacoes,
  NivelResumo,
  UserPreferences,
  StudyTab,
} from "@/domain/preferences";
export { DEFAULT_USER_PREFERENCES } from "@/domain/preferences";

export const getPreferences = () => asyncStoragePreferencesStorage.get();
export const setPreferences = (partial: Partial<UserPreferences>) =>
  asyncStoragePreferencesStorage.set(partial);

export function getPreferredStudyTab(prefs: UserPreferences): StudyTab {
  return domainGetPreferredStudyTab(prefs);
}

export function getSessionDuration(prefs: UserPreferences): { minutes: number; label: string } {
  return domainGetSessionDuration(prefs);
}

export function getDisplayResumo(
  material: { resumo: string; resumoBreve?: string; resumoMedio?: string; resumoCompleto?: string },
  nivel: NivelResumo
): string {
  return domainGetDisplayResumo(material, nivel);
}
