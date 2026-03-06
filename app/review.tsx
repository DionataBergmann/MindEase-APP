import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import Feather from '@expo/vector-icons/Feather';
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase';
import {
  isCardDueForReview,
  getNextReviewDateFromLevel,
  CARD_RATING_LEVEL,
  CARD_RATING_DAYS,
} from '@/lib/spaced-repetition';
import type { Project, Material, ProjectCard } from '@/types/project';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { FlashcardCarousel } from '@/components/study';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

type DueCardItem = { project: Project; material: Material; cardIndex: number; card: ProjectCard };

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionCards, setSessionCards] = useState<DueCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/(tabs)');
        return;
      }
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: Project[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            const materiais: Material[] = Array.isArray(data.materiais)
              ? data.materiais
              : data.resumo || (data.cards?.length ?? 0) > 0
                ? [
                    {
                      id: 'legacy',
                      nomeArquivo: 'PDF',
                      resumo: data.resumo ?? '',
                      cards: data.cards ?? [],
                    },
                  ]
                : [];
            return {
              id: docSnap.id,
              userId: data.userId,
              title: data.title ?? 'Sem título',
              emoji: data.emoji ?? '📚',
              pdfCount: data.pdfCount ?? materiais.length,
              progress: data.progress ?? 0,
              lastAccess: '',
              resumo: data.resumo,
              cards: data.cards,
              materiais,
              createdAt: data.createdAt,
            };
          });
          setProjects(list);
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, [router]);

  const dueCardsList = useMemo(() => {
    const out: DueCardItem[] = [];
    projects.forEach((p) => {
      p.materiais?.forEach((m) => {
        (m.cards ?? []).forEach((card, cardIndex) => {
          if (isCardDueForReview(card)) out.push({ project: p, material: m, cardIndex, card });
        });
      });
    });
    return out;
  }, [projects]);

  useEffect(() => {
    if (dueCardsList.length > 0 && sessionCards.length === 0) {
      setSessionCards(dueCardsList);
      setCurrentIndex(0);
      setFlipped(false);
    }
  }, [dueCardsList, sessionCards.length]);

  const current = sessionCards[currentIndex] ?? null;

  const handleRate = async (rating: 'dificil' | 'medio' | 'facil') => {
    if (!current) return;
    const db = getFirestoreDb();
    if (!db) return;
    const level = CARD_RATING_LEVEL[rating];
    const nextReviewAt = getNextReviewDateFromLevel(level);
    const { project, material, cardIndex } = current;
    const updatedCards = (material.cards ?? []).map((c, i) =>
      i === cardIndex ? { ...c, nextReviewAt, intervalLevel: level } : c
    );
    const updatedMateriais = (project.materiais ?? []).map((m) =>
      m.id === material.id ? { ...m, cards: updatedCards } : m
    );
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        materiais: updatedMateriais,
        updatedAt: serverTimestamp(),
      });
      setFlipped(false);
      if (currentIndex < sessionCards.length - 1) setCurrentIndex((i) => i + 1);
      else setCurrentIndex(sessionCards.length);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingWrap, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  if (sessionCards.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
            <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>Voltar à Biblioteca</ThemedText>
          </TouchableOpacity>
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="layers" size={48} color={colors.mutedForeground} style={styles.emptyIcon} />
            <ThemedText style={styles.emptyTitle}>Nenhum card para revisar</ThemedText>
            <ThemedText style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Quando você classificar cards como Fácil, Médio ou Difícil, eles entrarão na fila de revisão e aparecerão aqui.
            </ThemedText>
            <Button onPress={() => router.back()}>
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Ir para Biblioteca</ThemedText>
            </Button>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (currentIndex >= sessionCards.length) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
            <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>Voltar à Biblioteca</ThemedText>
          </TouchableOpacity>
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="layers" size={48} color={colors.primary} style={styles.emptyIcon} />
            <ThemedText style={styles.emptyTitle}>Revisão concluída</ThemedText>
            <ThemedText style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Você revisou {sessionCards.length} card{sessionCards.length !== 1 ? 's' : ''}.
            </ThemedText>
            <Button onPress={() => router.back()}>
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Voltar à Biblioteca</ThemedText>
            </Button>
          </View>
        </View>
      </ThemedView>
    );
  }

  const reviewCards = sessionCards.map((s) => s.card);
  const footerText = flipped
    ? 'Como foi? Escolha para agendar a próxima revisão.'
    : 'Toque para ver a resposta';

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
          <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>Voltar à Biblioteca</ThemedText>
        </TouchableOpacity>

        <FlashcardCarousel
          cards={reviewCards}
          cardIndex={currentIndex}
          onCardIndexChange={() => {}}
          flipped={flipped}
          onFlippedChange={setFlipped}
          mode="material"
          footerText={footerText}
          renderActions={({ flipped: isFlipped }) =>
            isFlipped ? (
              <View style={styles.buttonsRow}>
                <Button
                  variant="outline"
                  onPress={() => handleRate('dificil')}
                  disabled={saving}
                  style={[styles.rateBtn, { borderColor: colors.destructive + '80' }]}
                >
                  <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>
                    Difícil ({CARD_RATING_DAYS.dificil} dia{CARD_RATING_DAYS.dificil !== 1 ? 's' : ''})
                  </ThemedText>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => handleRate('medio')}
                  disabled={saving}
                  style={styles.rateBtn}
                >
                  <ThemedText style={{ color: colors.foreground, fontWeight: '600' }}>
                    Médio ({CARD_RATING_DAYS.medio} dias)
                  </ThemedText>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => handleRate('facil')}
                  disabled={saving}
                  style={[styles.rateBtn, { borderColor: colors.success + '80' }]}
                >
                  <ThemedText style={{ color: colors.success, fontWeight: '600' }}>
                    Fácil ({CARD_RATING_DAYS.facil} dias)
                  </ThemedText>
                </Button>
              </View>
            ) : null
          }
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  backText: { fontSize: 14 },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  rateBtn: { minWidth: 100 },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
});
