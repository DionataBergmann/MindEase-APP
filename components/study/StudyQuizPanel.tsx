import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/atoms/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import type { ProjectCard } from "@/types/project";

type QuizItem = { question: string; correctAnswer: string; options: string[] };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildQuizItems(cards: ProjectCard[]): QuizItem[] {
  if (cards.length === 0) return [];
  return shuffle(cards).map((card) => {
    if (
      Array.isArray(card.opcoes) &&
      card.opcoes.length > 0 &&
      typeof card.correctOptionIndex === "number" &&
      card.correctOptionIndex >= 0 &&
      card.correctOptionIndex < card.opcoes.length
    ) {
      return {
        question: card.titulo,
        correctAnswer: card.opcoes[card.correctOptionIndex]!,
        options: card.opcoes,
      };
    }
    const allAnswers = cards.map((c) => c.conteudo);
    const others = allAnswers.filter((a) => a !== card.conteudo);
    const wrong = shuffle(others).slice(0, Math.min(3, others.length));
    const options = shuffle([card.conteudo, ...wrong]);
    return { question: card.titulo, correctAnswer: card.conteudo, options };
  });
}

export type StudyQuizPanelProps = {
  cards: ProjectCard[];
  emptyText: string;
};

export function StudyQuizPanel({ cards, emptyText }: StudyQuizPanelProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const quizItems = useMemo(() => buildQuizItems(cards), [cards]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedIndex, setQuizSelectedIndex] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizNextLoading, setQuizNextLoading] = useState(false);

  const currentQuiz = quizItems[quizIndex] ?? null;
  const quizAnswered = quizSelectedIndex !== null;
  const quizCorrect =
    currentQuiz !== null &&
    quizSelectedIndex !== null &&
    currentQuiz.options[quizSelectedIndex] === currentQuiz.correctAnswer;
  const isQuizEnd = quizStarted && quizItems.length > 0 && quizIndex >= quizItems.length;

  React.useEffect(() => {
    if (
      !quizAnswered ||
      !quizCorrect ||
      quizItems.length === 0 ||
      quizIndex >= quizItems.length - 1
    )
      return;
    const t1 = setTimeout(() => setQuizNextLoading(true), 1500);
    const t2 = setTimeout(() => {
      setQuizIndex((i) => i + 1);
      setQuizSelectedIndex(null);
      setQuizNextLoading(false);
    }, 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [quizAnswered, quizCorrect, quizIndex, quizItems.length]);

  if (cards.length === 0) {
    return (
      <View
        style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {emptyText}
        </ThemedText>
      </View>
    );
  }

  if (!quizStarted) {
    return (
      <View
        style={[styles.startCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Feather name="help-circle" size={48} color={colors.primary} style={styles.startIcon} />
        <ThemedText style={styles.startTitle}>Quiz</ThemedText>
        <ThemedText style={[styles.startSubtitle, { color: colors.mutedForeground }]}>
          {quizItems.length} pergunta{quizItems.length !== 1 ? "s" : ""} com múltipla escolha.
        </ThemedText>
        <Button
          onPress={() => {
            setQuizStarted(true);
            setQuizIndex(0);
            setQuizSelectedIndex(null);
            setQuizScore(0);
          }}
        >
          Iniciar quiz
        </Button>
      </View>
    );
  }

  if (isQuizEnd) {
    return (
      <View style={[styles.endCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="award" size={48} color={colors.primary} style={styles.endIcon} />
        <ThemedText style={styles.endTitle}>Quiz concluído</ThemedText>
        <ThemedText style={styles.endScore}>
          {quizScore} / {quizItems.length}
        </ThemedText>
        <ThemedText style={[styles.endSubtitle, { color: colors.mutedForeground }]}>
          {quizItems.length > 0 ? Math.round((quizScore / quizItems.length) * 100) : 0}% de acertos
        </ThemedText>
        <Button
          variant="outline"
          onPress={() => {
            setQuizStarted(false);
            setQuizIndex(0);
            setQuizSelectedIndex(null);
          }}
        >
          Fazer de novo
        </Button>
      </View>
    );
  }

  if (!currentQuiz) return null;

  const correctOptionIndex = currentQuiz.options.indexOf(currentQuiz.correctAnswer);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View
        style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <ThemedText style={[styles.questionMeta, { color: colors.mutedForeground }]}>
          Pergunta {quizIndex + 1} de {quizItems.length}
        </ThemedText>
        <ThemedText style={styles.questionText}>{currentQuiz.question}</ThemedText>
        <View style={styles.options}>
          {currentQuiz.options.map((opt, i) => {
            const isCorrect = i === correctOptionIndex;
            const isSelected = quizSelectedIndex === i;
            const showResult = quizAnswered;
            const variant =
              showResult && isCorrect
                ? "default"
                : showResult && isSelected && !isCorrect
                  ? "destructive"
                  : "outline";
            return (
              <Button
                key={i}
                variant={variant}
                disabled={quizAnswered}
                onPress={() => {
                  if (quizSelectedIndex !== null) return;
                  setQuizSelectedIndex(i);
                  if (opt === currentQuiz.correctAnswer) setQuizScore((s) => s + 1);
                }}
                style={[
                  styles.optionBtn,
                  variant === "default" && { backgroundColor: colors.primary },
                ]}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    {
                      color:
                        variant === "default"
                          ? colors.primaryForeground
                          : variant === "destructive"
                            ? colors.destructiveForeground
                            : colors.foreground,
                    },
                  ]}
                  numberOfLines={4}
                >
                  {opt}
                </ThemedText>
              </Button>
            );
          })}
        </View>
      </View>

      {quizAnswered && (
        <View
          style={[
            styles.feedback,
            {
              backgroundColor: quizCorrect ? colors.primary + "20" : colors.destructive + "20",
            },
          ]}
        >
          <ThemedText
            style={[
              styles.feedbackText,
              { color: quizCorrect ? colors.primary : colors.destructive },
            ]}
          >
            {quizCorrect ? "Correto!" : `Resposta correta: ${currentQuiz.correctAnswer}`}
          </ThemedText>
        </View>
      )}

      {quizAnswered && quizCorrect && quizNextLoading && (
        <View style={styles.nextLoading}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <ThemedText style={[styles.nextLoadingText, { color: colors.mutedForeground }]}>
            Próxima pergunta...
          </ThemedText>
        </View>
      )}

      {quizAnswered && (
        <View style={styles.navButtons}>
          <Button
            variant="outline"
            onPress={() => {
              setQuizIndex((i) => i - 1);
              setQuizSelectedIndex(null);
            }}
            disabled={quizIndex === 0}
            style={styles.navBtn}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
            <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>Anterior</ThemedText>
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              setQuizIndex((i) => i + 1);
              setQuizSelectedIndex(null);
            }}
            style={styles.navBtn}
          >
            <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>Próxima</ThemedText>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center" },
  emptyText: { textAlign: "center" },
  startCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center" },
  startIcon: { marginBottom: 16 },
  startTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  startSubtitle: { fontSize: 14, marginBottom: 20, textAlign: "center" },
  endCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center" },
  endIcon: { marginBottom: 16 },
  endTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  endScore: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  endSubtitle: { fontSize: 14, marginBottom: 20 },
  questionCard: { borderRadius: 12, borderWidth: 1, padding: 20, marginBottom: 16 },
  questionMeta: { fontSize: 12, marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  options: { gap: 10 },
  optionBtn: { alignItems: "flex-start", minHeight: 48, paddingVertical: 12 },
  optionText: { textAlign: "left" },
  feedback: { borderRadius: 8, padding: 16, marginBottom: 12 },
  feedbackText: { fontWeight: "500" },
  nextLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  nextLoadingText: { fontSize: 14 },
  navButtons: { flexDirection: "row", gap: 16 },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
});
