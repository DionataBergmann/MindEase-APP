/**
 * Domain types and pure helpers for user preferences — aligned with mindease-web.
 */

export type FormatoPreferido = 'resumo' | 'flashcards' | 'quiz' | 'chat';
export type DuracaoSessao = 'curta' | 'media' | 'longa';
export type TamanhoFonte = 'P' | 'M' | 'G';
export type Contraste = 'normal' | 'alto';
export type Espacamento = 'normal' | 'amplo';
export type Animacoes = 'normal' | 'reduzidas';
export type NivelResumo = 'breve' | 'medio' | 'completo';

export type UserPreferences = {
  formatoPreferido: FormatoPreferido;
  duracaoSessao: DuracaoSessao;
  tamanhoFonte: TamanhoFonte;
  contraste: Contraste;
  espacamento: Espacamento;
  animacoes: Animacoes;
  alertasTempo: boolean;
  modoFoco: boolean;
  avisoTransicao: boolean;
  pausasPomodoro: boolean;
  pomodoroWorkMinutes: number | null;
  pomodoroBreakMinutes: number;
  modoFocoEsconderMenu: boolean;
  nivelResumo: NivelResumo;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  formatoPreferido: 'flashcards',
  duracaoSessao: 'media',
  tamanhoFonte: 'M',
  contraste: 'normal',
  espacamento: 'normal',
  animacoes: 'normal',
  alertasTempo: true,
  modoFoco: false,
  avisoTransicao: true,
  pausasPomodoro: false,
  pomodoroWorkMinutes: null,
  pomodoroBreakMinutes: 5,
  modoFocoEsconderMenu: false,
  nivelResumo: 'medio',
};

export type StudyTab = 'flashcards' | 'quiz' | 'chat' | 'minhas_questoes';

export function getPreferredStudyTab(prefs: UserPreferences): StudyTab {
  if (prefs.formatoPreferido === 'resumo') return 'flashcards';
  return prefs.formatoPreferido;
}

export function getSessionDuration(prefs: UserPreferences): { minutes: number; label: string } {
  const d = prefs.duracaoSessao;
  if (d === 'curta') return { minutes: 18, label: '15-20 min' };
  if (d === 'longa') return { minutes: 45, label: '45+ min' };
  return { minutes: 28, label: '25-30 min' };
}

export function getDisplayResumo(
  material: { resumo: string; resumoBreve?: string; resumoMedio?: string; resumoCompleto?: string },
  nivel: NivelResumo
): string {
  if (nivel === 'completo' && material.resumoCompleto?.trim()) return material.resumoCompleto.trim();
  if (nivel === 'medio' && material.resumoMedio?.trim()) return material.resumoMedio.trim();
  if (nivel === 'breve' && material.resumoBreve?.trim()) return material.resumoBreve.trim();
  return material.resumo?.trim() ?? '';
}
