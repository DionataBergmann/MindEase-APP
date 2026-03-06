import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { Material, ProjectCard } from '@/types/project';

export type ProjectCardWithSource = {
  materialId: string;
  materialName: string;
  card: ProjectCard;
  indexInMaterial: number;
};

export type ProjectFlashcardEditorProps = {
  items: ProjectCardWithSource[];
  materiais: Material[];
  saving: boolean;
  onSaveCard: (opts: {
    mode: 'edit' | 'new';
    materialId: string;
    indexInMaterial?: number;
    titulo: string;
    conteudo: string;
  }) => Promise<void> | void;
  onDeleteCard: (item: ProjectCardWithSource) => Promise<void> | void;
};

export function ProjectFlashcardEditor({
  items,
  materiais,
  saving,
  onSaveCard,
  onDeleteCard,
}: ProjectFlashcardEditorProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [editItem, setEditItem] = useState<ProjectCardWithSource | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editConteudo, setEditConteudo] = useState('');
  const [newMaterialId, setNewMaterialId] = useState<string | null>(null);
  const [newTitulo, setNewTitulo] = useState('');
  const [newConteudo, setNewConteudo] = useState('');
  const [deleteItem, setDeleteItem] = useState<ProjectCardWithSource | null>(null);

  const hasMateriais = materiais.length > 0;

  const openEdit = (item: ProjectCardWithSource) => {
    setEditItem(item);
    setEditTitulo(item.card.titulo);
    setEditConteudo(item.card.conteudo);
    setNewMaterialId(null);
  };

  const openNew = () => {
    setNewMaterialId(materiais[0]?.id ?? null);
    setNewTitulo('');
    setNewConteudo('');
    setEditItem(null);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.sectionTitle}>Editar e criar flashcards</ThemedText>
        {hasMateriais && (
          <Button variant="outline" onPress={openNew} style={styles.newBtn}>
            <Feather name="plus" size={18} color={colors.primary} />
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Nova flashcard</ThemedText>
          </Button>
        )}
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <View
            key={`${item.materialId}-${item.indexInMaterial}`}
            style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.itemContent}>
              <ThemedText style={[styles.itemMaterial, { color: colors.mutedForeground }]}>
                {item.materialName}
              </ThemedText>
              <ThemedText style={styles.itemTitulo} numberOfLines={1}>
                {item.card.titulo}
              </ThemedText>
              <ThemedText style={[styles.itemConteudo, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.card.conteudo}
              </ThemedText>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="edit-2" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDeleteItem(item)}
                disabled={saving}
                style={[styles.iconBtn, { backgroundColor: colors.destructive + '20' }]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {items.length === 0 && (
        <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Nenhuma flashcard no projeto. Adicione PDFs ou crie em cada tópico.
        </ThemedText>
      )}

      {/* Modal: Editar flashcard */}
      <Modal visible={!!editItem} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setEditItem(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Editar flashcard</ThemedText>
            <ThemedText style={styles.modalLabel}>Pergunta (frente)</ThemedText>
            <Input
              value={editTitulo}
              onChangeText={setEditTitulo}
              placeholder="Título / pergunta"
              style={styles.modalInput}
            />
            <ThemedText style={styles.modalLabel}>Resposta (verso)</ThemedText>
            <TextInput
              value={editConteudo}
              onChangeText={setEditConteudo}
              placeholder="Resposta..."
              multiline
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setEditItem(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onPress={async () => {
                  if (!editItem) return;
                  await onSaveCard({
                    mode: 'edit',
                    materialId: editItem.materialId,
                    indexInMaterial: editItem.indexInMaterial,
                    titulo: editTitulo,
                    conteudo: editConteudo,
                  });
                  setEditItem(null);
                }}
                disabled={saving || !editTitulo.trim() || !editConteudo.trim()}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Nova flashcard (escolher tópico) */}
      <Modal visible={!!newMaterialId} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setNewMaterialId(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Nova flashcard</ThemedText>
            <ThemedText style={styles.modalLabel}>Tópico</ThemedText>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {materiais.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setNewMaterialId(m.id)}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: newMaterialId === m.id ? colors.primary + '20' : colors.muted },
                  ]}
                >
                  <ThemedText style={newMaterialId === m.id ? { color: colors.primary, fontWeight: '600' } : {}}>
                    {m.nomeArquivo ?? m.id}
                  </ThemedText>
                  {newMaterialId === m.id && <Feather name="check" size={18} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <ThemedText style={styles.modalLabel}>Pergunta (frente)</ThemedText>
            <Input value={newTitulo} onChangeText={setNewTitulo} placeholder="Título / pergunta" style={styles.modalInput} />
            <ThemedText style={styles.modalLabel}>Resposta (verso)</ThemedText>
            <TextInput
              value={newConteudo}
              onChangeText={setNewConteudo}
              placeholder="Resposta..."
              multiline
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setNewMaterialId(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onPress={async () => {
                  if (!newMaterialId) return;
                  await onSaveCard({
                    mode: 'new',
                    materialId: newMaterialId,
                    titulo: newTitulo,
                    conteudo: newConteudo,
                  });
                  setNewMaterialId(null);
                  setNewTitulo('');
                  setNewConteudo('');
                }}
                disabled={saving || !newTitulo.trim() || !newConteudo.trim() || !newMaterialId}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Confirmar exclusão */}
      <Modal visible={!!deleteItem} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setDeleteItem(null)}>
          <Pressable style={[styles.modalBox, styles.deleteModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Excluir esta flashcard?</ThemedText>
            <ThemedText style={[styles.deleteDesc, { color: colors.mutedForeground }]}>
              A pergunta e a resposta serão removidas. Esta ação não pode ser desfeita.
            </ThemedText>
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setDeleteItem(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onPress={async () => {
                  if (!deleteItem) return;
                  await onDeleteCard(deleteItem);
                  setDeleteItem(null);
                }}
                disabled={saving}
              >
                {saving ? 'Excluindo...' : 'Excluir'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export type MaterialFlashcardEditorProps = {
  cards: ProjectCard[];
  saving: boolean;
  onSaveCard: (opts: {
    mode: 'edit' | 'new';
    index?: number;
    titulo: string;
    conteudo: string;
  }) => Promise<void> | void;
  onDeleteCard: (index: number) => Promise<void> | void;
};

export function MaterialFlashcardEditor({
  cards,
  saving,
  onSaveCard,
  onDeleteCard,
}: MaterialFlashcardEditorProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editConteudo, setEditConteudo] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const openNew = () => {
    setIsNew(true);
    setEditIndex(null);
    setEditTitulo('');
    setEditConteudo('');
  };

  const openEdit = (index: number) => {
    const card = cards[index];
    setIsNew(false);
    setEditIndex(index);
    setEditTitulo(card.titulo);
    setEditConteudo(card.conteudo);
  };

  const closeEditor = () => {
    setIsNew(false);
    setEditIndex(null);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.sectionTitle}>Editar e criar flashcards</ThemedText>
        <Button variant="outline" onPress={openNew} style={styles.newBtn}>
          <Feather name="plus" size={18} color={colors.primary} />
          <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Nova flashcard</ThemedText>
        </Button>
      </View>

      <View style={styles.list}>
        {cards.map((c, i) => (
          <View key={i} style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.itemContent}>
              <ThemedText style={styles.itemTitulo} numberOfLines={1}>
                {c.titulo}
              </ThemedText>
              <ThemedText style={[styles.itemConteudo, { color: colors.mutedForeground }]} numberOfLines={2}>
                {c.conteudo}
              </ThemedText>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={() => openEdit(i)}
                style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="edit-2" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDeleteIndex(i)}
                disabled={saving}
                style={[styles.iconBtn, { backgroundColor: colors.destructive + '20' }]}
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {cards.length === 0 && (
        <ThemedText style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Nenhuma flashcard ainda. Clique em &quot;Nova flashcard&quot; para criar.
        </ThemedText>
      )}

      {/* Modal: Editar / Nova flashcard */}
      <Modal visible={editIndex !== null || isNew} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && closeEditor()}>
          <Pressable style={[styles.modalBox, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>{isNew ? 'Nova flashcard' : 'Editar flashcard'}</ThemedText>
            <ThemedText style={styles.modalLabel}>Pergunta (frente)</ThemedText>
            <Input value={editTitulo} onChangeText={setEditTitulo} placeholder="Título / pergunta" style={styles.modalInput} />
            <ThemedText style={styles.modalLabel}>Resposta (verso)</ThemedText>
            <TextInput
              value={editConteudo}
              onChangeText={setEditConteudo}
              placeholder="Resposta..."
              multiline
              style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={closeEditor} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onPress={async () => {
                  if (isNew) {
                    await onSaveCard({ mode: 'new', titulo: editTitulo, conteudo: editConteudo });
                  } else if (editIndex !== null) {
                    await onSaveCard({
                      mode: 'edit',
                      index: editIndex,
                      titulo: editTitulo,
                      conteudo: editConteudo,
                    });
                  }
                  closeEditor();
                }}
                disabled={saving || !editTitulo.trim() || !editConteudo.trim()}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Confirmar exclusão */}
      <Modal visible={deleteIndex !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => !saving && setDeleteIndex(null)}>
          <Pressable style={[styles.modalBox, styles.deleteModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Excluir esta flashcard?</ThemedText>
            <ThemedText style={[styles.deleteDesc, { color: colors.mutedForeground }]}>
              A pergunta e a resposta serão removidas. Esta ação não pode ser desfeita.
            </ThemedText>
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={() => setDeleteIndex(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onPress={async () => {
                  if (deleteIndex === null) return;
                  await onDeleteCard(deleteIndex);
                  setDeleteIndex(null);
                }}
                disabled={saving}
              >
                {saving ? 'Excluindo...' : 'Excluir'}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 8, borderWidth: 1 },
  itemContent: { flex: 1, minWidth: 0 },
  itemMaterial: { fontSize: 12, marginBottom: 2 },
  itemTitulo: { fontSize: 15, fontWeight: '600' },
  itemConteudo: { fontSize: 14, marginTop: 4 },
  itemActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 8 },
  emptyText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 12, padding: 20, maxHeight: '90%' },
  deleteModal: { maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  modalInput: { marginBottom: 16 },
  textArea: { minHeight: 120, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  pickerScroll: { maxHeight: 120, marginBottom: 16 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, marginBottom: 4 },
  deleteDesc: { fontSize: 14, marginBottom: 16 },
});
