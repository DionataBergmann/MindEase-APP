import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
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
import { getPreferences } from '@/lib/preferences';
import { getNextReviewDateFromLevel } from '@/lib/spaced-repetition';
import type { Project, Material, MaterialStatus } from '@/types/project';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useSpacingScale, useContrastLevel, usePreferencesContext } from '@/contexts/PreferencesContext';

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
  const spacingScale = useSpacingScale();
  const contrastLevel = useContrastLevel();
  const borderW = contrastLevel === 'alto' ? 2 : 1;
  const prefsContext = usePreferencesContext();

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
  const [transitionModal, setTransitionModal] = useState<{ href: string; message: string } | null>(null);
  const menuAnchorRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const [menuAnchorLayout, setMenuAnchorLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [overlayLayout, setOverlayLayout] = useState<{ x: number; y: number } | null>(null);

  const projectMenuAnchorRef = useRef<View>(null);
  const projectMenuOverlayRef = useRef<View>(null);
  const [projectMenuAnchorLayout, setProjectMenuAnchorLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [projectMenuOverlayLayout, setProjectMenuOverlayLayout] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!materialMenuId) {
      setMenuAnchorLayout(null);
      setOverlayLayout(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      menuAnchorRef.current?.measureInWindow((x, y, w, h) => {
        setMenuAnchorLayout({ x, y, w, h });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [materialMenuId]);

  useEffect(() => {
    if (!menuOpen) {
      setProjectMenuAnchorLayout(null);
      setProjectMenuOverlayLayout(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      projectMenuAnchorRef.current?.measureInWindow((x, y, w, h) => {
        setProjectMenuAnchorLayout({ x, y, w, h });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [menuOpen]);

  const measureOverlay = useCallback(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.measureInWindow((x, y) => {
        setOverlayLayout({ x, y });
      });
    });
  }, []);

  const measureProjectMenuOverlay = useCallback(() => {
    requestAnimationFrame(() => {
      projectMenuOverlayRef.current?.measureInWindow((x, y) => {
        setProjectMenuOverlayLayout({ x, y });
      });
    });
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      prefsContext?.refresh();
    }, [prefsContext])
  );

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

  const getStatus = (m: Material): MaterialStatus => (m.status ?? 'pending') as MaterialStatus;
  const paraEstudar = materials.filter((m) => getStatus(m) === 'pending');
  const emProgresso = materials.filter((m) => getStatus(m) === 'in_progress');
  const concluidos = materials.filter((m) => getStatus(m) === 'completed');
  const totalConcluidos = concluidos.length;

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
      const materiais = project.materiais ?? [];
      const updated: Material[] = materiais.map((m) => {
        if (m.id !== materialId) return m;
        const base = { ...m, status: newStatus };
        if (newStatus === 'completed' && !m.nextReviewAt) {
          return {
            ...base,
            nextReviewAt: getNextReviewDateFromLevel(0),
            intervalLevel: 0,
          };
        }
        if (newStatus !== 'completed') {
          const { nextReviewAt, lastReviewedAt, intervalLevel, ...rest } = base;
          return rest as Material;
        }
        return base;
      });
      const completedCount = updated.filter((m) => (m.status ?? 'pending') === 'completed').length;
      const progress = updated.length === 0 ? 0 : Math.round((completedCount / updated.length) * 100);
      const prevMateriais = project.materiais;
      const prevProgress = project.progress;
      setProject((p) => (p ? { ...p, materiais: updated, progress } : null));
      setMaterialMenuId(null);
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          materiais: updated,
          progress,
          updatedAt: serverTimestamp(),
        });
      } catch {
        setProject((p) => (p ? { ...p, materiais: prevMateriais, progress: prevProgress } : null));
      }
    },
    [project]
  );

  const handleStudyMaterial = useCallback(
    async (m: Material) => {
      const p = await getPreferences();
      if (p.avisoTransicao) {
        setTransitionModal({
          href: `/project/${id}/material/${m.id}`,
          message: `Você vai estudar "${m.nomeArquivo ?? 'tópico'}". Pronto para continuar?`,
        });
      } else {
        router.push(`/project/${id}/material/${m.id}` as any);
      }
    },
    [id, router]
  );

  const handleStudyAll = useCallback(async () => {
    const p = await getPreferences();
    if (p.avisoTransicao) {
      setTransitionModal({
        href: `/project/${id}/estudar`,
        message: 'Você vai estudar todos os tópicos. Pronto para continuar?',
      });
    } else {
      router.push(`/project/${id}/estudar` as any);
    }
  }, [id, router]);

  const renderMaterialCard = useCallback(
    (m: Material) => {
      const status = getStatus(m);
      const isMenuOpen = materialMenuId === m.id;
      return (
        <View
          key={m.id}
          style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: borderW }]}
        >
          <TouchableOpacity
            style={styles.materialContent}
            onPress={() => handleStudyMaterial(m)}
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
          <View ref={isMenuOpen ? menuAnchorRef : undefined} style={styles.materialMenuWrap}>
            <TouchableOpacity
              style={styles.materialMenuBtn}
              onPress={() => setMaterialMenuId(isMenuOpen ? null : m.id)}
            >
              <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [colors, materialMenuId, id, router, handleStudyMaterial, borderW]
  );

  const renderSection = useCallback(
    (title: string, list: Material[]) => (
      <View style={styles.categorySection} key={title}>
        <ThemedText style={[styles.categorySectionTitle, { color: colors.mutedForeground }]}>
          {title}
          {list.length > 0 ? ` (${list.length})` : ''}
        </ThemedText>
        <View style={styles.categorySectionList}>
          {list.length === 0 ? (
            <ThemedText style={[styles.categorySectionEmpty, { color: colors.mutedForeground }]}>
              Nenhum tópico
            </ThemedText>
          ) : (
            list.map((m) => renderMaterialCard(m))
          )}
        </View>
      </View>
    ),
    [colors, renderMaterialCard]
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

  const listHeader = (
    <>
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
        <View ref={menuOpen ? projectMenuAnchorRef : undefined} style={styles.headerActions}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuOpen((o) => !o)}
          >
            <Feather name="more-vertical" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
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
          onPress={handleStudyAll}
          style={styles.headerBtn}
        >
          <Feather name="bookmark" size={18} color={colors.primaryForeground} style={{ marginRight: 6 }} />
          <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Estudar todos</ThemedText>
        </Button>
      </View>

      <ThemedText style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Tópicos
      </ThemedText>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      {materials.length === 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: (insets.top + 16) * spacingScale,
              paddingBottom: (insets.bottom + 24) * spacingScale,
              paddingHorizontal: 16 * spacingScale,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {listHeader}
          <View style={[styles.emptyMaterials, { borderColor: colors.border, borderWidth: borderW }]}>
            <ThemedText style={[styles.emptyMaterialsText, { color: colors.mutedForeground }]}>
              Nenhum tópico ainda. Use &quot;Adicionar PDF&quot; para enviar o primeiro.
            </ThemedText>
            <Button onPress={() => router.push(`/project/${id}/add-pdf` as any)}>
              <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Adicionar PDF</ThemedText>
            </Button>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: (insets.top + 16) * spacingScale,
              paddingBottom: (insets.bottom + 24) * spacingScale,
              paddingHorizontal: 16 * spacingScale,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {listHeader}
          {renderSection('Para estudar', paraEstudar)}
          {renderSection('Em progresso', emProgresso)}
          {renderSection('Concluído', concluidos)}
        </ScrollView>
      )}

      {/* Overlay: menu do projeto (três pontinhos do cabeçalho) */}
      {menuOpen && projectMenuAnchorLayout && (
        <View ref={projectMenuOverlayRef} style={styles.modalOverlay} pointerEvents="box-none" onLayout={measureProjectMenuOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
            {projectMenuOverlayLayout && (() => {
              const dropdownWidth = 160;
              const left = Math.min(
                projectMenuAnchorLayout.x + projectMenuAnchorLayout.w - dropdownWidth - projectMenuOverlayLayout.x,
                Dimensions.get('window').width - dropdownWidth - projectMenuOverlayLayout.x - 16
              );
              const top = projectMenuAnchorLayout.y + projectMenuAnchorLayout.h - projectMenuOverlayLayout.y;
              return (
                <View
                  style={[
                    styles.menuDropdownOverlay,
                    { left, top, backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onStartShouldSetResponder={() => true}
                >
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
              );
            })()}
          </Pressable>
        </View>
      )}

      {/* Overlay: menu do tópico (dropdown fora do ScrollView para ficar por cima dos botões) */}
      {materialMenuId && menuAnchorLayout && (() => {
        const m = materials.find((mat) => mat.id === materialMenuId);
        if (!m) return null;
        const status = (m.status ?? 'pending') as MaterialStatus;
        const { width: screenWidth } = Dimensions.get('window');
        const dropdownWidth = 180;
        const left = overlayLayout
          ? Math.min(
              menuAnchorLayout.x + menuAnchorLayout.w - dropdownWidth - overlayLayout.x,
              screenWidth - dropdownWidth - overlayLayout.x - 16
            )
          : 0;
        const top = overlayLayout ? menuAnchorLayout.y + menuAnchorLayout.h - overlayLayout.y : 0;
        return (
          <View ref={overlayRef} style={styles.modalOverlay} pointerEvents="box-none" onLayout={measureOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setMaterialMenuId(null)}>
              {overlayLayout && (
              <Pressable
                style={[
                  styles.materialMenuDropdownOverlay,
                  { left, top, backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => {}}
              >
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
                        onPress={() => {
                          handleMoveMaterialStatus(m.id, s);
                          setMaterialMenuId(null);
                        }}
                      >
                        <ThemedText style={styles.menuItemText}>{STATUS_LABEL[s]}</ThemedText>
                      </TouchableOpacity>
                    ))}
                </View>
              </Pressable>
              )}
            </Pressable>
          </View>
        );
      })()}

      {/* Overlay: Editar nome do projeto */}
      {showEditProject && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
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
        </View>
      )}

      {showDeleteProject && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
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
        </View>
      )}

      {!!editMaterial && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
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
        </View>
      )}

      {!!deleteMaterialId && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
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
        </View>
      )}

      {transitionModal && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={styles.modalBackdrop} onPress={() => setTransitionModal(null)}>
            <Pressable style={[styles.modalBox, styles.modalBoxSm, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              <ThemedText style={styles.modalBody}>{transitionModal.message}</ThemedText>
              <View style={styles.modalActions}>
                <Button variant="outline" onPress={() => setTransitionModal(null)}>
                  <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Voltar</ThemedText>
                </Button>
                <Button onPress={() => { router.push(transitionModal.href as any); setTransitionModal(null); }}>
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Continuar</ThemedText>
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </View>
      )}
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
  menuDropdownOverlay: {
    position: 'absolute',
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10000,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  menuItemText: { fontSize: 14 },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  headerBtn: { flex: 1, minWidth: 140 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  categorySection: { marginBottom: 24 },
  categorySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categorySectionList: { gap: 10 },
  categorySectionEmpty: { fontSize: 12, paddingVertical: 12, paddingHorizontal: 4 },
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
  materialMenuDropdownOverlay: {
    position: 'absolute',
    minWidth: 180,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10000,
  },
  statusSection: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 4, marginTop: 4 },
  statusSectionLabel: { fontSize: 11, marginBottom: 4, paddingHorizontal: 12 },
  statusOption: { paddingVertical: 8, paddingHorizontal: 12 },
  emptyState: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { textAlign: 'center', marginBottom: 8 },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    elevation: 100000,
  },
  modalBoxSm: { maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalBody: { fontSize: 14, marginBottom: 20 },
  modalInput: { marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
