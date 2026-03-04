import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthState } from '@/hooks/use-auth-state';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, checking } = useAuthState();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  useEffect(() => {
    if (checking) return;
    if (!user) {
      router.replace('/login');
    }
  }, [checking, user, router]);

  if (checking) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
