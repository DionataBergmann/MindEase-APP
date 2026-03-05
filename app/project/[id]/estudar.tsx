import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';

export default function EstudarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Estudar</ThemedText>
      <ThemedText style={styles.subtitle}>Projeto {id} — em breve</ThemedText>
      <Button onPress={() => router.back()}>Voltar</Button>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  subtitle: { opacity: 0.8 },
});
