import { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Feather from '@expo/vector-icons/Feather';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb } from '@/lib/firebase';
import {
  processSources,
  getTopicDisplayNameWithPdfNames,
  isPdfExtractionAvailable,
  type ImageSource,
  type PdfSource,
} from '@/lib/content-processing';
import type { ProcessContentResponse } from '@/types/process-content';
import type { Material } from '@/types/project';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { UploadSourcesForm, ProcessedResultsList } from '@/components/upload';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function AddPdfScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

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

  const handleSaveToProject = useCallback(async () => {
    if (!id || results.length === 0) return;
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    const user = auth?.currentUser;
    if (!user || !db) {
      setError('Faça login para continuar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const projectRef = doc(db, 'projects', id);
      const snap = await getDoc(projectRef);
      if (!snap.exists() || snap.data()?.userId !== user.uid) {
        setError('Projeto não encontrado.');
        return;
      }
      const existing = (snap.data().materiais ?? []) as Material[];
      const newMateriais: Material[] = results.map((result, i) => ({
        id: `material-${Date.now()}-${i}`,
        nomeArquivo: getTopicDisplayNameWithPdfNames(i, pdfSources, imageSources.length),
        resumo: result.resumo,
        resumoBreve: result.resumoBreve,
        resumoMedio: result.resumoMedio,
        resumoCompleto: result.resumoCompleto,
        cards: result.cards,
        status: 'pending',
      }));
      const updated = [...existing, ...newMateriais];
      await updateDoc(projectRef, {
        materiais: updated,
        pdfCount: updated.length,
        updatedAt: serverTimestamp(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar no projeto.');
    } finally {
      setIsSaving(false);
    }
  }, [id, results, pdfSources, imageSources.length, router]);

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

        <ThemedText style={styles.title}>Adicionar PDF ou fotos</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Envie PDFs e/ou fotos para gerar novos tópicos neste projeto. Você pode
          juntar tudo em um tópico ou gerar um tópico por arquivo.
        </ThemedText>

        <UploadSourcesForm
          pdfSources={pdfSources}
          imageSources={imageSources}
          mergeAllIntoOne={mergeAllIntoOne}
          onPdfSourcesChange={setPdfSources}
          onImageSourcesChange={setImageSources}
          onMergeAllIntoOneChange={setMergeAllIntoOne}
          onResultsClear={() => {
            setResults([]);
            setError(null);
          }}
          error={error}
          topicCount={topicCount}
          processingIndex={processingIndex}
          onProcess={handleProcess}
          pdfAvailable={pdfAvailable}
          onPickPdfs={pickPdfs}
          onAddPhotos={showPhotoOptions}
        />

        {results.length > 0 && (
          <ProcessedResultsList
            results={results}
            pdfSources={pdfSources}
            imageCount={imageSources.length}
            onRemoveResult={removeResult}
          >
            <Button onPress={handleSaveToProject} disabled={isSaving} style={styles.saveBtn}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="save" size={18} color={colors.primaryForeground} style={{ marginRight: 8 }} />
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>
                    Adicionar {results.length} tópico(s) ao projeto
                  </ThemedText>
                </>
              )}
            </Button>
          </ProcessedResultsList>
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
  saveBtn: { width: '100%' },
});
