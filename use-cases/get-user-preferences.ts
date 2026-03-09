/**
 * Casos de uso: preferências. Usam a porta IPreferencesStorage (não sabem se é AsyncStorage ou outro).
 */

import type { IPreferencesStorage } from "@/ports/preferences-storage";
import {
  getPreferredStudyTab as domainGetPreferredStudyTab,
  getSessionDuration as domainGetSessionDuration,
  getDisplayResumo as domainGetDisplayResumo,
  type UserPreferences,
  type StudyTab,
} from "@/domain/preferences";

/** Obtém preferências do usuário (via storage injetado). */
export async function getUserPreferences(storage: IPreferencesStorage): Promise<UserPreferences> {
  return storage.get();
}

/** Salva preferências (parcial) e devolve o estado atual. */
export async function setUserPreferences(
  storage: IPreferencesStorage,
  partial: Partial<UserPreferences>
): Promise<UserPreferences> {
  return storage.set(partial);
}

/** Aba de estudo preferida (lê do storage e aplica regra do domínio). */
export async function getPreferredStudyTab(storage: IPreferencesStorage): Promise<StudyTab> {
  const prefs = await storage.get();
  return domainGetPreferredStudyTab(prefs);
}

/** Duração de sessão em min + label (lê prefs e aplica regra do domínio). */
export async function getSessionDuration(storage: IPreferencesStorage): Promise<{
  minutes: number;
  label: string;
}> {
  const prefs = await storage.get();
  return domainGetSessionDuration(prefs);
}

/** Resumo a exibir para o material (usa nivelResumo das prefs). */
export async function getDisplayResumo(
  storage: IPreferencesStorage,
  material: { resumo: string; resumoBreve?: string; resumoMedio?: string; resumoCompleto?: string }
): Promise<string> {
  const prefs = await storage.get();
  return domainGetDisplayResumo(material, prefs.nivelResumo);
}
