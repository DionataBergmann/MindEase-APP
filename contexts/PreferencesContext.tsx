import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { getPreferences, type UserPreferences } from '@/lib/preferences';

type PreferencesContextValue = {
  prefs: UserPreferences | null;
  /** Scale for font sizes: P=0.9, M=1, G=1.15 */
  fontScale: number;
  /** Scale for spacing (padding, margin, gap): normal=1, amplo=1.25 */
  spacingScale: number;
  /** Contrast: normal=1, alto=2 (e.g. border width multiplier) */
  contrastLevel: 'normal' | 'alto';
  /** When true, animations should be instant or disabled (flashcard flip, slide, etc.) */
  reducedAnimations: boolean;
  /** Reload prefs from storage (call after updating in profile). */
  refresh: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const FONT_SCALE: Record<'P' | 'M' | 'G', number> = { P: 0.9, M: 1, G: 1.15 };
const SPACING_SCALE: Record<'normal' | 'amplo', number> = { normal: 1, amplo: 1.5 };

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  const refresh = useCallback(async () => {
    const p = await getPreferences();
    setPrefs(p);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fontScale = prefs ? (FONT_SCALE[prefs.tamanhoFonte] ?? 1) : 1;
  const spacingScale = prefs ? (SPACING_SCALE[prefs.espacamento] ?? 1) : 1;
  const contrastLevel = (prefs?.contraste === 'alto' ? 'alto' : 'normal') as 'normal' | 'alto';
  const reducedAnimations = prefs?.animacoes === 'reduzidas';

  const value: PreferencesContextValue = {
    prefs,
    fontScale,
    spacingScale,
    contrastLevel,
    reducedAnimations,
    refresh,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext(): PreferencesContextValue | null {
  return useContext(PreferencesContext);
}

export function useFontScale(): number {
  const ctx = usePreferencesContext();
  return ctx?.fontScale ?? 1;
}

export function useSpacingScale(): number {
  const ctx = usePreferencesContext();
  return ctx?.spacingScale ?? 1;
}

export function useContrastLevel(): 'normal' | 'alto' {
  const ctx = usePreferencesContext();
  return ctx?.contrastLevel ?? 'normal';
}

export function useReducedAnimations(): boolean {
  const ctx = usePreferencesContext();
  return ctx?.reducedAnimations ?? false;
}
