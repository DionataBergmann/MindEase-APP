/**
 * Preferences facade — async get/set for app; re-exports types and pure helpers.
 */

import {
  getPreferredStudyTab as domainGetPreferredStudyTab,
  getSessionDuration as domainGetSessionDuration,
  getDisplayResumo as domainGetDisplayResumo,
  type UserPreferences,
  type NivelResumo,
  type StudyTab,
} from "./preferences-types";
import { getPreferencesAsync, setPreferencesAsync } from "./preferences-storage";

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
} from "./preferences-types";
export { DEFAULT_USER_PREFERENCES } from "./preferences-types";

export const getPreferences = getPreferencesAsync;
export const setPreferences = setPreferencesAsync;

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
