import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Feather from '@expo/vector-icons/Feather';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase';
import {
  processSources,
  getTopicDisplayName,
  getTopicDisplayNameWithPdfNames,
  isPdfExtractionAvailable,
  type ImageSource,
  type PdfSource,
} from '@/lib/content-processing';
import type { ProcessContentResponse } from '@/types/process-content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function NewProjectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [projectName, setProjectName] = useState('');
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([]);
  const [imageSources, setImageSources] = useState<ImageSource[]>([]);
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null);
  const [mergeAllIntoOne, setMergeAllIntoOne] = useState(false);
  const [results, setResults] = useState<ProcessContentResponse[]>([]);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    isPdfExtractionAvailable().then(setPdfAvailable);
  }, []);

  const imageCount = imageSources.filter((s) => s.base64).length;
  const topicCount = mergeAllIntoOne
    ? (pdfSources.length + imageCount > 0 ? 1 : 0)
    : pdfSources.length + imageCount;
  const hasSources = pdfSources.length > 0 || imageSources.length > 0;

  const pickPdfs = useCallback(async () => {
    const available = await isPdfExtractionAvailable();
    if (!available) {
      setError(
        'PDF requer um build de desenvolvimento (não funciona no Expo Go). Rode: npx expo run:ios ou npx expo run:android.'
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled) return;
    const newPdfs: PdfSource[] = result.assets.map((a) => ({
      uri: a.uri,
      name: a.name ?? 'documento.pdf',
    }));
    setPdfSources((prev) => [...prev, ...newPdfs]);
    setResults([]);
    setError(null);
  }, []);

  const removePdf = useCallback((index: number) => {
    setPdfSources((prev) => prev.filter((_, i) => i !== index));
    setResults([]);
    setError(null);
  }, []);

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão para acessar a galeria é necessária.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const newSources: ImageSource[] = result.assets.map((a) => ({
      uri: a.uri,
      base64: a.base64 ?? undefined,
    }));
    setImageSources((prev) => [...prev, ...newSources]);
    setResults([]);
    setError(null);
  }, []);

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão para usar a câmera é necessária.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setImageSources((prev) => [
      ...prev,
      { uri: asset.uri, base64: asset.base64 ?? undefined },
    ]);
    setResults([]);
    setError(null);
  }, []);

  const showPhotoOptions = useCallback(() => {
    Alert.alert('Adicionar foto', 'Tirar foto ou escolher da galeria?', [
      { text: 'Tirar foto', onPress: openCamera },
      { text: 'Escolher da galeria', onPress: pickImages },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [openCamera, pickImages]);

  const removeImage = useCallback((index: number) => {
    setImageSources((prev) => prev.filter((_, i) => i !== index));
    setResults([]);
    setError(null);
  }, []);

  const removeResult = useCallback(
    (index: number) => {
      const pdfCount = pdfSources.length;
      setResults((prev) => prev.filter((_, i) => i !== index));
      if (mergeAllIntoOne) {
        setPdfSources([]);
        setImageSources([]);
      } else {
        if (index < pdfCount) {
          setPdfSources((prev) => prev.filter((_, i) => i !== index));
        } else {
          setImageSources((prev) => prev.filter((_, i) => i !== index - pdfCount));
        }
      }
    },
    [pdfSources.length, mergeAllIntoOne]
  );

  const handleProcess = useCallback(async () => {
    if (topicCount === 0) {
      setError('Adicione PDFs e/ou fotos.');
      return;
    }
    setError(null);
    setResults([]);
    try {
      const allResults = await processSources({
        pdfSources,
        imageSources,
        mergeAllIntoOne,
        onStep: setProcessingIndex,
      });
      setProcessingIndex(null);
      setResults(allResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar.');
      setProcessingIndex(null);
    }
  }, [pdfSources, imageSources, mergeAllIntoOne, topicCount]);

  const handleSaveProject = useCallback(async () => {
    if (results.length === 0) return;
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    const user = auth?.currentUser;
    if (!user || !db) {
      setError('Faça login para salvar o projeto.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const title =
        projectName.trim() ||
        (pdfSources.length > 0 ? pdfSources[0].name.replace(/\.pdf$/i, '') : null) ||
        (imageSources.length > 0 ? 'Fotos' : 'Sem título');
      const materiais = results.map((result, i) => ({
        id: `material-${Date.now()}-${i}`,
        nomeArquivo: getTopicDisplayNameWithPdfNames(i, pdfSources, imageSources.length),
        resumo: result.resumo,
        resumoBreve: result.resumoBreve,
        resumoMedio: result.resumoMedio,
        resumoCompleto: result.resumoCompleto,
        cards: result.cards,
      }));
      await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        title,
        emoji: '📚',
        pdfCount: materiais.length,
        progress: 0,
        materiais,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao salvar no Firebase.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [results, projectName, pdfSources, imageSources.length, router]);

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
            Voltar
          </ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.title}>Novo projeto de estudo</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Envie PDFs e/ou fotos de páginas. Você pode juntar tudo em um único
          tópico ou gerar um tópico por arquivo.
        </ThemedText>

        <View style={styles.field}>
          <ThemedText style={[styles.label, { color: colors.foreground }]}>
            Nome do projeto
          </ThemedText>
          <Input
            placeholder="Ex.: Projeto"
            value={projectName}
            onChangeText={setProjectName}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={[styles.label, { color: colors.foreground }]}>
            PDFs
          </ThemedText>
          <TouchableOpacity
            style={[styles.uploadArea, { borderColor: colors.border }]}
            onPress={pickPdfs}
            activeOpacity={0.8}
            disabled={pdfAvailable === false}
          >
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <ThemedText style={[styles.uploadText, { color: colors.foreground }]}>
              Adicionar PDFs
            </ThemedText>
            <ThemedText style={[styles.uploadHint, { color: colors.mutedForeground }]}>
              vários de uma vez
            </ThemedText>
            {pdfAvailable === false && (
              <ThemedText style={[styles.pdfHint, { color: colors.mutedForeground }]}>
                PDF requer build de desenvolvimento (não funciona no Expo Go)
              </ThemedText>
            )}
          </TouchableOpacity>
          {pdfSources.length > 0 && (
            <View style={styles.chipsRow}>
              {pdfSources.map((pdf, i) => (
                <View
                  key={i}
                  style={[styles.chip, { backgroundColor: colors.primary + '20' }]}
                >
                  <ThemedText style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
                    {pdf.name}
                  </ThemedText>
                  <TouchableOpacity
                    hitSlop={8}
                    onPress={() => removePdf(i)}
                    style={styles.chipRemove}
                  >
                    <Feather name="x" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <ThemedText style={[styles.label, { color: colors.foreground }]}>
            Fotos
          </ThemedText>
          <TouchableOpacity
            style={[styles.uploadArea, { borderColor: colors.border }]}
            onPress={showPhotoOptions}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={32} color={colors.mutedForeground} />
            <ThemedText style={[styles.uploadText, { color: colors.foreground }]}>
              Tirar foto ou enviar da galeria
            </ThemedText>
            <ThemedText style={[styles.uploadHint, { color: colors.mutedForeground }]}>
              várias de uma vez na galeria
            </ThemedText>
          </TouchableOpacity>

          {hasSources && (
            <View style={styles.chipsRow}>
              {imageSources.map((_, i) => (
                <View
                  key={i}
                  style={[styles.chip, { backgroundColor: colors.primary + '20' }]}
                >
                  <ThemedText style={[styles.chipText, { color: colors.primary }]}>
                    Foto {i + 1}
                  </ThemedText>
                  <TouchableOpacity
                    hitSlop={8}
                    onPress={() => removeImage(i)}
                    style={styles.chipRemove}
                  >
                    <Feather name="x" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {hasSources && (
          <View style={[styles.mergeRow, { backgroundColor: colors.muted + '50', borderColor: colors.border }]}>
            <View style={styles.mergeLabels}>
              <ThemedText style={styles.mergeTitle}>
                {mergeAllIntoOne
                  ? 'Tudo em um único tópico'
                  : 'Cada arquivo = 1 tópico'}
              </ThemedText>
              <ThemedText style={[styles.mergeHint, { color: colors.mutedForeground }]}>
                {mergeAllIntoOne
                  ? 'PDFs e fotos serão combinados em um só resumo e cards.'
                  : 'Cada PDF e cada foto geram um tópico separado.'}
              </ThemedText>
            </View>
            <Switch
              value={mergeAllIntoOne}
              onValueChange={setMergeAllIntoOne}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.background}
            />
          </View>
        )}

        {error ? (
          <ThemedText style={[styles.error, { color: colors.destructive }]}>
            {error}
          </ThemedText>
        ) : null}

        <Button
          onPress={handleProcess}
          disabled={topicCount === 0 || processingIndex !== null}
          style={styles.processBtn}
        >
          {processingIndex !== null ? (
            <>
              <ActivityIndicator size="small" color={colors.primaryForeground} />
              <ThemedText style={{ color: colors.primaryForeground, marginLeft: 8 }}>
                Processando {processingIndex + 1} de {topicCount}…
              </ThemedText>
            </>
          ) : (
            <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>
              Gerar resumo e cards{topicCount > 1 ? ` (${topicCount} tópicos)` : topicCount === 1 ? ' (1 tópico)' : ''}
            </ThemedText>
          )}
        </Button>

        {results.length > 0 && (
          <View style={[styles.resultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultsHeader}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <ThemedText style={[styles.resultsTitle, { color: colors.success }]}>
                {results.length}{' '}
                {results.length === 1 ? 'tópico gerado' : 'tópicos gerados'}
              </ThemedText>
            </View>
            <ScrollView
              style={styles.resultsList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {results.map((result, idx) => (
                <View
                  key={idx}
                  style={[styles.resultItem, { borderColor: colors.border }]}
                >
                  <View style={styles.resultItemHeader}>
                    <ThemedText
                      style={[styles.resultItemLabel, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {getTopicDisplayNameWithPdfNames(idx, pdfSources, imageSources.length)}
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => removeResult(idx)}
                      style={[styles.resultItemRemove, { backgroundColor: colors.destructive + '20' }]}
                      hitSlop={8}
                      accessibilityLabel="Excluir tópico"
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={styles.resultItemResumo} numberOfLines={3}>
                    {result.resumo}
                  </ThemedText>
                  <ThemedText style={[styles.resultItemCards, { color: colors.mutedForeground }]}>
                    {result.cards.length} card(s)
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
            <Button
              onPress={handleSaveProject}
              disabled={isSaving}
              style={styles.saveBtn}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="save" size={18} color={colors.primaryForeground} style={{ marginRight: 8 }} />
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>
                    Criar projeto com {results.length} tópico(s)
                  </ThemedText>
                </>
              )}
            </Button>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  backText: { fontSize: 14 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { marginBottom: 0 },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  uploadHint: { fontSize: 12, marginTop: 4 },
  pdfHint: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  chipRemove: { padding: 4 },
  mergeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  mergeLabels: { flex: 1, marginRight: 16 },
  mergeTitle: { fontSize: 14, fontWeight: '600' },
  mergeHint: { fontSize: 12, marginTop: 4 },
  error: { fontSize: 14, marginBottom: 12 },
  processBtn: { marginBottom: 24 },
  resultsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  resultsTitle: { fontSize: 16, fontWeight: '600' },
  resultsList: { maxHeight: 280, marginBottom: 16 },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  resultItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  resultItemRemove: {
    padding: 6,
    borderRadius: 6,
  },
  resultItemLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  resultItemResumo: { fontSize: 14, lineHeight: 20 },
  resultItemCards: { fontSize: 12, marginTop: 8 },
  saveBtn: { width: '100%' },
});
