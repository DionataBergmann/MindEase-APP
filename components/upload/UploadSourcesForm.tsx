import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/atoms/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import type { ImageSource, PdfSource } from '@/lib/content-processing';

export type UploadSourcesFormProps = {
  pdfSources: PdfSource[];
  imageSources: ImageSource[];
  mergeAllIntoOne: boolean;
  onPdfSourcesChange: (sources: PdfSource[]) => void;
  onImageSourcesChange: (sources: ImageSource[]) => void;
  onMergeAllIntoOneChange: (value: boolean) => void;
  onResultsClear?: () => void;
  error: string | null;
  topicCount: number;
  processingIndex: number | null;
  onProcess: () => void | Promise<void>;
  pdfAvailable?: boolean | null;
  onPickPdfs: () => void | Promise<void>;
  onAddPhotos: () => void;
};

export function UploadSourcesForm({
  pdfSources,
  imageSources,
  mergeAllIntoOne,
  onPdfSourcesChange,
  onImageSourcesChange,
  onMergeAllIntoOneChange,
  onResultsClear,
  error,
  topicCount,
  processingIndex,
  onProcess,
  pdfAvailable = true,
  onPickPdfs,
  onAddPhotos,
}: UploadSourcesFormProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const hasSources = pdfSources.length > 0 || imageSources.length > 0;

  const clearResults = useCallback(() => {
    onResultsClear?.();
  }, [onResultsClear]);

  const removePdf = useCallback(
    (index: number) => {
      onPdfSourcesChange(pdfSources.filter((_, i) => i !== index));
      clearResults();
    },
    [pdfSources, onPdfSourcesChange, clearResults]
  );

  const removeImage = useCallback(
    (index: number) => {
      onImageSourcesChange(imageSources.filter((_, i) => i !== index));
      clearResults();
    },
    [imageSources, onImageSourcesChange, clearResults]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <ThemedText style={[styles.label, { color: colors.foreground }]}>PDFs</ThemedText>
        <TouchableOpacity
          style={[styles.uploadArea, { borderColor: colors.border }]}
          onPress={onPickPdfs}
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
              <View key={i} style={[styles.chip, { backgroundColor: colors.primary + '20' }]}>
                <ThemedText style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
                  {pdf.name}
                </ThemedText>
                <TouchableOpacity hitSlop={8} onPress={() => removePdf(i)} style={styles.chipRemove}>
                  <Feather name="x" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <ThemedText style={[styles.label, { color: colors.foreground }]}>Fotos</ThemedText>
        <TouchableOpacity
          style={[styles.uploadArea, { borderColor: colors.border }]}
          onPress={onAddPhotos}
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
        {imageSources.length > 0 && (
          <View style={styles.chipsRow}>
            {imageSources.map((_, i) => (
              <View key={i} style={[styles.chip, { backgroundColor: colors.primary + '20' }]}>
                <ThemedText style={[styles.chipText, { color: colors.primary }]}>Foto {i + 1}</ThemedText>
                <TouchableOpacity hitSlop={8} onPress={() => removeImage(i)} style={styles.chipRemove}>
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
              {mergeAllIntoOne ? 'Tudo em um único tópico' : 'Cada arquivo = 1 tópico'}
            </ThemedText>
            <ThemedText style={[styles.mergeHint, { color: colors.mutedForeground }]}>
              {mergeAllIntoOne
                ? 'PDFs e fotos serão combinados em um só resumo e cards.'
                : 'Cada PDF e cada foto geram um tópico separado.'}
            </ThemedText>
          </View>
          <Switch
            value={mergeAllIntoOne}
            onValueChange={onMergeAllIntoOneChange}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>
      )}

      {error ? (
        <ThemedText style={[styles.error, { color: colors.destructive }]}>{error}</ThemedText>
      ) : null}

      <Button
        onPress={onProcess}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
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
  processBtn: { width: '100%' },
});
