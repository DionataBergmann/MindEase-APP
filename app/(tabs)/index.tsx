import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import Feather from "@expo/vector-icons/Feather";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import { isCardDueForReview } from "@/lib/spaced-repetition";
import type { Project, Material } from "@/types/project";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Progress } from "@/components/ui/progress";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

function formatLastAccess(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semana(s) atrás`;
  return `${Math.floor(diffDays / 30)} mês(es) atrás`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    if (!auth || !db) {
      setProjects([]);
      setLoading(false);
      return;
    }
    let unsubSnapshot: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }
      const q = query(
        collection(db, "projects"),
        where("userId", "==", user.uid),
        orderBy("updatedAt", "desc")
      );
      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          const list: Project[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            const materiais: Material[] = Array.isArray(data.materiais)
              ? data.materiais
              : data.resumo || (data.cards?.length ?? 0) > 0
                ? [
                    {
                      id: "legacy",
                      nomeArquivo: "PDF",
                      resumo: data.resumo ?? "",
                      cards: data.cards ?? [],
                    },
                  ]
                : [];
            return {
              id: docSnap.id,
              userId: data.userId,
              title: data.title ?? "Sem título",
              emoji: data.emoji ?? "📚",
              pdfCount: data.pdfCount ?? materiais.length,
              progress: data.progress ?? 0,
              lastAccess: formatLastAccess(data.updatedAt),
              tags: Array.isArray(data.tags) ? data.tags : undefined,
              resumo: data.resumo,
              cards: data.cards,
              materiais,
              createdAt: data.createdAt,
            };
          });
          setProjects(list);
          setLoading(false);
        },
        (err) => {
          console.error("Firestore snapshot error:", err);
          setLoading(false);
        }
      );
    });
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const handleSaveProject = async () => {
    if (!editProject || !editTitle.trim()) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "projects", editProject.id), {
        title: editTitle.trim(),
        tags: editTags,
        updatedAt: serverTimestamp(),
      });
      setEditProject(null);
      setEditTitle("");
      setEditTags([]);
      setNewTagInput("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const addEditTag = () => {
    const t = newTagInput.trim().toLowerCase();
    if (!t || editTags.includes(t)) return;
    setEditTags((prev) => [...prev, t].sort((a, b) => a.localeCompare(b)));
    setNewTagInput("");
  };

  const removeEditTag = (tag: string) => {
    setEditTags((prev) => prev.filter((x) => x !== tag));
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "projects", deleteProjectId));
      setDeleteProjectId(null);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.tags?.forEach((t) => set.add(t.trim())));
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (selectedTag && !p.tags?.includes(selectedTag)) return false;
      if (!q) return true;
      if (p.title.toLowerCase().includes(q)) return true;
      for (const m of p.materiais ?? []) {
        if ((m.nomeArquivo ?? "").toLowerCase().includes(q)) return true;
        const resumoText = (m.resumo ?? "").toLowerCase();
        if (resumoText.includes(q)) return true;
      }
      if ((p.resumo ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [projects, search, selectedTag]);

  const totalTopics = projects.reduce(
    (acc, p) =>
      acc +
      (p.materiais?.length ?? (p.pdfCount || (p.resumo || (p.cards?.length ?? 0) > 0 ? 1 : 0))),
    0
  );
  const completedTopicCount = projects.reduce((acc, p) => {
    if (p.materiais?.length)
      return acc + p.materiais.filter((m) => (m.status ?? "pending") === "completed").length;
    if (p.progress === 100 && (p.pdfCount || p.resumo || (p.cards?.length ?? 0) > 0))
      return acc + 1;
    return acc;
  }, 0);
  const topicProgress = totalTopics > 0 ? Math.round((completedTopicCount / totalTopics) * 100) : 0;

  const dueCards: {
    project: Project;
    material: Material;
    cardIndex: number;
  }[] = [];
  projects.forEach((p) => {
    p.materiais?.forEach((m) => {
      (m.cards ?? []).forEach((card, cardIndex) => {
        if (isCardDueForReview(card)) dueCards.push({ project: p, material: m, cardIndex });
      });
    });
  });

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome banner */}
        <View
          style={[
            styles.banner,
            { borderColor: colors.primary + "20", backgroundColor: colors.primary + "08" },
          ]}
        >
          <ThemedText type="default" style={styles.bannerTitle}>
            Olá, bom te ver de volta! 🌿
          </ThemedText>
          <ThemedText style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}>
            Continue de onde parou nos seus estudos.
          </ThemedText>
          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card + "CC", borderColor: colors.border },
              ]}
            >
              <ThemedText style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Projetos
              </ThemedText>
              <ThemedText style={styles.statValue}>{loading ? "—" : projects.length}</ThemedText>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card + "CC", borderColor: colors.border },
              ]}
            >
              <ThemedText style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Tópicos / PDFs
              </ThemedText>
              <ThemedText style={styles.statValue}>{loading ? "—" : totalTopics}</ThemedText>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card + "CC", borderColor: colors.border },
              ]}
            >
              <ThemedText style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Tópicos concluídos
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.success }]}>
                {loading ? "—" : completedTopicCount}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card + "CC", borderColor: colors.border },
              ]}
            >
              <ThemedText style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Progresso (tópicos)
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.primary }]}>
                {loading ? "—" : `${topicProgress}%`}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Search + buttons */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Feather
              name="search"
              size={18}
              color={colors.mutedForeground}
              style={styles.searchIcon}
            />
            <RNTextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Buscar em projetos, tópicos e resumos..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.toolbarButtons}>
            {!loading && dueCards.length > 0 && (
              <Button
                variant="outline"
                onPress={() => router.push("/review" as any)}
                style={styles.toolbarBtn}
              >
                <Feather
                  name="layers"
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <ThemedText style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                  Revisar cards ({dueCards.length})
                </ThemedText>
              </Button>
            )}
            <Button
              onPress={() => router.push("/new-project" as any)}
              style={[
                styles.toolbarBtn,
                !loading && dueCards.length > 0 ? {} : styles.toolbarBtnFull,
              ]}
            >
              <Feather
                name="plus"
                size={18}
                color={colors.primaryForeground}
                style={{ marginRight: 6 }}
              />
              <ThemedText
                style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 16 }}
              >
                Novo projeto
              </ThemedText>
            </Button>
          </View>
        </View>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <View style={styles.tagRow}>
            <ThemedText style={[styles.tagLabel, { color: colors.mutedForeground }]}>
              Tag:
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.tagChip,
                selectedTag === null
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.muted },
              ]}
              onPress={() => setSelectedTag(null)}
            >
              <ThemedText
                style={[
                  styles.tagChipText,
                  {
                    color: selectedTag === null ? colors.primaryForeground : colors.mutedForeground,
                  },
                ]}
              >
                Todos
              </ThemedText>
            </TouchableOpacity>
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip,
                  selectedTag === tag
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.muted },
                ]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <ThemedText
                  style={[
                    styles.tagChipText,
                    {
                      color:
                        selectedTag === tag ? colors.primaryForeground : colors.mutedForeground,
                    },
                  ]}
                >
                  {tag}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Project grid */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((project) => (
              <View
                key={project.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardMenuWrap}>
                  <TouchableOpacity
                    style={styles.cardMenuBtn}
                    onPress={() => setMenuOpenId((id) => (id === project.id ? null : project.id))}
                  >
                    <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {menuOpenId === project.id && (
                    <View
                      style={[
                        styles.cardMenuDropdown,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.cardMenuItem}
                        onPress={() => {
                          setEditProject(project);
                          setEditTitle(project.title);
                          setEditTags(project.tags ?? []);
                          setNewTagInput("");
                          setMenuOpenId(null);
                        }}
                      >
                        <Feather name="edit-2" size={14} color={colors.foreground} />
                        <ThemedText style={styles.cardMenuItemText}>Editar projeto</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardMenuItem}
                        onPress={() => {
                          setDeleteProjectId(project.id);
                          setMenuOpenId(null);
                        }}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                        <ThemedText
                          style={[styles.cardMenuItemText, { color: colors.destructive }]}
                        >
                          Excluir
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/project/${project.id}` as any)}
                  style={styles.cardContent}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardEmoji, { backgroundColor: colors.primary + "20" }]}>
                      <ThemedText style={styles.cardEmojiText}>{project.emoji}</ThemedText>
                    </View>
                    {project.progress === 100 && (
                      <View style={[styles.badgeDone, { backgroundColor: colors.success + "25" }]}>
                        <ThemedText style={[styles.badgeDoneText, { color: colors.success }]}>
                          ✓ Concluído
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.cardTitle} numberOfLines={2}>
                    {project.title}
                  </ThemedText>
                  {project.tags && project.tags.length > 0 && (
                    <View style={styles.cardTags}>
                      {project.tags.map((tag) => (
                        <View key={tag} style={[styles.cardTag, { backgroundColor: colors.muted }]}>
                          <ThemedText
                            style={[styles.cardTagText, { color: colors.mutedForeground }]}
                          >
                            {tag}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.cardMeta}>
                    <View style={styles.cardMetaItem}>
                      <Feather name="book-open" size={14} color={colors.mutedForeground} />
                      <ThemedText style={[styles.cardMetaText, { color: colors.mutedForeground }]}>
                        {project.pdfCount} PDFs
                      </ThemedText>
                    </View>
                    <View style={styles.cardMetaItem}>
                      <Feather name="clock" size={14} color={colors.mutedForeground} />
                      <ThemedText style={[styles.cardMetaText, { color: colors.mutedForeground }]}>
                        {project.lastAccess}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.cardProgressWrap}>
                    <View style={styles.cardProgressLabels}>
                      <ThemedText
                        style={[styles.cardProgressLabel, { color: colors.mutedForeground }]}
                      >
                        Progresso
                      </ThemedText>
                      <ThemedText style={styles.cardProgressValue}>{project.progress}%</ThemedText>
                    </View>
                    <Progress value={project.progress} style={styles.cardProgressBar} />
                  </View>
                </TouchableOpacity>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Button
                    variant="outline"
                    style={styles.cardStudyBtn}
                    onPress={() => router.push(`/project/${project.id}/estudar` as any)}
                  >
                    <Feather
                      name="bookmark"
                      size={16}
                      color={colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>
                      Estudar
                    </ThemedText>
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="book" size={40} color={colors.mutedForeground + "99"} />
            <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum projeto encontrado.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Modal: Editar projeto */}
      <Modal
        visible={!!editProject}
        transparent
        animationType="fade"
        onRequestClose={() =>
          !saving && (setEditProject(null), setEditTags([]), setNewTagInput(""))
        }
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !saving && (setEditProject(null), setEditTags([]), setNewTagInput(""))}
        >
          <Pressable
            style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={styles.modalTitle}>Editar projeto</ThemedText>
            <ThemedText style={[styles.modalLabel, { color: colors.mutedForeground }]}>
              Nome
            </ThemedText>
            <Input
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Nome do projeto"
              style={styles.modalInput}
            />
            <ThemedText style={[styles.modalLabel, { color: colors.mutedForeground }]}>
              Tags
            </ThemedText>
            <View style={styles.editTagsRow}>
              {editTags.map((tag) => (
                <View
                  key={tag}
                  style={[styles.editTagChip, { backgroundColor: colors.primary + "20" }]}
                >
                  <ThemedText style={[styles.editTagText, { color: colors.primary }]}>
                    {tag}
                  </ThemedText>
                  <TouchableOpacity onPress={() => removeEditTag(tag)} hitSlop={8}>
                    <Feather name="x" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.editTagForm}>
              <Input
                value={newTagInput}
                onChangeText={setNewTagInput}
                placeholder="Nova tag"
                style={styles.modalInputFlex}
                onSubmitEditing={addEditTag}
              />
              <Button variant="outline" onPress={addEditTag} style={styles.modalBtnSm}>
                <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>
                  Adicionar
                </ThemedText>
              </Button>
            </View>
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                disabled={saving}
                onPress={() => {
                  setEditProject(null);
                  setEditTags([]);
                  setNewTagInput("");
                }}
              >
                <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>
                  Cancelar
                </ThemedText>
              </Button>
              <Button disabled={saving || !editTitle.trim()} onPress={handleSaveProject}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                    Salvar
                  </ThemedText>
                )}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Excluir projeto */}
      <Modal
        visible={!!deleteProjectId}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setDeleteProjectId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => !saving && setDeleteProjectId(null)}>
          <Pressable
            style={[
              styles.modalBox,
              styles.modalBoxSm,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={styles.modalTitle}>Excluir projeto?</ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Esta ação não pode ser desfeita. Todos os materiais e cards serão removidos.
            </ThemedText>
            <View style={styles.modalActions}>
              <Button variant="outline" disabled={saving} onPress={() => setDeleteProjectId(null)}>
                <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>
                  Cancelar
                </ThemedText>
              </Button>
              <Button variant="destructive" disabled={saving} onPress={handleDeleteProject}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.destructiveForeground} />
                ) : (
                  <ThemedText style={{ color: colors.destructiveForeground, fontWeight: "600" }}>
                    Excluir
                  </ThemedText>
                )}
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
  scrollContent: { padding: 16, paddingBottom: 32 },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  bannerTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  bannerSubtitle: { fontSize: 16, marginBottom: 16 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    minWidth: "45%",
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  toolbar: { marginBottom: 12 },
  searchWrap: { position: "relative", marginBottom: 12 },
  searchIcon: { position: "absolute", left: 12, top: 14, zIndex: 1 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 40,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  toolbarButtons: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  toolbarBtn: { flex: 1, minWidth: 120 },
  toolbarBtnFull: { flex: 1 },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  tagLabel: { fontSize: 12, marginRight: 4 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  tagChipText: { fontSize: 12, fontWeight: "500" },
  loadingWrap: { paddingVertical: 48, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    position: "relative",
  },
  cardMenuWrap: { position: "absolute", top: 12, right: 12, zIndex: 10 },
  cardMenuBtn: { padding: 8 },
  cardMenuDropdown: {
    position: "absolute",
    right: 0,
    top: 36,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardMenuItemText: { fontSize: 14 },
  cardContent: { marginTop: 8 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmojiText: { fontSize: 22 },
  badgeDone: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeDoneText: { fontSize: 12, fontWeight: "500" },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  cardTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  cardTagText: { fontSize: 10, fontWeight: "500" },
  cardMeta: { flexDirection: "row", gap: 16, marginBottom: 12 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMetaText: { fontSize: 14 },
  cardProgressWrap: { marginBottom: 4 },
  cardProgressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  cardProgressLabel: { fontSize: 12 },
  cardProgressValue: { fontSize: 12, fontWeight: "600" },
  cardProgressBar: { height: 8 },
  cardFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  cardStudyBtn: { width: "100%" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 16, marginTop: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  modalBoxSm: { maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  modalInput: { marginBottom: 16 },
  modalInputFlex: { flex: 1, marginBottom: 0 },
  modalBody: { fontSize: 14, marginBottom: 20 },
  editTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  editTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  editTagText: { fontSize: 12, fontWeight: "500" },
  editTagForm: { flexDirection: "row", gap: 8, marginBottom: 20 },
  modalBtnSm: { paddingHorizontal: 16 },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
});
