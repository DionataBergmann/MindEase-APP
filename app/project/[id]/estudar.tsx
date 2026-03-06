import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase';
import type { Project, ProjectCard, Material } from '@/types/project';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import {
  FlashcardCarousel,
  StudyQuizPanel,
  StudyChat,
  ProjectFlashcardEditor,
  type ProjectCardWithSource,
} from '@/components/study';

type StudyTab = 'flashcards' | 'quiz' | 'chat' | 'minhas_questoes';

function getAllCards(project: Project): ProjectCard[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) => m.cards ?? []);
  }
  if (project.cards?.length) return project.cards;
  return [];
}

type ResumoBlock = { materialId: string; nomeArquivo: string; resumo: string };

function getDisplayResumo(m: Material): string {
  return m.resumoBreve ?? m.resumoMedio ?? m.resumoCompleto ?? m.resumo ?? '';
}

function getResumosWithMaterial(project: Project): ResumoBlock[] {
  if (project.materiais?.length) {
    return project.materiais
      .filter((m) => getDisplayResumo(m))
      .map((m) => ({
        materialId: m.id,
        nomeArquivo: m.nomeArquivo ?? 'PDF',
        resumo: getDisplayResumo(m),
      }));
  }
  if (project.resumo) {
    return [{ materialId: 'legacy', nomeArquivo: 'PDF', resumo: project.resumo }];
  }
  return [];
}

function getCardsWithSource(project: Project): ProjectCardWithSource[] {
  if (project.materiais?.length) {
    return project.materiais.flatMap((m) =>
      (m.cards ?? []).map((card, i) => ({
        materialId: m.id,
        materialName: m.nomeArquivo ?? 'PDF',
        card,
        indexInMaterial: i,
      }))
    );
  }
  if (project.cards?.length) {
    return project.cards.map((card, i) => ({
      materialId: 'legacy',
      materialName: 'PDF',
      card,
      indexInMaterial: i,
    }));
  }
  return [];
}

function getMateriais(project: Project): Material[] {
  if (project.materiais?.length) return project.materiais;
  if (project.resumo || (project.cards?.length ?? 0) > 0) {
    return [
      {
        id: 'legacy',
        nomeArquivo: 'PDF',
        resumo: project.resumo ?? '',
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
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<StudyTab>('flashcards');
  const [editResumoMaterialId, setEditResumoMaterialId] = useState<string | null>(null);
  const [editResumoValue, setEditResumoValue] = useState('');
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
        const snap = await getDoc(doc(db, 'projects', id));
        if (!snap.exists() || snap.data()?.userId !== user.uid) {
          setNotFound(true);
          setProject(null);
        } else {
          const d = snap.data()!;
          setProject({
            id: snap.id,
            userId: d.userId,
            title: d.title ?? 'Sem título',
            emoji: d.emoji ?? '📚',
            pdfCount: d.pdfCount ?? 0,
            progress: d.progress ?? 0,
            lastAccess: '',
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
      await updateDoc(doc(db, 'projects', id), {
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
    mode: 'edit' | 'new';
    materialId: string;
    indexInMaterial?: number;
    titulo: string;
    conteudo: string;
  }) => {
    if (!id || !project) return;
    const db = getFirestoreDb();
    if (!db) return;
    const materiais = getMateriais(project);
    let updated: Material[];
    if (opts.mode === 'edit' && typeof opts.indexInMaterial === 'number') {
      const mat = materiais.find((m) => m.id === opts.materialId);
      if (!mat) return;
      const newCards = (mat.cards ?? []).map((c, i) =>
        i === opts.indexInMaterial ? { ...c, titulo: opts.titulo, conteudo: opts.conteudo } : c
      );
      updated = materiais.map((m) =>
        m.id === opts.materialId ? { ...m, cards: newCards } : m
      );
    } else if (opts.mode === 'new') {
      const mat = materiais.find((m) => m.id === opts.materialId);
      if (!mat) return;
      const newCards = [...(mat.cards ?? []), { titulo: opts.titulo, conteudo: opts.conteudo }];
      updated = materiais.map((m) =>
        m.id === opts.materialId ? { ...m, cards: newCards } : m
      );
    } else return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
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
    const newCards = (mat.cards ?? []).filter((_, i) => i !== item.indexInMaterial);
    const updated = materiais.map((m) =>
      m.id === item.materialId ? { ...m, cards: newCards } : m
    );
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id), {
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
          <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>
            Voltar
          </ThemedText>
        </Button>
      </ThemedView>
    );
  }

  const cards = getAllCards(project);
  const resumosWithMaterial = getResumosWithMaterial(project);
  const cardsWithSource = getCardsWithSource(project);
  const materiais = getMateriais(project);
  const totalMin = Math.max(5, cards.length * 3);

  const tabs: { key: StudyTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'flashcards', label: 'Flashcards', icon: 'layers' },
    { key: 'quiz', label: 'Quiz', icon: 'help-circle' },
    { key: 'chat', label: 'Chat IA', icon: 'message-circle' },
    { key: 'minhas_questoes', label: 'Minhas flashcards', icon: 'file-text' },
  ];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
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
            Voltar ao projeto
          </ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.title}>
          Estudar: {project.title}
        </ThemedText>
        <ThemedText style={[styles.meta, { color: colors.mutedForeground }]}>
          ~{totalMin} min · {cards.length} card{cards.length !== 1 ? 's' : ''}
        </ThemedText>

        {/* Resumos */}
        {resumosWithMaterial.length > 0 && (
          <View style={[styles.resumosBlock, { borderColor: colors.border, backgroundColor: colors.muted + '40' }]}>
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

        {/* Tabs */}
        <View style={[styles.tabStrip, { backgroundColor: colors.muted + '80' }]}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
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
                  { color: activeTab === t.key ? colors.primaryForeground : colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {t.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'quiz' && (
          <StudyQuizPanel
            cards={cards}
            emptyText="Nenhum card para quiz. Adicione PDFs ao projeto."
          />
        )}
        {activeTab === 'chat' && (
          <StudyChat
            headerText="Pergunte sobre o conteúdo do projeto. A IA usa os resumos como contexto."
            buildContext={() =>
              resumosWithMaterial.map((b) => `${b.nomeArquivo}:\n${b.resumo}`).join('\n\n')
            }
          />
        )}
        {activeTab === 'minhas_questoes' && (
          <ProjectFlashcardEditor
            items={cardsWithSource}
            materiais={materiais}
            saving={saving}
            onSaveCard={handleSaveCard}
            onDeleteCard={handleDeleteCard}
          />
        )}
        {activeTab === 'flashcards' && cards.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum card para estudar. Adicione PDFs ao projeto para gerar cards.
            </ThemedText>
            <Button variant="outline" onPress={() => router.back()}>
              Voltar ao projeto
            </Button>
          </View>
        )}
        {activeTab === 'flashcards' && cards.length > 0 && (
          <>
            <FlashcardCarousel
              cards={cards}
              cardIndex={cardIndex}
              onCardIndexChange={setCardIndex}
              flipped={flipped}
              onFlippedChange={setFlipped}
              mode="project"
            />
            <View style={styles.backBtnWrap}>
              <Button variant="outline" onPress={() => router.back()}>
                Voltar ao projeto
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal: Editar resumo */}
      <Modal visible={!!editResumoMaterialId} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setEditResumoMaterialId(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Editar resumo</ThemedText>
            <TextInput
              value={editResumoValue}
              onChangeText={setEditResumoValue}
              placeholder="Resumo..."
              multiline
              style={[styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setEditResumoMaterialId(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onPress={handleSaveResumo} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backText: { fontSize: 14 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 14, marginBottom: 20 },
  notFoundText: { marginBottom: 16, textAlign: 'center' },
  resumosBlock: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 },
  resumosTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  resumoRow: { marginBottom: 12 },
  resumoRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  resumoMaterial: { fontSize: 12 },
  resumoText: { fontSize: 14, lineHeight: 20 },
  tabStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 10, marginBottom: 20 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  tabLabel: { fontSize: 13, fontWeight: '500' },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: 'center', gap: 16 },
  emptyText: { textAlign: 'center' },
  backBtnWrap: { marginTop: 24, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 12, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  textArea: { minHeight: 200, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
