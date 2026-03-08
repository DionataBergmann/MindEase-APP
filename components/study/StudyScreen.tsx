/**
 * Shared study screen UI used by:
 * - Project study (Estudar: all topics) — app/project/[id]/estudar.tsx
 * - Material study (single topic) — app/project/[id]/material/[materialId].tsx
 *
 * Same layout: back, title, meta, timer+modo foco, resumos, tabs (Flashcards, Quiz, Chat, Minhas flashcards),
 * tab content, modals (timer complete, pomodoro break, edit resumo).
 */

import React from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { ProjectCard, Material } from "@/types/project";
import type { UserPreferences } from "@/lib/preferences";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/atoms/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { useSpacingScale, useContrastLevel } from "@/contexts/PreferencesContext";
import {
  FlashcardCarousel,
  StudyQuizPanel,
  StudyChat,
  ProjectFlashcardEditor,
  MaterialFlashcardEditor,
  StudyTimer,
  type ProjectCardWithSource,
} from "@/components/study";

export type StudyTab = "flashcards" | "quiz" | "chat" | "minhas_questoes";

export type ResumoBlock = { materialId: string; nomeArquivo: string; resumo: string };

export type ProjectStudyScope = {
  type: "project";
  title: string;
  meta: string;
  backLabel: string;
  cardsForCarousel: ProjectCard[];
  cardsForQuiz: ProjectCard[];
  cardsWithSourceForCarousel: ProjectCardWithSource[];
  materiais: Material[];
  resumosWithMaterial: ResumoBlock[];
  emptyFlashcardsMessage: string;
  quizEmptyText: string;
  chatHeaderText: string;
  buildChatContext: () => string;
  editResumoMaterialId: string | null;
  editResumoValue: string;
  saving: boolean;
  onBack: () => void;
  onSaveResumo: () => void;
  setEditResumoMaterialId: (id: string | null) => void;
  setEditResumoValue: (v: string) => void;
  onSaveCard: (opts: {
    mode: "edit" | "new";
    materialId: string;
    indexInMaterial?: number;
    titulo: string;
    conteudo: string;
  }) => Promise<void> | void;
  onDeleteCard: (item: ProjectCardWithSource) => Promise<void> | void;
};

export type MaterialStudyScope = {
  type: "material";
  title: string;
  meta: string;
  backLabel: string;
  cardsForCarousel: ProjectCard[];
  cardsForQuiz: ProjectCard[];
  resumoText: string | null;
  dueForReview: boolean;
  showConcluirTópico: boolean;
  emptyFlashcardsMessage: string;
  quizEmptyText: string;
  chatHeaderText: string;
  buildChatContext: () => string;
  editResumoOpen: boolean;
  editResumoValue: string;
  saving: boolean;
  onBack: () => void;
  onConcluir: () => void;
  onMarkAsReviewed: () => void;
  onSaveResumo: () => void;
  setEditResumoOpen: (open: boolean) => void;
  setEditResumoValue: (v: string) => void;
  onSaveCard: (opts: {
    mode: "edit" | "new";
    index?: number;
    titulo: string;
    conteudo: string;
  }) => Promise<void> | void;
  onDeleteCard: (index: number) => Promise<void> | void;
};

export type StudyScreenScope = ProjectStudyScope | MaterialStudyScope;

export type StudyScreenProps = {
  scope: StudyScreenScope;
  insets: { top: number; bottom: number };
  prefs: UserPreferences | null;
  activeTab: StudyTab;
  setActiveTab: (t: StudyTab) => void;
  cardIndex: number;
  setCardIndex: (n: number) => void;
  flipped: boolean;
  setFlipped: (f: boolean) => void;
  modoFoco: boolean;
  setModoFoco: (v: boolean) => void;
  showSessionReminder: boolean;
  pomodoroBreak: { active: boolean; secondsLeft: number };
  setPomodoroBreak: (v: { active: boolean; secondsLeft: number }) => void;
  showTimerCompleteModal: boolean;
  setShowTimerCompleteModal: (v: boolean) => void;
  sessionMinutes: number;
  onSessionMinutesChange: (minutes: number) => void;
  pomodoroBreakMinutes: number;
  setShowSessionReminder: (v: boolean) => void;
};

const TABS: { key: StudyTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "flashcards", label: "Flashcards", icon: "layers" },
  { key: "quiz", label: "Quiz", icon: "help-circle" },
  { key: "chat", label: "Chat IA", icon: "message-circle" },
  { key: "minhas_questoes", label: "Minhas flashcards", icon: "file-text" },
];

export function StudyScreen({
  scope,
  insets,
  prefs,
  activeTab,
  setActiveTab,
  cardIndex,
  setCardIndex,
  flipped,
  setFlipped,
  modoFoco,
  setModoFoco,
  showSessionReminder,
  pomodoroBreak,
  setPomodoroBreak,
  showTimerCompleteModal,
  setShowTimerCompleteModal,
  sessionMinutes,
  onSessionMinutesChange,
  pomodoroBreakMinutes,
  setShowSessionReminder,
}: StudyScreenProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const spacingScale = useSpacingScale();
  const contrastLevel = useContrastLevel();
  const borderW = contrastLevel === "alto" ? 2 : 1;
  const isProject = scope.type === "project";
  const { width: windowWidth } = useWindowDimensions();
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
            onPress={scope.onBack}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
            <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>
              {scope.backLabel}
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedText style={styles.title}>{scope.title}</ThemedText>
        {!modoFoco && (
          <View style={styles.titleRow}>
            <ThemedText style={[styles.meta, { color: colors.mutedForeground }]}>
              {scope.meta}
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
            <View style={styles.timerFocoCell}>
              <StudyTimer
                initialMinutes={sessionMinutes}
                editable
                onMinutesChange={onSessionMinutesChange}
                onComplete={() => setShowTimerCompleteModal(true)}
              />
            </View>
            <View style={styles.timerFocoCell}>
              <Button
                variant="outline"
                onPress={async () => {
                  const next = !modoFoco;
                  setModoFoco(next);
                  const { setPreferences } = await import("@/lib/preferences");
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
          </View>
        )}

        {!modoFoco && !isProject && scope.dueForReview && (
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
              onPress={scope.onMarkAsReviewed}
              disabled={scope.saving}
              style={styles.reviewBtn}
            >
              Marquei como revisado
            </Button>
          </View>
        )}

        {!modoFoco && isProject && scope.resumosWithMaterial.length > 0 && (
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
            {scope.resumosWithMaterial.map((block) => (
              <View key={block.materialId} style={styles.resumoRow}>
                <View style={styles.resumoRowHeader}>
                  <ThemedText style={[styles.resumoMaterial, { color: colors.mutedForeground }]}>
                    {block.nomeArquivo}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => {
                      scope.setEditResumoMaterialId(block.materialId);
                      scope.setEditResumoValue(block.resumo);
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

        {!modoFoco && !isProject && (
          <>
            {scope.resumoText ? (
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
                      scope.setEditResumoValue(scope.resumoText ?? "");
                      scope.setEditResumoOpen(true);
                    }}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.resumoText}>{scope.resumoText}</ThemedText>
              </View>
            ) : (
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
                  scope.setEditResumoValue("");
                  scope.setEditResumoOpen(true);
                }}
              >
                <Feather name="plus" size={18} color={colors.mutedForeground} />
                <ThemedText style={[styles.addResumoText, { color: colors.mutedForeground }]}>
                  Adicionar resumo
                </ThemedText>
              </TouchableOpacity>
            )}
          </>
        )}

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
            {TABS.map((t) => (
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
          <StudyQuizPanel cards={scope.cardsForQuiz} emptyText={scope.quizEmptyText} />
        )}
        {activeTab === "chat" && (
          <StudyChat
            headerText={scope.chatHeaderText}
            buildContext={scope.buildChatContext}
          />
        )}
        {activeTab === "minhas_questoes" && isProject && (
          <ProjectFlashcardEditor
            items={scope.cardsWithSourceForCarousel}
            materiais={scope.materiais}
            saving={scope.saving}
            onSaveCard={scope.onSaveCard}
            onDeleteCard={scope.onDeleteCard}
          />
        )}
        {activeTab === "minhas_questoes" && !isProject && (
          <MaterialFlashcardEditor
            cards={scope.cardsForCarousel}
            saving={scope.saving}
            onSaveCard={scope.onSaveCard}
            onDeleteCard={scope.onDeleteCard}
          />
        )}
        {activeTab === "flashcards" && scope.cardsForCarousel.length === 0 && (
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
              {scope.emptyFlashcardsMessage}
            </ThemedText>
            <Button variant="outline" onPress={scope.onBack}>
              {scope.backLabel}
            </Button>
          </View>
        )}
        {activeTab === "flashcards" && scope.cardsForCarousel.length > 0 && (
          <>
            <FlashcardCarousel
              cards={scope.cardsForCarousel}
              cardIndex={cardIndex}
              onCardIndexChange={setCardIndex}
              flipped={flipped}
              onFlippedChange={setFlipped}
              mode="project"
            />
            <View style={[styles.footerRow, { marginTop: 24 * spacingScale }]}>
              <Button variant="outline" onPress={scope.onBack}>
                {scope.backLabel}
              </Button>
              {!isProject && scope.showConcluirTópico && (
                <Button
                  onPress={scope.onConcluir}
                  disabled={scope.saving}
                  style={styles.concluirBtn}
                >
                  <Feather name="check-circle" size={18} color={colors.primaryForeground} />
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                    Concluir tópico
                  </ThemedText>
                </Button>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {isProject && (
        <Modal visible={!!scope.editResumoMaterialId} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => !scope.saving && scope.setEditResumoMaterialId(null)}
          >
            <Pressable
              style={[styles.modalBox, { backgroundColor: colors.card }]}
              onPress={(e) => e.stopPropagation()}
            >
              <ThemedText style={styles.modalTitle}>Editar resumo</ThemedText>
              <TextInput
                value={scope.editResumoValue}
                onChangeText={scope.setEditResumoValue}
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
                  onPress={() => scope.setEditResumoMaterialId(null)}
                  disabled={scope.saving}
                >
                  Cancelar
                </Button>
                <Button onPress={scope.onSaveResumo} disabled={scope.saving}>
                  {scope.saving ? "Salvando..." : "Salvar"}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {!isProject && (
        <Modal visible={scope.editResumoOpen} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => !scope.saving && scope.setEditResumoOpen(false)}
          >
            <Pressable
              style={[styles.modalBox, { backgroundColor: colors.card }]}
              onPress={(e) => e.stopPropagation()}
            >
              <ThemedText style={styles.modalTitle}>Editar resumo</ThemedText>
              <TextInput
                value={scope.editResumoValue}
                onChangeText={scope.setEditResumoValue}
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
                  onPress={() => scope.setEditResumoOpen(false)}
                  disabled={scope.saving}
                >
                  Cancelar
                </Button>
                <Button onPress={scope.onSaveResumo} disabled={scope.saving}>
                  {scope.saving ? "Salvando..." : "Salvar"}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  backText: { fontSize: 14 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  titleRow: { marginBottom: 8 },
  meta: { fontSize: 14 },
  timerRow: { marginBottom: 16 },
  timerAndFocoRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  timerFocoCell: { flex: 1, minWidth: 140, maxWidth: 280 },
  focoBtn: { alignSelf: "stretch", minWidth: 140 },
  concluirRow: { marginBottom: 16 },
  concluirBtn: { alignSelf: "flex-start" },
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
  reviewBanner: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  reviewBannerText: { fontSize: 14, marginBottom: 12 },
  reviewBtn: { alignSelf: "flex-start" },
  modalCardPausa: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    alignSelf: "center",
    minWidth: 280,
  },
  pomodoroTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  pomodoroTime: { fontVariant: ["tabular-nums"], fontSize: 24, fontWeight: "700" },
  modalHint: { fontSize: 14, marginBottom: 8 },
  resumosBlock: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
  resumoBlock: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
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
  addResumoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  addResumoText: { fontSize: 14 },
  tabStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  backBtnWrap: { marginTop: 24, alignItems: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { borderRadius: 12, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
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
