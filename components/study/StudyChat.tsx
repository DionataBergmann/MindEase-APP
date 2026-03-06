import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { chat } from '@/lib/api';

export type StudyChatProps = {
  headerText: string;
  buildContext: () => string;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function StudyChat({ headerText, buildContext }: StudyChatProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleSubmit = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const context = buildContext();
      const { message } = await chat({
        context,
        messages: [...chatMessages, { role: 'user', content: text }],
      });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: message ?? '' }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Erro ao conversar.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.headerText, { color: colors.mutedForeground }]}>
          {headerText}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {chatMessages.length === 0 && (
          <ThemedText style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Envie uma mensagem para começar.
          </ThemedText>
        )}
        {chatMessages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubbleWrap,
              m.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
            ]}
          >
            <View
              style={[
                styles.bubble,
                m.role === 'user'
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.muted },
              ]}
            >
              <ThemedText
                style={[
                  styles.bubbleText,
                  m.role === 'user' ? { color: colors.primaryForeground } : { color: colors.foreground },
                ]}
              >
                {m.content}
              </ThemedText>
            </View>
          </View>
        ))}
        {chatLoading && (
          <View style={styles.bubbleWrapAssistant}>
            <View style={[styles.bubble, { backgroundColor: colors.muted }]}>
              <ThemedText style={[styles.bubbleText, { color: colors.mutedForeground }]}>
                ...
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.footer, { borderTopColor: colors.border }]}
      >
        <Input
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Sua pergunta..."
          editable={!chatLoading}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Button
          onPress={handleSubmit}
          disabled={chatLoading || !chatInput.trim()}
          style={styles.sendBtn}
        >
          {chatLoading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="send" size={18} color={colors.primaryForeground} />
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>
                Enviar
              </ThemedText>
            </>
          )}
        </Button>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', minHeight: 280 },
  header: { padding: 16, borderBottomWidth: 1 },
  headerText: { fontSize: 14 },
  messages: { maxHeight: 360 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  bubbleWrap: { marginBottom: 12 },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubbleWrapAssistant: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14 },
  footer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 100 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
