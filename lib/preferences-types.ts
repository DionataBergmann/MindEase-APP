/**
 * Preferences types and pure helpers — re-export from domain (Clean Architecture).
 */

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
export {
  DEFAULT_USER_PREFERENCES,
  getPreferredStudyTab,
  getSessionDuration,
  getDisplayResumo,
} from "@/domain/preferences";
