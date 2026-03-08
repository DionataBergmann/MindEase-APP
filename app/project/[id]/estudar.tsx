import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
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
import {
  useSpacingScale,
  useContrastLevel,
  usePreferencesContext,
} from "@/contexts/PreferencesContext";
import {
  FlashcardCarousel,
  StudyQuizPanel,
  StudyChat,
  ProjectFlashcardEditor,
  StudyTimer,
  type ProjectCardWithSource,
} from "@/components/study";

type StudyTab = "flashcards" | "revisar" | "quiz" | "chat" | "minhas_questoes";

function getAllCards(project: Project): ProjectCard[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) => m.cards ?? []);
  }
  if (project.cards?.length) return project.cards;
  return [];
}

type ResumoBlock = { materialId: string; nomeArquivo: string; resumo: string };

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

function getCardsWithSource(project: Project): ProjectCardWithSource[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) =>
      (m.cards ?? []).map((card, i) => ({
        materialId: m.id,
        materialName: m.nomeArquivo ?? "PDF",
        card,
        indexInMaterial: i,
        useFlashcards: false as const,
      }))
    );
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

/** Cards for carousel/study: use flashcards when present, else cards. */
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
  const spacingScale = useSpacingScale();
  const contrastLevel = useContrastLevel();
  const borderW = contrastLevel === "alto" ? 2 : 1;
  const prefsContext = usePreferencesContext();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revisarCardIndex, setRevisarCardIndex] = useState(0);
  const [revisarFlipped, setRevisarFlipped] = useState(false);
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
    if (!project) return;
    const due = getAllCards(project).filter((c) => isCardDueForReview(c));
    if (due.length > 0 && revisarCardIndex >= due.length) {
      setRevisarCardIndex(Math.max(0, due.length - 1));
    }
  }, [project, revisarCardIndex]);

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
  const cardsWithSource = getCardsWithSource(project);
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

  const tabs: { key: StudyTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "flashcards", label: "Flashcards", icon: "layers" },
    { key: "revisar", label: "Revisar", icon: "refresh-cw" },
    { key: "quiz", label: "Quiz", icon: "help-circle" },
    { key: "chat", label: "Chat IA", icon: "message-circle" },
    { key: "minhas_questoes", label: "Minhas flashcards", icon: "file-text" },
  ];

  const cardsDue = cardsForCarousel.filter((c) => isCardDueForReview(c));

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: 16 * spacingScale,
            paddingBottom: (insets.bottom + 24) * spacingScale,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!modoFoco && (
          <TouchableOpacity
            style={[styles.backRow, { marginBottom: 16 * spacingScale, gap: 8 * spacingScale }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
            <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>
              Voltar ao projeto
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedText style={styles.title}>Estudar: {project.title}</ThemedText>
        {!modoFoco && (
          <View style={styles.titleRow}>
            <ThemedText style={[styles.meta, { color: colors.mutedForeground }]}>
                ~{totalMin} min · {cardsForCarousel.length} card{cardsForCarousel.length !== 1 ? "s" : ""}
              {prefs && ` · Duração sugerida: ${effectiveLabel}`}
            </ThemedText>
          </View>
        )}
        {showSessionReminder && !pomodoroBreak.active && (
          <View
            style={[
              styles.reminderBanner,
              {
                backgroundColor: colors.primary + "20",
                borderColor: colors.primary + "50",
                borderWidth: borderW,
                marginBottom: 16 * spacingScale,
                gap: 8 * spacingScale,
                padding: 12 * spacingScale,
              },
            ]}
          >
            <Feather name="clock" size={18} color={colors.primary} />
            <ThemedText style={[styles.reminderText, { color: colors.primary }]}>
              Você está estudando há um tempo. Que tal uma pausa?
            </ThemedText>
          </View>
        )}
        {pomodoroBreak.active && (
          <Modal visible transparent animationType="fade">
            <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <View
                style={[
                  styles.modalCardPausa,
                  { backgroundColor: colors.card, borderColor: colors.primary + "40" },
                ]}
              >
                <ThemedText style={[styles.pomodoroTitle, { color: colors.foreground }]}>
                  Pausa
                </ThemedText>
                {pomodoroBreak.secondsLeft > 0 ? (
                  <>
                    <ThemedText style={[styles.modalHint, { color: colors.mutedForeground }]}>
                      Pausa de {pomodoroBreakMinutes} min — descanse um pouco.
                    </ThemedText>
                    <ThemedText style={[styles.pomodoroTime, { marginVertical: 16 }]}>
                      {String(Math.floor(pomodoroBreak.secondsLeft / 60)).padStart(2, "0")}:
                      {String(pomodoroBreak.secondsLeft % 60).padStart(2, "0")}
                    </ThemedText>
                    <ThemedText
                      style={[styles.modalHint, { color: colors.mutedForeground, fontSize: 12 }]}
                    >
                      Aguarde o fim da pausa para voltar ao estudo.
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText
                      style={[styles.pomodoroTitle, { color: colors.foreground, marginBottom: 16 }]}
                    >
                      Pausa concluída.
                    </ThemedText>
                    <Button
                      onPress={() => {
                        setPomodoroBreak({ active: false, secondsLeft: 0 });
                        setShowSessionReminder(true);
                      }}
                    >
                      <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                        Voltar ao estudo
                      </ThemedText>
                    </Button>
                  </>
                )}
              </View>
            </View>
          </Modal>
        )}

        {/* Modal: timer encerrado */}
        {showTimerCompleteModal && prefs && (
          <Modal visible transparent animationType="fade">
            <Pressable
              style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
              onPress={() => setShowTimerCompleteModal(false)}
            >
              <Pressable
                style={[
                  styles.modalCardPausa,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <ThemedText style={[styles.modalTitle, { color: colors.foreground }]}>
                  Sessão concluída
                </ThemedText>
                <ThemedText style={[styles.modalHint, { color: colors.mutedForeground }]}>
                  O tempo de foco acabou. Que tal uma pausa antes de continuar?
                </ThemedText>
                <View
                  style={{ flexDirection: "row", gap: 12, justifyContent: "center", marginTop: 20 }}
                >
                  {prefs.pausasPomodoro ? (
                    <>
                      <Button
                        onPress={() => {
                          setPomodoroBreak({
                            active: true,
                            secondsLeft: pomodoroBreakMinutes * 60,
                          });
                          setShowTimerCompleteModal(false);
                        }}
                      >
                        <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                          Iniciar pausa ({pomodoroBreakMinutes} min)
                        </ThemedText>
                      </Button>
                      <Button
                        variant="outline"
                        onPress={() => {
                          setShowSessionReminder(true);
                          setShowTimerCompleteModal(false);
                        }}
                      >
                        <ThemedText style={{ color: colors.foreground, fontWeight: "600" }}>
                          Agora não
                        </ThemedText>
                      </Button>
                    </>
                  ) : (
                    <Button
                      onPress={() => {
                        setShowSessionReminder(true);
                        setShowTimerCompleteModal(false);
                      }}
                    >
                      <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                        OK
                      </ThemedText>
                    </Button>
                  )}
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {prefs && !pomodoroBreak.active && (
          <View
            style={[
              styles.timerRow,
              styles.timerAndFocoRow,
              { marginBottom: 16 * spacingScale, gap: 12 * spacingScale },
            ]}
          >
            <StudyTimer
              initialMinutes={sessionMinutes}
              editable
              onMinutesChange={async (minutes) => {
                setSessionMinutesOverride(minutes);
                await setPreferences({ pomodoroWorkMinutes: minutes });
              }}
              onComplete={() => setShowTimerCompleteModal(true)}
            />
            <Button
              variant="outline"
              onPress={async () => {
                const next = !modoFoco;
                setModoFoco(next);
                await setPreferences({ modoFoco: next });
              }}
              style={styles.focoBtn}
            >
              <Feather name="target" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <ThemedText style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                {modoFoco ? "Sair do modo foco" : "Modo foco"}
              </ThemedText>
            </Button>
          </View>
        )}

        {/* Resumos - oculto no modo foco */}
        {!modoFoco && resumosWithMaterial.length > 0 && (
          <View
            style={[
              styles.resumosBlock,
              {
                borderColor: colors.border,
                borderWidth: borderW,
                backgroundColor: colors.muted + "40",
                padding: 16 * spacingScale,
                marginBottom: 20 * spacingScale,
              },
            ]}
          >
            <ThemedText style={[styles.resumosTitle, { color: colors.mutedForeground }]}>
              Resumo do projeto
            </ThemedText>
            {resumosWithMaterial.map((block) => (
              <View key={block.materialId} style={styles.resumoRow}>
                <View style={styles.resumoRowHeader}>
                  <ThemedText style={[styles.resumoMaterial, { color: colors.mutedForeground }]}>
                    {block.nomeArquivo}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => {
                      setEditResumoMaterialId(block.materialId);
                      setEditResumoValue(block.resumo);
                    }}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.resumoText}>{block.resumo}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Tabs - ocultas no modo foco */}
        {!modoFoco && (
          <View
            style={[
              styles.tabStrip,
              {
                backgroundColor: colors.muted + "80",
                gap: 4 * spacingScale,
                padding: 4 * spacingScale,
                marginBottom: 20 * spacingScale,
              },
            ]}
          >
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, activeTab === t.key && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
              >
                <Feather
                  name={t.icon}
                  size={18}
                  color={activeTab === t.key ? colors.primaryForeground : colors.mutedForeground}
                />
                <ThemedText
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === t.key ? colors.primaryForeground : colors.mutedForeground,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tab content */}
        {activeTab === "revisar" && cardsDue.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: borderW,
                padding: 24 * spacingScale,
                gap: 16 * spacingScale,
              },
            ]}
          >
            <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum card para revisar hoje. Todos em dia!
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.mutedForeground, fontSize: 14 }]}>
              Cards que você já classificou (Fácil, Médio, Difícil) na tela de Revisão aparecerão
              aqui quando estiverem na data de revisar.
            </ThemedText>
            <Button variant="outline" onPress={() => router.back()}>
              Voltar ao projeto
            </Button>
          </View>
        )}
        {activeTab === "revisar" && cardsDue.length > 0 && (
          <>
            <FlashcardCarousel
              cards={cardsDue}
              cardIndex={revisarCardIndex}
              onCardIndexChange={setRevisarCardIndex}
              flipped={revisarFlipped}
              onFlippedChange={setRevisarFlipped}
              mode="project"
              footerText={`${cardsDue.length} card${cardsDue.length !== 1 ? "s" : ""} para revisar · Clique para ver a resposta`}
            />
            <View style={[styles.backBtnWrap, { marginTop: 24 * spacingScale }]}>
              <Button variant="outline" onPress={() => router.back()}>
                Voltar ao projeto
              </Button>
            </View>
          </>
        )}
        {activeTab === "quiz" && (
          <StudyQuizPanel
            cards={cards}
            emptyText="Nenhum card para quiz. Adicione PDFs ao projeto."
          />
        )}
        {activeTab === "chat" && (
          <StudyChat
            headerText="Pergunte sobre o conteúdo do projeto. A IA usa os resumos como contexto."
            buildContext={() =>
              resumosWithMaterial.map((b) => `${b.nomeArquivo}:\n${b.resumo}`).join("\n\n")
            }
          />
        )}
        {activeTab === "minhas_questoes" && (
          <ProjectFlashcardEditor
            items={cardsWithSourceForCarousel}
            materiais={materiais}
            saving={saving}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
          />
        )}
        {activeTab === "flashcards" && cardsForCarousel.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: borderW,
                padding: 24 * spacingScale,
                gap: 16 * spacingScale,
              },
            ]}
          >
            <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum card para estudar. Adicione PDFs ao projeto para gerar cards.
            </ThemedText>
            <Button variant="outline" onPress={() => router.back()}>
              Voltar ao projeto
            </Button>
          </View>
        )}
        {activeTab === "flashcards" && cardsForCarousel.length > 0 && (
          <>
            <FlashcardCarousel
              cards={cardsForCarousel}
              cardIndex={cardIndex}
              onCardIndexChange={setCardIndex}
              flipped={flipped}
              onFlippedChange={setFlipped}
              mode="project"
            />
            <View style={[styles.backBtnWrap, { marginTop: 24 * spacingScale }]}>
              <Button variant="outline" onPress={() => router.back()}>
                Voltar ao projeto
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal: Editar resumo */}
      <Modal visible={!!editResumoMaterialId} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !saving && setEditResumoMaterialId(null)}
        >
          <Pressable
            style={[styles.modalBox, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={styles.modalTitle}>Editar resumo</ThemedText>
            <TextInput
              value={editResumoValue}
              onChangeText={setEditResumoValue}
              placeholder="Resumo..."
              multiline
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => setEditResumoMaterialId(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onPress={handleSaveResumo} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  backText: { fontSize: 14 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  titleRow: { marginBottom: 8 },
  meta: { fontSize: 14 },
  timerRow: { marginBottom: 16 },
  timerAndFocoRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  focoBtn: { alignSelf: "flex-start" },
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  reminderText: { fontSize: 14, fontWeight: "500" },
  pomodoroBlock: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 16,
  },
  pomodoroTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  pomodoroTime: { fontVariant: ["tabular-nums"], fontSize: 24, fontWeight: "700" },
  notFoundText: { marginBottom: 16, textAlign: "center" },
  resumosBlock: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
  resumosTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 12 },
  resumoRow: { marginBottom: 12 },
  resumoRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resumoMaterial: { fontSize: 12 },
  resumoText: { fontSize: 14, lineHeight: 20 },
  tabStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 4,
    borderRadius: 10,
    marginBottom: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabLabel: { fontSize: 13, fontWeight: "500" },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 16 },
  emptyText: { textAlign: "center" },
  backBtnWrap: { marginTop: 24, alignItems: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { borderRadius: 12, padding: 20, maxHeight: "90%" },
  modalCardPausa: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    alignSelf: "center",
    minWidth: 280,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  modalHint: { fontSize: 14, marginBottom: 8 },
  textArea: {
    minHeight: 200,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
});
