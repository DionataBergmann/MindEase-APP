import React, { useState, useEffect, useCallback } from "react";
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
import { isCardDueForReview } from "@/lib/spaced-repetition";
import type { Project, ProjectCard, Material } from "@/types/project";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/atoms/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { usePreferencesContext } from "@/contexts/PreferencesContext";
import {
  StudyScreen,
  type ProjectStudyScope,
  type StudyTab,
  type ResumoBlock,
  type ProjectCardWithSource,
} from "@/components/study";

function getAllCards(project: Project): ProjectCard[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) => m.cards ?? []);
  }
  if (project.cards?.length) return project.cards;
  return [];
}

function getResumosWithMaterial(
  project: Project,
  nivelResumo: UserPreferences["nivelResumo"]
): ResumoBlock[] {
  if (project.materiais?.length) {
    return project.materiais
      .map((m) => ({
        materialId: m.id,
        nomeArquivo: m.nomeArquivo ?? "PDF",
        resumo: getDisplayResumoFromPrefs(m, nivelResumo),
      }))
      .filter((b) => b.resumo.trim());
  }
  if (project.resumo) {
    return [{ materialId: "legacy", nomeArquivo: "PDF", resumo: project.resumo }];
  }
  return [];
}

function getCardsWithSourceForCarousel(project: Project): ProjectCardWithSource[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) => {
      const useFlashcards = Boolean(m.flashcards && m.flashcards.length > 0);
      const set = useFlashcards
        ? (m.flashcards ?? []).map((f) => ({ titulo: f.titulo, conteudo: f.conteudo }))
        : (m.cards ?? []);
      return set.map((item, i) => ({
        materialId: m.id,
        materialName: m.nomeArquivo ?? "PDF",
        card: useFlashcards
          ? { titulo: item.titulo, conteudo: item.conteudo }
          : (item as ProjectCard),
        indexInMaterial: i,
        useFlashcards,
      }));
    });
  }
  if (project.cards?.length) {
    return project.cards.map((card, i) => ({
      materialId: "legacy",
      materialName: "PDF",
      card,
      indexInMaterial: i,
      useFlashcards: false as const,
    }));
  }
  return [];
}

function getCardsForCarousel(project: Project): ProjectCard[] {
  return getCardsWithSourceForCarousel(project).map((x) => x.card);
}

function getMateriais(project: Project): Material[] {
  if (project.materiais?.length) return project.materiais;
  if (project.resumo || (project.cards?.length ?? 0) > 0) {
    return [
      {
        id: "legacy",
        nomeArquivo: "PDF",
        resumo: project.resumo ?? "",
        cards: project.cards ?? [],
      },
    ];
  }
  return [];
}

export default function EstudarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const prefsContext = usePreferencesContext();

  const [project, setProject] = useState<Project | null>(null);
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
  const [editResumoMaterialId, setEditResumoMaterialId] = useState<string | null>(null);
  const [editResumoValue, setEditResumoValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProject = useCallback(() => {
    if (!id) {
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
        const snap = await getDoc(doc(db, "projects", id));
        if (!snap.exists() || snap.data()?.userId !== user.uid) {
          setNotFound(true);
          setProject(null);
        } else {
          const d = snap.data()!;
          setProject({
            id: snap.id,
            userId: d.userId,
            title: d.title ?? "Sem título",
            emoji: d.emoji ?? "📚",
            pdfCount: d.pdfCount ?? 0,
            progress: d.progress ?? 0,
            lastAccess: "",
            materiais: d.materiais,
            resumo: d.resumo,
            cards: d.cards ?? [],
            createdAt: d.createdAt,
          });
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = loadProject();
    return () => unsub?.();
  }, [loadProject]);

  useEffect(() => {
    getPreferences().then((p) => {
      setPrefs(p);
      setActiveTab(getPreferredStudyTab(p) as StudyTab);
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

  const handleSaveResumo = async () => {
    if (!id || !project || !editResumoMaterialId) return;
    const db = getFirestoreDb();
    if (!db) return;
    const materiais = getMateriais(project);
    const updated = materiais.map((m) =>
      m.id === editResumoMaterialId ? { ...m, resumo: editResumoValue } : m
    );
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", id), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated } : null));
      setEditResumoMaterialId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async (opts: {
    mode: "edit" | "new";
    materialId: string;
    indexInMaterial?: number;
    titulo: string;
    conteudo: string;
  }) => {
    if (!id || !project) return;
    const db = getFirestoreDb();
    if (!db) return;
    const materiais = getMateriais(project);
    const mat = materiais.find((m) => m.id === opts.materialId);
    if (!mat) return;
    const useFlashcards = Boolean(mat.flashcards && mat.flashcards.length > 0);
    let updated: Material[];
    if (opts.mode === "edit" && typeof opts.indexInMaterial === "number") {
      if (useFlashcards) {
        const prev = mat.flashcards ?? [];
        const newFlashcards = prev.map((f, i) =>
          i === opts.indexInMaterial ? { titulo: opts.titulo, conteudo: opts.conteudo } : f
        );
        updated = materiais.map((m) =>
          m.id === opts.materialId ? { ...m, flashcards: newFlashcards } : m
        );
      } else {
        const newCards = (mat.cards ?? []).map((c, i) =>
          i === opts.indexInMaterial ? { ...c, titulo: opts.titulo, conteudo: opts.conteudo } : c
        );
        updated = materiais.map((m) => (m.id === opts.materialId ? { ...m, cards: newCards } : m));
      }
    } else if (opts.mode === "new") {
      if (useFlashcards) {
        const prev = mat.flashcards ?? [];
        const newFlashcards = [...prev, { titulo: opts.titulo, conteudo: opts.conteudo }];
        updated = materiais.map((m) =>
          m.id === opts.materialId ? { ...m, flashcards: newFlashcards } : m
        );
      } else {
        const newCards = [...(mat.cards ?? []), { titulo: opts.titulo, conteudo: opts.conteudo }];
        updated = materiais.map((m) => (m.id === opts.materialId ? { ...m, cards: newCards } : m));
      }
    } else return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", id), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated } : null));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (item: ProjectCardWithSource) => {
    if (!id || !project) return;
    const db = getFirestoreDb();
    if (!db) return;
    const materiais = getMateriais(project);
    const mat = materiais.find((m) => m.id === item.materialId);
    if (!mat) return;
    let updated: Material[];
    if (item.useFlashcards) {
      const prev = mat.flashcards ?? [];
      const newFlashcards = prev.filter((_, i) => i !== item.indexInMaterial);
      updated = materiais.map((m) =>
        m.id === item.materialId ? { ...m, flashcards: newFlashcards } : m
      );
    } else {
      const newCards = (mat.cards ?? []).filter((_, i) => i !== item.indexInMaterial);
      updated = materiais.map((m) =>
        m.id === item.materialId ? { ...m, cards: newCards } : m
      );
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", id), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated } : null));
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

  if (notFound || !project) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <ThemedText style={[styles.notFoundText, { color: colors.mutedForeground }]}>
          Projeto não encontrado ou você não tem acesso.
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

  const cards = getAllCards(project);
  const cardsForCarousel = getCardsForCarousel(project);
  const cardsWithSourceForCarousel = getCardsWithSourceForCarousel(project);
  const nivelResumo = prefs?.nivelResumo ?? "medio";
  const resumosWithMaterial = getResumosWithMaterial(project, nivelResumo);
  const materiais = getMateriais(project);
  const totalMin = Math.max(5, cardsForCarousel.length * 3);
  const sessionDuration = prefs ? getSessionDuration(prefs) : { minutes: 28, label: "25-30 min" };
  const workMinutesBase = prefs?.pomodoroWorkMinutes ?? sessionDuration.minutes;
  const effectiveMinutes = Math.min(workMinutesBase, totalMin);
  const sessionMinutes = sessionMinutesOverride ?? effectiveMinutes;
  const effectiveLabel =
    effectiveMinutes < workMinutesBase
      ? `${effectiveMinutes} min`
      : prefs?.pomodoroWorkMinutes != null
        ? `${workMinutesBase} min`
        : sessionDuration.label;
  const pomodoroBreakMinutes = Math.min(60, Math.max(1, prefs?.pomodoroBreakMinutes ?? 5));

  const scope: ProjectStudyScope = {
    type: "project",
    title: `Estudar: ${project.title}`,
    meta: `~${totalMin} min · ${cardsForCarousel.length} card${cardsForCarousel.length !== 1 ? "s" : ""}${prefs ? ` · Duração sugerida: ${effectiveLabel}` : ""}`,
    backLabel: "Voltar ao projeto",
    cardsForCarousel,
    cardsForQuiz: cards,
    cardsWithSourceForCarousel,
    materiais,
    resumosWithMaterial,
    emptyFlashcardsMessage: "Nenhum card para estudar. Adicione PDFs ao projeto para gerar cards.",
    quizEmptyText: "Nenhum card para quiz. Adicione PDFs ao projeto.",
    chatHeaderText: "Pergunte sobre o conteúdo do projeto.",
    buildChatContext: () =>
      resumosWithMaterial.map((b) => `${b.nomeArquivo}:\n${b.resumo}`).join("\n\n"),
    editResumoMaterialId,
    editResumoValue,
    saving,
    onBack: () => router.back(),
    onSaveResumo: handleSaveResumo,
    setEditResumoMaterialId,
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
