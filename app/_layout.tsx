import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { warnMissingEnv } from '@/lib/env';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  warnMissingEnv();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PreferencesProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="new-project" />
          <Stack.Screen name="review" />
        </Stack>
        <StatusBar style="auto" />
        </PreferencesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
