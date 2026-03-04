import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Input, Button } from '@/components/atoms';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loginSchema, type LoginFormData } from './loginSchema';

function getAuthErrorMessage(code: string): string {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'E-mail ou senha incorretos. Tente novamente.';
  }
  if (code === 'auth/user-not-found') return 'Não há conta com este e-mail. Crie uma conta.';
  if (code === 'auth/invalid-email') return 'E-mail inválido.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  return 'Não foi possível entrar. Tente novamente.';
}

export function LoginForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setCheckingAuth(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/');
        return;
      }
      setCheckingAuth(false);
    });
    return () => unsub();
  }, [router]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormData) {
    setFirebaseError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setFirebaseError('Firebase não está configurado. Verifique as variáveis de ambiente.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      router.replace('/');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      setFirebaseError(getAuthErrorMessage(code));
    }
  }

  if (checkingAuth) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Carregando…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={[styles.brand, { color: colors.primary }]}>
            MindEase
          </ThemedText>
          <Image
            source={require('@/assets/login-illustration.png')}
            style={styles.illustration}
            contentFit="contain"
            accessibilityLabel=""
          />
          <ThemedText type="subtitle" style={[styles.heading, { color: colors.primary }]}>
            Entrar
          </ThemedText>
          <ThemedText style={styles.lead}>
            Use seu e-mail e senha para acessar.
          </ThemedText>

          <View style={styles.form}>
            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>E-mail</ThemedText>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.email ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>{errors.email.message}</ThemedText>
            ) : null}

            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>Senha</ThemedText>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Sua senha"
                  secureTextEntry
                  autoComplete="password"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.password ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>{errors.password.message}</ThemedText>
            ) : null}

            {firebaseError ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>{firebaseError}</ThemedText>
            ) : null}

            <Button
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.submitBtn}
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </View>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Não tem conta? </ThemedText>
            <Button variant="link" onPress={() => router.push('/signup')}>
              Criar conta
            </Button>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  brand: { textAlign: 'center', marginBottom: 8 },
  illustration: { width: '100%', maxWidth: 200, height: 140, alignSelf: 'center', marginBottom: 16 },
  heading: { textAlign: 'center', marginBottom: 4 },
  lead: { textAlign: 'center', marginBottom: 24, opacity: 0.9 },
  form: { gap: 12, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: -10 },
  error: { fontSize: 14, fontWeight: '500' },
  submitBtn: { width: '100%', marginTop: 30 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: -10 },
  footerText: { marginRight: 4 },
});
