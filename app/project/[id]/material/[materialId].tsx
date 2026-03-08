import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { useWindowDimensions } from "react-native";
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
import {
  useSpacingScale,
  useContrastLevel,
  usePreferencesContext,
} from "@/contexts/PreferencesContext";
import {
  FlashcardCarousel,
  StudyQuizPanel,
  StudyChat,
  MaterialFlashcardEditor,
  StudyTimer,
} from "@/components/study";

type StudyTab = "flashcards" | "quiz" | "chat" | "minhas_questoes";

function estimateMin(m: Material): number {
  return Math.max(5, (m.cards?.length ?? 0) * 3);
}

export default function MaterialStudyScreen() {
  const router = useRouter();
  const { id: projectId, materialId } = useLocalSearchParams<{ id: string; materialId: string }>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const spacingScale = useSpacingScale();
  const contrastLevel = useContrastLevel();
  const borderW = contrastLevel === "alto" ? 2 : 1;
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
          : d.resumo || d.cards?.length > 0
            ? [
                {
                  id: "legacy",
                  nomeArquivo: "PDF",
                  resumo: d.resumo ?? "",
                  cards: d.cards ?? [],
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
      setActiveTab((tab === "revisar" ? "flashcards" : tab) as StudyTab);
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
  };

  const handleDeleteCard = async (index: number) => {
    if (!projectId || !materialId || !project?.materiais || !material) return;
    const db = getFirestoreDb();
    if (!db) return;
    const prev = material.cards ?? [];
    if (index < 0 || index >= prev.length) return;
    const newCards = prev.filter((_, i) => i !== index);
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
      if (cardIndex >= newCards.length && newCards.length > 0) setCardIndex(newCards.length - 1);
      else if (newCards.length === 0) setCardIndex(0);
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

  const tabs: { key: StudyTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "flashcards", label: "Flashcards", icon: "layers" },
    { key: "quiz", label: "Quiz", icon: "help-circle" },
    { key: "chat", label: "Chat IA", icon: "message-circle" },
    { key: "minhas_questoes", label: "Minhas flashcards", icon: "file-text" },
  ];

  const tabGap = 8 * spacingScale;
  const stripPadding = 8 * spacingScale;
  const scrollPadding = 16 * spacingScale;
  const tabItemWidth = (windowWidth - scrollPadding * 2 - stripPadding * 2 - tabGap) / 2;

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

        <ThemedText style={styles.title}>{material.nomeArquivo ?? "Tópico"}</ThemedText>
        {!modoFoco && (
          <ThemedText style={[styles.meta, { color: colors.mutedForeground }]}>
            ~{minEst} min · {cards.length} card{cards.length !== 1 ? "s" : ""}
            {prefs && ` · Duração sugerida: ${effectiveLabel}`}
          </ThemedText>
        )}
        {showSessionReminder && !pomodoroBreak.active && (
          <View
            style={[
              styles.reminderBanner,
              {
                backgroundColor: colors.primary + "20",
                borderColor: colors.primary + "50",
                borderWidth: borderW,
                marginBottom: 12 * spacingScale,
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
        {/* Modal: pausa Pomodoro */}
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
              { marginBottom: 12 * spacingScale, gap: 12 * spacingScale },
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

        {!modoFoco && activeTab === "flashcards" && cards.length > 0 && (
          <View style={styles.concluirRow}>
            <Button onPress={handleConcluir} disabled={saving} style={styles.concluirBtn}>
              <Feather name="check-circle" size={18} color={colors.primaryForeground} />
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                Concluir tópico
              </ThemedText>
            </Button>
          </View>
        )}

        {!modoFoco && dueForReview && (
          <View
            style={[
              styles.reviewBanner,
              {
                backgroundColor: colors.primary + "20",
                borderColor: colors.primary + "40",
                borderWidth: borderW,
                padding: 16 * spacingScale,
                marginBottom: 16 * spacingScale,
              },
            ]}
          >
            <ThemedText style={[styles.reviewBannerText, { color: colors.primary }]}>
              Marque como revisado para atualizar a próxima revisão.
            </ThemedText>
            <Button
              variant="outline"
              onPress={handleMarkAsReviewed}
              disabled={saving}
              style={styles.reviewBtn}
            >
              Marquei como revisado
            </Button>
          </View>
        )}

        {!modoFoco && resumoText ? (
          <View
            style={[
              styles.resumoBlock,
              {
                borderColor: colors.border,
                borderWidth: borderW,
                backgroundColor: colors.muted + "40",
                padding: 16 * spacingScale,
                marginBottom: 20 * spacingScale,
              },
            ]}
          >
            <View style={styles.resumoRowHeader}>
              <ThemedText style={[styles.resumosTitle, { color: colors.mutedForeground }]}>
                Resumo
              </ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setEditResumoValue(resumoText);
                  setEditResumoOpen(true);
                }}
                hitSlop={8}
              >
                <Feather name="edit-2" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.resumoText}>{resumoText}</ThemedText>
          </View>
        ) : !modoFoco ? (
          <TouchableOpacity
            style={[
              styles.addResumoBtn,
              {
                borderColor: colors.border,
                borderWidth: borderW,
                gap: 8 * spacingScale,
                padding: 16 * spacingScale,
                marginBottom: 20 * spacingScale,
              },
            ]}
            onPress={() => {
              setEditResumoValue("");
              setEditResumoOpen(true);
            }}
          >
            <Feather name="plus" size={18} color={colors.mutedForeground} />
            <ThemedText style={[styles.addResumoText, { color: colors.mutedForeground }]}>
              Adicionar resumo
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {!modoFoco && (
          <View
            style={[
              styles.tabStrip,
              {
                backgroundColor: colors.muted + "80",
                gap: 8 * spacingScale,
                padding: 8 * spacingScale,
                marginBottom: 20 * spacingScale,
              },
            ]}
          >
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tab,
                  { width: tabItemWidth, maxWidth: tabItemWidth },
                  activeTab === t.key && { backgroundColor: colors.primary },
                ]}
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

        {activeTab === "quiz" && (
          <StudyQuizPanel cards={cards} emptyText="Nenhum card para quiz neste tópico." />
        )}
        {activeTab === "chat" && (
          <StudyChat
            headerText="Pergunte sobre este tópico. A IA usa o resumo como contexto."
            buildContext={() => resumoText || "Sem resumo."}
          />
        )}
        {activeTab === "minhas_questoes" && (
          <MaterialFlashcardEditor
            cards={cards}
            saving={saving}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
          />
        )}
        {activeTab === "flashcards" && cards.length === 0 && (
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
              Nenhum card neste tópico. Crie flashcards em &quot;Minhas flashcards&quot;.
            </ThemedText>
            <Button variant="outline" onPress={() => router.back()}>
              Voltar ao projeto
            </Button>
          </View>
        )}
        {activeTab === "flashcards" && cards.length > 0 && (
          <>
            <FlashcardCarousel
              cards={cards}
              cardIndex={cardIndex}
              onCardIndexChange={setCardIndex}
              flipped={flipped}
              onFlippedChange={setFlipped}
              mode="material"
            />
            <View style={[styles.backBtnWrap, { marginTop: 24 * spacingScale }]}>
              <Button variant="outline" onPress={() => router.back()}>
                Voltar ao projeto
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={editResumoOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setEditResumoOpen(false)}>
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
              <Button variant="outline" onPress={() => setEditResumoOpen(false)} disabled={saving}>
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
  meta: { fontSize: 14, marginBottom: 8 },
  timerRow: { marginBottom: 12 },
  timerAndFocoRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  focoBtn: { alignSelf: "flex-start" },
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  reminderText: { fontSize: 14, fontWeight: "500" },
  pomodoroBlock: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 12,
  },
  pomodoroTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  pomodoroTime: { fontVariant: ["tabular-nums"], fontSize: 24, fontWeight: "700" },
  notFoundText: { marginBottom: 16, textAlign: "center" },
  concluirRow: { marginBottom: 12 },
  concluirBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewBanner: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  reviewBannerText: { fontSize: 14, marginBottom: 12 },
  reviewBtn: { alignSelf: "flex-start" },
  resumoBlock: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
  resumoRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resumosTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  resumoText: { fontSize: 14, lineHeight: 20 },
  addResumoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    marginBottom: 20,
  },
  addResumoText: { fontSize: 14 },
  tabStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    marginBottom: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
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
