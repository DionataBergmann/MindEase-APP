import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/atoms/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useContrastLevel, useReducedAnimations } from '@/contexts/PreferencesContext';
import type { ProjectCard } from '@/types/project';

export type FlashcardCarouselMode = 'project' | 'material';

export type FlashcardCarouselProps = {
  cards: ProjectCard[];
  cardIndex: number;
  onCardIndexChange: (index: number) => void;
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
  mode: FlashcardCarouselMode;
  renderActions?: (params: { flipped: boolean }) => React.ReactNode;
  footerText?: string;
};

const FLIP_DURATION = 400;
const SLIDE_SPRING = { damping: 34, stiffness: 320 };

export function FlashcardCarousel({
  cards,
  cardIndex,
  onCardIndexChange,
  flipped,
  onFlippedChange,
  mode,
  renderActions,
  footerText: footerTextProp,
}: FlashcardCarouselProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const contrastLevel = useContrastLevel();
  const reducedAnimations = useReducedAnimations();
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  const flipRotation = useSharedValue(0);
  const slideOffset = useSharedValue(0);

  const hasPrev = cardIndex > 0;
  const hasNext = cardIndex < cards.length - 1;
  const currentCard = cards[cardIndex] ?? null;

  const borderW = contrastLevel === 'alto' ? 2 : 1;
  const flipDuration = reducedAnimations ? 0 : FLIP_DURATION;

  // Flip animation when flipped state changes (instant when reduced)
  useEffect(() => {
    flipRotation.value = withTiming(flipped ? 180 : 0, {
      duration: flipDuration,
    });
  }, [flipped, flipRotation, flipDuration]);

  // Slide animation when card index changes (instant when reduced)
  useEffect(() => {
    if (reducedAnimations) {
      slideOffset.value = 0;
    } else {
      slideOffset.value = slideDirection * 120;
      slideOffset.value = withSpring(0, SLIDE_SPRING);
    }
  }, [cardIndex, slideDirection, slideOffset, reducedAnimations]);

  const handlePrev = () => {
    if (!hasPrev) return;
    setSlideDirection(-1);
    onFlippedChange(false);
    onCardIndexChange(cardIndex - 1);
  };

  const handleNext = () => {
    if (!hasNext) return;
    setSlideDirection(1);
    onFlippedChange(false);
    onCardIndexChange(cardIndex + 1);
  };

  const defaultFooterText =
    mode === 'material'
      ? flipped
        ? 'Próximo ou Anterior para navegar.'
        : 'Clique para ver a resposta'
      : 'Clique para ver a resposta';
  const footerText = footerTextProp ?? defaultFooterText;

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideOffset.value }],
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipRotation.value}deg` }],
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipRotation.value + 180}deg` }],
  }));

  if (!currentCard) return null;

  const faceBase = [styles.face, { backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[styles.cardContainer, { borderColor: colors.border, backgroundColor: colors.card, borderWidth: borderW }]}
        onPress={() => onFlippedChange(!flipped)}
      >
        <View style={styles.cardInner}>
          <Animated.View style={[styles.slideWrap, slideAnimatedStyle]}>
            <View style={styles.flipContainer} pointerEvents="none">
              <Animated.View
                style={[styles.face, styles.faceFront, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: borderW }, frontFaceStyle]}
              >
                <ThemedText style={[styles.faceLabel, { color: colors.mutedForeground }]}>
                  Pergunta
                </ThemedText>
                <ThemedText style={styles.faceTitle}>{currentCard.titulo}</ThemedText>
              </Animated.View>
              <Animated.View
                style={[styles.face, styles.faceBack, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: borderW }, backFaceStyle]}
              >
                <ThemedText style={[styles.faceLabel, { color: colors.mutedForeground }]}>
                  Resposta
                </ThemedText>
                <ThemedText style={styles.faceContent}>{currentCard.conteudo}</ThemedText>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </Pressable>

      <ThemedText style={[styles.footer, { color: colors.mutedForeground }]}>
        {footerText} · {cardIndex + 1}/{cards.length}
      </ThemedText>

      {renderActions ? (
        <View style={styles.buttons}>{renderActions({ flipped })}</View>
      ) : (
        <View style={styles.buttons}>
          <Button
            variant="outline"
            onPress={handlePrev}
            disabled={!hasPrev}
            style={styles.btn}
          >
            <Feather name="chevron-left" size={18} color={colors.primary} />
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Anterior</ThemedText>
          </Button>
          <Button
            variant="outline"
            onPress={handleNext}
            disabled={!hasNext}
            style={styles.btn}
          >
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Próximo</ThemedText>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  cardContainer: {
    width: '100%',
    minHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardInner: { flex: 1, minHeight: 220 },
  slideWrap: { width: '100%', minHeight: 220 },
  flipContainer: {
    width: '100%',
    minHeight: 220,
    position: 'relative',
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  faceFront: {},
  faceBack: {},
  faceLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  faceTitle: { fontSize: 18, fontWeight: '700' },
  faceContent: { fontSize: 15, lineHeight: 22 },
  footer: { fontSize: 12, marginTop: 12, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 16, marginTop: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
