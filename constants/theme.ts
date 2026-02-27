/**
 * Cores do MindEase — alinhadas ao mindease-web (design-tokens).
 * Light/dark iguais ao web para consistência entre app e site.
 */

import { Platform } from 'react-native';

// Light theme (mindease-web design-tokens light)
const light = {
  background: '#f7f5f0',
  foreground: '#2d3a36',
  card: '#fcfbf9',
  cardForeground: '#2d3a36',
  primary: '#2d7a5e',
  primaryForeground: '#f7f5f0',
  secondary: '#d4e8e0',
  secondaryForeground: '#3d4a45',
  muted: '#ebe8e3',
  mutedForeground: '#2d3a36',
  accent: '#c98b4a',
  accentForeground: '#2d1f0a',
  border: '#dde8e3',
  input: '#dde8e3',
  destructive: '#c73e3e',
  destructiveForeground: '#ffffff',
  success: '#2d8a5e',
  successForeground: '#ffffff',
  warning: '#c98b2a',
  warningForeground: '#2d1f0a',
  info: '#3b82c6',
  infoForeground: '#ffffff',
  // Aliases para componentes que usam tint/tabIcon
  text: '#2d3a36',
  tint: '#2d7a5e',
  icon: '#2d3a36',
  tabIconDefault: '#2d3a36',
  tabIconSelected: '#2d7a5e',
};

// Dark theme (mindease-web design-tokens dark)
const dark = {
  background: '#141c19',
  foreground: '#e0e6e3',
  card: '#1a231f',
  cardForeground: '#e0e6e3',
  primary: '#4a9a76',
  primaryForeground: '#141c19',
  secondary: '#24302a',
  secondaryForeground: '#e0e6e3',
  muted: '#24302a',
  mutedForeground: '#8a9a94',
  accent: '#4a9a76',
  accentForeground: '#e0e6e3',
  border: '#2d3a36',
  input: '#2d3a36',
  destructive: '#c73e3e',
  destructiveForeground: '#ffffff',
  success: '#2d8a5e',
  successForeground: '#ffffff',
  warning: '#c98b2a',
  warningForeground: '#2d1f0a',
  info: '#3b82c6',
  infoForeground: '#ffffff',
  text: '#e0e6e3',
  tint: '#4a9a76',
  icon: '#8a9a94',
  tabIconDefault: '#8a9a94',
  tabIconSelected: '#4a9a76',
};

export const Colors = {
  light,
  dark,
};

export type ColorScheme = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
