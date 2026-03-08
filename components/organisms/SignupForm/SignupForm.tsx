import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Input, Button } from "@/components/atoms";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { signupSchema, type SignupFormData } from "./signupSchema";

function getAuthErrorMessage(code: string): string {
  if (code === "auth/email-already-in-use") return "Este e-mail já está em uso. Tente fazer login.";
  if (code === "auth/weak-password") return "A senha é muito fraca. Use no mínimo 6 caracteres.";
  if (code === "auth/invalid-email") return "E-mail inválido.";
  return "Não foi possível criar a conta. Tente novamente.";
}

export function SignupForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
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
        router.replace("/");
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
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: SignupFormData) {
    setFirebaseError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setFirebaseError("Firebase não está configurado. Verifique as variáveis de ambiente.");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      if (data.name?.trim() && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: data.name.trim() });
      }
      router.replace("/");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            source={require("@/assets/login-illustration.png")}
            style={styles.illustration}
            contentFit="contain"
            accessibilityLabel=""
          />
          <ThemedText type="subtitle" style={[styles.heading, { color: colors.primary }]}>
            Criar conta
          </ThemedText>
          <ThemedText style={styles.lead}>Preencha os dados abaixo para começar.</ThemedText>

          <View style={styles.form}>
            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>
              Nome
            </ThemedText>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Seu nome"
                  autoComplete="name"
                  editable={!isSubmitting}
                />
              )}
            />

            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>
              E-mail
            </ThemedText>
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
              <ThemedText style={[styles.error, { color: colors.destructive }]}>
                {errors.email.message}
              </ThemedText>
            ) : null}

            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>
              Senha
            </ThemedText>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  autoComplete="new-password"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.password ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>
                {errors.password.message}
              </ThemedText>
            ) : null}

            <ThemedText style={[styles.label, { color: colors.foreground, opacity: 0.9 }]}>
              Confirmar senha
            </ThemedText>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Repita a senha"
                  secureTextEntry
                  autoComplete="new-password"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.confirmPassword ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>
                {errors.confirmPassword.message}
              </ThemedText>
            ) : null}

            {firebaseError ? (
              <ThemedText style={[styles.error, { color: colors.destructive }]}>
                {firebaseError}
              </ThemedText>
            ) : null}

            <Button
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.submitBtn}
            >
              {isSubmitting ? "Criando conta…" : "Criar conta"}
            </Button>
          </View>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Já tem conta? </ThemedText>
            <Button variant="link" onPress={() => router.push("/login")}>
              Entrar
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { maxWidth: 400, width: "100%", alignSelf: "center" },
  brand: { textAlign: "center", marginBottom: 8 },
  illustration: {
    width: "100%",
    maxWidth: 200,
    height: 140,
    alignSelf: "center",
    marginBottom: 16,
  },
  heading: { textAlign: "center", marginBottom: 4 },
  lead: { textAlign: "center", marginBottom: 24, opacity: 0.9 },
  form: { gap: 12, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: -10 },
  error: { fontSize: 14, fontWeight: "500" },
  submitBtn: { width: "100%", marginTop: 8 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: -10,
  },
  footerText: { marginRight: 4 },
});
