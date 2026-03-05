import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase';
import { getNextReviewDateFromLevel } from '@/lib/spaced-repetition';
import type { Project, Material, MaterialStatus } from '@/types/project';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

function formatLastAccess(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semana(s) atrás`;
  return `${Math.floor(diffDays / 30)} mês(es) atrás`;
}

const STATUS_LABEL: Record<MaterialStatus, string> = {
  pending: 'Para estudar',
  in_progress: 'Em progresso',
  completed: 'Concluído',
};

function estimateMin(m: Material): number {
  return Math.max(5, (m.cards?.length ?? 0) * 3);
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [materialMenuId, setMaterialMenuId] = useState<string | null>(null);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [editMaterialName, setEditMaterialName] = useState('');
  const [deleteMaterialId, setDeleteMaterialId] = useState<string | null>(null);
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
      setNotFound(true);
      return () => {};
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProject(null);
        setLoading(false);
        setNotFound(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'projects', id));
        if (!snap.exists()) {
          setNotFound(true);
          setProject(null);
          return;
        }
        const data = snap.data();
        if (data.userId !== user.uid) {
          setNotFound(true);
          setProject(null);
          return;
        }
        setProject({
          id: snap.id,
          userId: data.userId,
          title: data.title ?? 'Sem título',
          emoji: data.emoji ?? '📚',
          pdfCount: data.pdfCount ?? 0,
          progress: data.progress ?? 0,
          lastAccess: formatLastAccess(data.updatedAt),
          tags: Array.isArray(data.tags) ? data.tags : undefined,
          materiais: data.materiais ?? undefined,
          resumo: data.resumo,
          cards: data.cards ?? [],
          createdAt: data.createdAt,
        });
        setNotFound(false);
      } catch {
        setNotFound(true);
        setProject(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const cleanup = loadProject();
    return cleanup;
  }, [loadProject]);

  const materials: Material[] =
    project?.materiais && project.materiais.length > 0
      ? project.materiais
      : project?.resumo || (project?.cards?.length ?? 0) > 0
        ? [
            {
              id: 'legacy',
              nomeArquivo: 'PDF',
              resumo: project?.resumo ?? '',
              cards: Array.isArray(project?.cards) ? project.cards : [],
            },
          ]
        : [];

  const totalConcluidos = materials.filter((m) => (m.status ?? 'pending') === 'completed').length;

  const handleSaveProjectTitle = useCallback(async () => {
    if (!project || !editTitle.trim()) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        title: editTitle.trim(),
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, title: editTitle.trim() } : null));
      setShowEditProject(false);
    } finally {
      setSaving(false);
    }
  }, [project, editTitle]);

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'projects', project.id));
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }, [project, router]);

  const handleSaveMaterialName = useCallback(async () => {
    if (!project || !editMaterial || !editMaterialName.trim()) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      const updated = (project.materiais ?? []).map((m) =>
        m.id === editMaterial.id ? { ...m, nomeArquivo: editMaterialName.trim() } : m
      );
      await updateDoc(doc(db, 'projects', project.id), {
        materiais: updated,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated } : null));
      setEditMaterial(null);
    } finally {
      setSaving(false);
    }
  }, [project, editMaterial, editMaterialName]);

  const handleDeleteMaterial = useCallback(async () => {
    if (!project || !deleteMaterialId) return;
    const db = getFirestoreDb();
    if (!db) return;
    setSaving(true);
    try {
      const updated = (project.materiais ?? []).filter((m) => m.id !== deleteMaterialId);
      const completedCount = updated.filter((m) => (m.status ?? 'pending') === 'completed').length;
      const progress = updated.length === 0 ? 0 : Math.round((completedCount / updated.length) * 100);
      await updateDoc(doc(db, 'projects', project.id), {
        materiais: updated,
        pdfCount: updated.length,
        progress,
        updatedAt: serverTimestamp(),
      });
      setProject((p) => (p ? { ...p, materiais: updated, pdfCount: updated.length, progress } : null));
      setDeleteMaterialId(null);
    } finally {
      setSaving(false);
    }
  }, [project, deleteMaterialId]);

  const handleMoveMaterialStatus = useCallback(
    async (materialId: string, newStatus: MaterialStatus) => {
      if (!project) return;
      const db = getFirestoreDb();
      if (!db) return;
      const updated = (project.materiais ?? []).map((m) => {
        if (m.id !== materialId) return m;
        const next = { ...m, status: newStatus };
        if (newStatus === 'completed' && !m.nextReviewAt) {
          next.nextReviewAt = getNextReviewDateFromLevel(0);
          next.intervalLevel = 0;
        }
        if (newStatus !== 'completed') {
          next.nextReviewAt = undefined;
          next.lastReviewedAt = undefined;
          next.intervalLevel = undefined;
        }
        return next;
      });
      const completedCount = updated.filter((m) => (m.status ?? 'pending') === 'completed').length;
      const progress = updated.length === 0 ? 0 : Math.round((completedCount / updated.length) * 100);
      setProject((p) => (p ? { ...p, materiais: updated, progress } : null));
      setMaterialMenuId(null);
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          materiais: updated,
          progress,
          updatedAt: serverTimestamp(),
        });
      } catch {
        setProject((p) => (p ? { ...p, materiais: project.materiais, progress: project.progress } : null));
      }
    },
    [project]
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  if (notFound || !project) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.emptyState, { paddingTop: insets.top + 24 }]}>
          <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Projeto não encontrado ou você não tem acesso.
          </ThemedText>
          <Button onPress={() => router.replace('/(tabs)')}>
            <Feather name="arrow-left" size={18} color={colors.primaryForeground} style={{ marginRight: 8 }} />
            <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Voltar para a Home</ThemedText>
          </Button>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
          <ThemedText style={[styles.backText, { color: colors.mutedForeground }]}>
            Voltar para a Biblioteca
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerMain}>
            <View style={[styles.emojiWrap, { backgroundColor: colors.primary + '20' }]}>
              <ThemedText style={styles.emoji}>{project.emoji}</ThemedText>
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {project.title}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {materials.length} tópico{materials.length !== 1 ? 's' : ''} · {totalConcluidos} concluído{totalConcluidos !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setMenuOpen((o) => !o)}
            >
              <Feather name="more-vertical" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={[styles.menuDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setEditTitle(project.title);
                    setShowEditProject(true);
                    setMenuOpen(false);
                  }}
                >
                  <Feather name="edit-2" size={16} color={colors.foreground} />
                  <ThemedText style={styles.menuItemText}>Editar nome</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowDeleteProject(true);
                    setMenuOpen(false);
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <ThemedText style={[styles.menuItemText, { color: colors.destructive }]}>Excluir projeto</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonsRow}>
          <Button
            variant="outline"
            onPress={() => router.push(`/project/${id}/add-pdf` as any)}
            style={styles.headerBtn}
          >
            <Feather name="plus" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Adicionar PDF</ThemedText>
          </Button>
          <Button
            onPress={() => router.push(`/project/${id}/estudar` as any)}
            style={styles.headerBtn}
          >
            <Feather name="bookmark" size={18} color={colors.primaryForeground} style={{ marginRight: 6 }} />
            <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Estudar todos</ThemedText>
          </Button>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Tópicos
        </ThemedText>

        {materials.length === 0 ? (
          <View style={[styles.emptyMaterials, { borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyMaterialsText, { color: colors.mutedForeground }]}>
              Nenhum tópico ainda. Use &quot;Adicionar PDF&quot; para enviar o primeiro.
            </ThemedText>
            <Button onPress={() => router.push(`/project/${id}/add-pdf` as any)}>
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Adicionar PDF</ThemedText>
            </Button>
          </View>
        ) : (
          <View style={styles.materialList}>
            {materials.map((m) => {
              const status = (m.status ?? 'pending') as MaterialStatus;
              const isMenuOpen = materialMenuId === m.id;
              return (
                <View
                  key={m.id}
                  style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.materialContent}
                    onPress={() => router.push(`/project/${id}/material/${m.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.materialHeader}>
                      <ThemedText style={styles.materialTitle} numberOfLines={1}>
                        {m.nomeArquivo ?? 'Tópico'}
                      </ThemedText>
                      <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
                        <ThemedText style={[styles.statusText, { color: colors.mutedForeground }]}>
                          {STATUS_LABEL[status]}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.materialMeta, { color: colors.mutedForeground }]}>
                      ~{estimateMin(m)} min · {m.cards?.length ?? 0} cards
                    </ThemedText>
                  </TouchableOpacity>
                  <View style={styles.materialMenuWrap}>
                    <TouchableOpacity
                      style={styles.materialMenuBtn}
                      onPress={() => setMaterialMenuId(isMenuOpen ? null : m.id)}
                    >
                      <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {isMenuOpen && (
                      <View style={[styles.materialMenuDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setEditMaterial(m);
                            setEditMaterialName(m.nomeArquivo ?? '');
                            setMaterialMenuId(null);
                          }}
                        >
                          <Feather name="edit-2" size={16} color={colors.foreground} />
                          <ThemedText style={styles.menuItemText}>Editar nome</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setDeleteMaterialId(m.id);
                            setMaterialMenuId(null);
                          }}
                        >
                          <Feather name="trash-2" size={16} color={colors.destructive} />
                          <ThemedText style={[styles.menuItemText, { color: colors.destructive }]}>Excluir</ThemedText>
                        </TouchableOpacity>
                        <View style={styles.statusSection}>
                          <ThemedText style={[styles.statusSectionLabel, { color: colors.mutedForeground }]}>Mover para</ThemedText>
                          {(['pending', 'in_progress', 'completed'] as const)
                            .filter((s) => s !== status)
                            .map((s) => (
                              <TouchableOpacity
                                key={s}
                                style={styles.statusOption}
                                onPress={() => handleMoveMaterialStatus(m.id, s)}
                              >
                                <ThemedText style={styles.menuItemText}>{STATUS_LABEL[s]}</ThemedText>
                              </TouchableOpacity>
                            ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal: Editar nome do projeto */}
      <Modal visible={showEditProject} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !saving && setShowEditProject(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Editar projeto</ThemedText>
            <Input
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Nome do projeto"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" disabled={saving} onPress={() => setShowEditProject(false)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Cancelar</ThemedText>
              </Button>
              <Button disabled={saving || !editTitle.trim()} onPress={handleSaveProjectTitle}>
                {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Salvar</ThemedText>}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Excluir projeto */}
      <Modal visible={showDeleteProject} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !saving && setShowDeleteProject(false)}>
          <Pressable style={[styles.modalBox, styles.modalBoxSm, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Excluir projeto?</ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Esta ação não pode ser desfeita. Todos os materiais e cards serão removidos.
            </ThemedText>
            <View style={styles.modalActions}>
              <Button variant="outline" disabled={saving} onPress={() => setShowDeleteProject(false)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Cancelar</ThemedText>
              </Button>
              <Button variant="destructive" disabled={saving} onPress={handleDeleteProject}>
                {saving ? <ActivityIndicator size="small" color={colors.destructiveForeground} /> : <ThemedText style={{ color: colors.destructiveForeground, fontWeight: '600' }}>Excluir</ThemedText>}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Editar nome do tópico */}
      <Modal visible={!!editMaterial} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !saving && setEditMaterial(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Editar nome do tópico</ThemedText>
            <Input
              value={editMaterialName}
              onChangeText={setEditMaterialName}
              placeholder="Nome do PDF / tópico"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" disabled={saving} onPress={() => setEditMaterial(null)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Cancelar</ThemedText>
              </Button>
              <Button disabled={saving || !editMaterialName.trim()} onPress={handleSaveMaterialName}>
                {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Salvar</ThemedText>}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Excluir tópico */}
      <Modal visible={!!deleteMaterialId} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !saving && setDeleteMaterialId(null)}>
          <Pressable style={[styles.modalBox, styles.modalBoxSm, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Excluir este tópico?</ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.mutedForeground }]}>
              O PDF e os cards deste tópico serão removidos do projeto.
            </ThemedText>
            <View style={styles.modalActions}>
              <Button variant="outline" disabled={saving} onPress={() => setDeleteMaterialId(null)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Cancelar</ThemedText>
              </Button>
              <Button variant="destructive" disabled={saving} onPress={handleDeleteMaterial}>
                {saving ? <ActivityIndicator size="small" color={colors.destructiveForeground} /> : <ThemedText style={{ color: colors.destructiveForeground, fontWeight: '600' }}>Excluir</ThemedText>}
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  backText: { fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  emojiWrap: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  headerActions: { position: 'relative' },
  menuBtn: { padding: 8 },
  menuDropdown: {
    position: 'absolute',
    right: 0,
    top: 40,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  menuItemText: { fontSize: 14 },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  headerBtn: { flex: 1, minWidth: 140 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  emptyMaterials: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyMaterialsText: { marginBottom: 16, textAlign: 'center' },
  materialList: { gap: 12 },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  materialContent: { flex: 1, padding: 16, minWidth: 0 },
  materialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  materialTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 11, fontWeight: '500' },
  materialMeta: { fontSize: 12 },
  materialMenuWrap: { position: 'relative' },
  materialMenuBtn: { padding: 16 },
  materialMenuDropdown: {
    position: 'absolute',
    right: 0,
    top: 48,
    minWidth: 180,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusSection: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 4, marginTop: 4 },
  statusSectionLabel: { fontSize: 11, marginBottom: 4, paddingHorizontal: 12 },
  statusOption: { paddingVertical: 8, paddingHorizontal: 12 },
  emptyState: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { textAlign: 'center', marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBox: { width: '100%', maxWidth: 400, borderRadius: 12, borderWidth: 1, padding: 24 },
  modalBoxSm: { maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalBody: { fontSize: 14, marginBottom: 20 },
  modalInput: { marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
