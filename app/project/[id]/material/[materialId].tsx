import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import {
  getPreferences,
  setPreferences,
  getPreferredStudyTab,
  getSessionDuration,
  getDisplayResumo as getDisplayResumoFromPrefs,
  type UserPreferences,
} from "@/lib/preferences";
import {
  isDueForReview,
  getNextReviewDateFromLevel,
  todayISO,
} from "@/lib/spaced-repetition";
import type { Project, ProjectCard, Material } from "@/types/project";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/atoms/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { usePreferencesContext } from "@/contexts/PreferencesContext";
import {
  StudyScreen,
  type MaterialStudyScope,
  type StudyTab,
} from "@/components/study";

function estimateMin(m: Material): number {
  const count = m.flashcards?.length ?? m.cards?.length ?? 0;
  return Math.max(5, count * 3);
}

export default function MaterialStudyScreen() {
  const router = useRouter();
  const { id: projectId, materialId } = useLocalSearchParams<{ id: string; materialId: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const prefsContext = usePreferencesContext();
  const inProgressSent = useRef(false);

  const [project, setProject] = useState<Project | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [activeTab, setActiveTab] = useState<StudyTab>("flashcards");
  const [modoFoco, setModoFoco] = useState(false);
  const [showSessionReminder, setShowSessionReminder] = useState(false);
  const [pomodoroBreak, setPomodoroBreak] = useState<{ active: boolean; secondsLeft: number }>({
    active: false,
    secondsLeft: 0,
  });
  const [showTimerCompleteModal, setShowTimerCompleteModal] = useState(false);
  const [sessionMinutesOverride, setSessionMinutesOverride] = useState<number | null>(null);
  const [editResumoOpen, setEditResumoOpen] = useState(false);
  const [editResumoValue, setEditResumoValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [markedAsReviewed, setMarkedAsReviewed] = useState(false);

  const loadProject = useCallback(() => {
    if (!projectId || !materialId) {
      setNotFound(true);
      setLoading(false);
      return () => {};
    }
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    if (!auth || !db) {
      setLoading(false);
      return () => {};
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "projects", projectId));
        if (!snap.exists() || snap.data()?.userId !== user.uid) {
          setNotFound(true);
          return;
        }
        const d = snap.data()!;
        const materiais: Material[] = Array.isArray(d.materiais)
          ? d.materiais
          : d.resumo || (d.cards as unknown[])?.length > 0 || (d.flashcards as unknown[])?.length > 0
            ? [
                {
                  id: "legacy",
                  nomeArquivo: "PDF",
                  resumo: d.resumo ?? "",
                  cards: (d.cards as ProjectCard[]) ?? [],
                  flashcards: (d.flashcards as Material["flashcards"]) ?? undefined,
                },
              ]
            : [];
        const mat = materiais.find((m) => m.id === materialId);
        if (!mat) {
          setNotFound(true);
          return;
        }
        setProject({
          id: snap.id,
          userId: d.userId,
          title: d.title ?? "Sem título",
          emoji: d.emoji ?? "📚",
          pdfCount: d.pdfCount ?? 0,
          progress: d.progress ?? 0,
          lastAccess: "",
          materiais,
          resumo: d.resumo,
          cards: d.cards ?? [],
          createdAt: d.createdAt,
        });
        setMaterial(mat);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [projectId, materialId]);

  useEffect(() => {
    const unsub = loadProject();
    return () => unsub?.();
  }, [loadProject]);

  useEffect(() => {
    getPreferences().then((p) => {
      setPrefs(p);
      const tab = getPreferredStudyTab(p);
      setActiveTab(tab);
      setModoFoco(p.modoFoco);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      prefsContext?.refresh();
    }, [prefsContext])
  );

  useEffect(() => {
    if (!pomodoroBreak.active || pomodoroBreak.secondsLeft <= 0) return;
    const t = setInterval(() => {
      setPomodoroBreak((prev) =>
        prev.secondsLeft <= 1
          ? { active: false, secondsLeft: 0 }
          : { ...prev, secondsLeft: prev.secondsLeft - 1 }
      );
    }, 1000);
    return () => clearInterval(t);
  }, [pomodoroBreak.active, pomodoroBreak.secondsLeft]);

  // Marcar material como "in_progress" ao abrir
  useEffect(() => {
    if (inProgressSent.current || !projectId || !materialId || !project?.materiais) return;
    if (material?.status === "in_progress" || material?.status === "completed") return;
    const db = getFirestoreDb();
    if (!db) return;
    inProgressSent.current = true;
    const updated = project.materiais.map((m) =>
      m.id === materialId ? { ...m, status: "in_progress" as const } : m
    );
    updateDoc(doc(db, "projects", projectId), {
      materiais: updated,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [projectId, materialId, project?.materiais, material?.status]);

  const handleConcluir = async () => {
    if (!projectId || !materialId || !project?.materiais) return;
    const db = getFirestoreDb();
    if (!db) return;
    const updated = project.materiais.map((m) =>
      m.id === materialId ? { ...m, status: "completed" as const } : m
    );
    const completedCount = updated.filter((m) => (m.status ?? "pending") === "completed").length;
    const progress = updated.length === 0 ? 0 : Math.round((completedCount / updated.length) * 100);
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", projectId), {
        materiais: updated,
        progress,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated } : null));
      setMaterial((m) => (m ? { ...m, status: "completed" } : null));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResumo = async () => {
    if (!projectId || !materialId || !project?.materiais) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      const updated = project.materiais.map((m) =>
        m.id === materialId ? { ...m, resumo: editResumoValue } : m
      );
      await updateDoc(doc(db, "projects", projectId), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setMaterial((m) => (m ? { ...m, resumo: editResumoValue } : null));
      setProject((p) => (p ? { ...p, materiais: updated } : null));
      setEditResumoOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsReviewed = async () => {
    if (!projectId || !materialId || !project?.materiais || !material) return;
    const db = getFirestoreDb();
    if (!db) return;
    const level = Math.min((material.intervalLevel ?? 0) + 1, 4);
    const nextReviewAt = getNextReviewDateFromLevel(level);
    const lastReviewedAt = todayISO();
    const updated = project.materiais.map((m) =>
      m.id === materialId ? { ...m, lastReviewedAt, nextReviewAt, intervalLevel: level } : m
    );
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", projectId), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setMaterial((m) => (m ? { ...m, lastReviewedAt, nextReviewAt, intervalLevel: level } : null));
      setProject((p) => (p ? { ...p, materiais: updated } : null));
      setMarkedAsReviewed(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async (opts: {
    mode: "edit" | "new";
    index?: number;
    titulo: string;
    conteudo: string;
  }) => {
    if (!projectId || !materialId || !project?.materiais || !material) return;
    const db = getFirestoreDb();
    if (!db) return;
    const useFlashcardsHere = Boolean(material.flashcards && material.flashcards.length > 0);
    if (useFlashcardsHere) {
      const prev = material.flashcards ?? [];
      let newFlashcards: Array<{ titulo: string; conteudo: string }>;
      if (opts.mode === "new") {
        newFlashcards = [...prev, { titulo: opts.titulo, conteudo: opts.conteudo }];
      } else if (opts.mode === "edit" && typeof opts.index === "number") {
        newFlashcards = prev.map((f, i) =>
          i === opts.index ? { titulo: opts.titulo, conteudo: opts.conteudo } : f
        );
      } else return;
      const updated = project.materiais.map((m) =>
        m.id === materialId ? { ...m, flashcards: newFlashcards } : m
      );
      setSaving(true);
      try {
        await updateDoc(doc(db, "projects", projectId), {
          materiais: updated,
          updatedAt: serverTimestamp(),
        });
        setMaterial((m) => (m ? { ...m, flashcards: newFlashcards } : null));
        setProject((p) => (p ? { ...p, materiais: updated } : null));
      } finally {
        setSaving(false);
      }
    } else {
      let newCards: ProjectCard[];
      if (opts.mode === "new") {
        newCards = [...(material.cards ?? []), { titulo: opts.titulo, conteudo: opts.conteudo }];
      } else if (opts.mode === "edit" && typeof opts.index === "number") {
        const prev = material.cards ?? [];
        newCards = prev.map((c, i) =>
          i === opts.index ? { ...c, titulo: opts.titulo, conteudo: opts.conteudo } : c
        );
      } else return;
      const updated = project.materiais.map((m) =>
        m.id === materialId ? { ...m, cards: newCards } : m
      );
      setSaving(true);
      try {
        await updateDoc(doc(db, "projects", projectId), {
          materiais: updated,
          updatedAt: serverTimestamp(),
        });
        setMaterial((m) => (m ? { ...m, cards: newCards } : null));
        setProject((p) => (p ? { ...p, materiais: updated } : null));
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteCard = async (index: number) => {
    if (!projectId || !materialId || !project?.materiais || !material) return;
    const db = getFirestoreDb();
    if (!db) return;
    const useFlashcardsHere = Boolean(material.flashcards && material.flashcards.length > 0);
    setSaving(true);
    try {
      if (useFlashcardsHere) {
        const prev = material.flashcards ?? [];
        if (index < 0 || index >= prev.length) return;
        const newFlashcards = prev.filter((_, i) => i !== index);
        const updated = project.materiais.map((m) =>
          m.id === materialId ? { ...m, flashcards: newFlashcards } : m
        );
        await updateDoc(doc(db, "projects", projectId), {
          materiais: updated,
          updatedAt: serverTimestamp(),
        });
        setMaterial((m) => (m ? { ...m, flashcards: newFlashcards } : null));
        setProject((p) => (p ? { ...p, materiais: updated } : null));
      } else {
        const prev = material.cards ?? [];
        if (index < 0 || index >= prev.length) return;
        const newCards = prev.filter((_, i) => i !== index);
        const updated = project.materiais.map((m) =>
          m.id === materialId ? { ...m, cards: newCards } : m
        );
        await updateDoc(doc(db, "projects", projectId), {
          materiais: updated,
          updatedAt: serverTimestamp(),
        });
        setMaterial((m) => (m ? { ...m, cards: newCards } : null));
        setProject((p) => (p ? { ...p, materiais: updated } : null));
      }
      const newLen = useFlashcardsHere
        ? (material.flashcards ?? []).filter((_, i) => i !== index).length
        : (material.cards ?? []).filter((_, i) => i !== index).length;
      if (cardIndex >= newLen && newLen > 0) setCardIndex(newLen - 1);
      else if (newLen === 0) setCardIndex(0);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  if (notFound || !project || !material) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <ThemedText style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          Tópico não encontrado.
        </ThemedText>
        <Button onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.primaryForeground} />
          <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
            Voltar
          </ThemedText>
        </Button>
      </ThemedView>
    );
  }

  const cards = material.cards ?? [];
  const cardsForCarousel: ProjectCard[] =
    material.flashcards && material.flashcards.length > 0
      ? material.flashcards.map((f) => ({ titulo: f.titulo, conteudo: f.conteudo }))
      : cards;
  const nivelResumo = prefs?.nivelResumo ?? "medio";
  const resumoText = getDisplayResumoFromPrefs(material, nivelResumo);
  const minEst = estimateMin(material);
  const dueForReview = isDueForReview(material.nextReviewAt) && !markedAsReviewed;
  const sessionDuration = prefs ? getSessionDuration(prefs) : { minutes: 28, label: "25-30 min" };
  const workMinutesBase = prefs?.pomodoroWorkMinutes ?? sessionDuration.minutes;
  const effectiveMinutes = Math.min(workMinutesBase, minEst);
  const sessionMinutes = sessionMinutesOverride ?? effectiveMinutes;
  const effectiveLabel =
    effectiveMinutes < workMinutesBase
      ? `${effectiveMinutes} min`
      : prefs?.pomodoroWorkMinutes != null
        ? `${workMinutesBase} min`
        : sessionDuration.label;
  const pomodoroBreakMinutes = Math.min(60, Math.max(1, prefs?.pomodoroBreakMinutes ?? 5));

  const scope: MaterialStudyScope = {
    type: "material",
    title: material.nomeArquivo ?? "Tópico",
    meta: `~${minEst} min · ${cardsForCarousel.length} card${cardsForCarousel.length !== 1 ? "s" : ""}${prefs ? ` · Duração sugerida: ${effectiveLabel}` : ""}`,
    backLabel: "Voltar ao projeto",
    cardsForCarousel,
    cardsForQuiz: cards,
    resumoText: resumoText?.trim() || null,
    dueForReview,
    showConcluirTópico: true,
    emptyFlashcardsMessage:
      'Nenhum card neste tópico. Crie flashcards em "Minhas flashcards".',
    quizEmptyText: "Nenhum card para quiz neste tópico.",
    chatHeaderText: "Pergunte sobre este tópico. A IA usa o resumo como contexto.",
    buildChatContext: () => resumoText || "Sem resumo.",
    editResumoOpen,
    editResumoValue,
    saving,
    onBack: () => router.back(),
    onConcluir: handleConcluir,
    onMarkAsReviewed: handleMarkAsReviewed,
    onSaveResumo: handleSaveResumo,
    setEditResumoOpen,
    setEditResumoValue,
    onSaveCard: handleSaveCard,
    onDeleteCard: handleDeleteCard,
  };

  return (
    <StudyScreen
      scope={scope}
      insets={insets}
      prefs={prefs}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      cardIndex={cardIndex}
      setCardIndex={setCardIndex}
      flipped={flipped}
      setFlipped={setFlipped}
      modoFoco={modoFoco}
      setModoFoco={setModoFoco}
      showSessionReminder={showSessionReminder}
      pomodoroBreak={pomodoroBreak}
      setPomodoroBreak={setPomodoroBreak}
      showTimerCompleteModal={showTimerCompleteModal}
      setShowTimerCompleteModal={setShowTimerCompleteModal}
      sessionMinutes={sessionMinutes}
      onSessionMinutesChange={async (minutes) => {
        setSessionMinutesOverride(minutes);
        await setPreferences({ pomodoroWorkMinutes: minutes });
      }}
      pomodoroBreakMinutes={pomodoroBreakMinutes}
      setShowSessionReminder={setShowSessionReminder}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  notFoundText: { marginBottom: 16, textAlign: "center" },
});
