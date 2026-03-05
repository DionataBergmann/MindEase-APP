import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { getTopicDisplayNameWithPdfNames } from '@/lib/content-processing';
import type { ProcessContentResponse } from '@/types/process-content';
import type { PdfSource } from '@/lib/content-processing';

export type ProcessedResultsListProps = {
  results: ProcessContentResponse[];
  pdfSources: PdfSource[];
  imageCount: number;
  onRemoveResult?: (index: number) => void;
  children: React.ReactNode;
};

export function ProcessedResultsList({
  results,
  pdfSources,
  imageCount,
  onRemoveResult,
  children,
}: ProcessedResultsListProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Feather name="check-circle" size={20} color={colors.success} />
        <ThemedText style={[styles.title, { color: colors.success }]}>
          {results.length} {results.length === 1 ? 'tópico gerado' : 'tópicos gerados'}
        </ThemedText>
      </View>
      <ScrollView
        style={styles.list}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {results.map((result, idx) => (
          <View key={idx} style={[styles.item, { borderColor: colors.border }]}>
            <View style={styles.itemHeader}>
              <ThemedText
                style={[styles.itemLabel, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {getTopicDisplayNameWithPdfNames(idx, pdfSources, imageCount)}
              </ThemedText>
              {onRemoveResult ? (
                <TouchableOpacity
                  onPress={() => onRemoveResult(idx)}
                  style={[styles.removeBtn, { backgroundColor: colors.destructive + '20' }]}
                  hitSlop={8}
                  accessibilityLabel="Excluir tópico"
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ThemedText style={styles.resumo} numberOfLines={3}>
              {result.resumo}
            </ThemedText>
            <ThemedText style={[styles.cardsCount, { color: colors.mutedForeground }]}>
              {result.cards.length} card(s)
            </ThemedText>
          </View>
        ))}
      </ScrollView>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600' },
  list: { maxHeight: 280, marginBottom: 16 },
  item: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  itemLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  removeBtn: { padding: 6, borderRadius: 6 },
  resumo: { fontSize: 14, lineHeight: 20 },
  cardsCount: { fontSize: 12, marginTop: 8 },
});
