import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export type StudyTimerProps = {
  /** Duração inicial em minutos */
  initialMinutes: number;
  /** Chamado quando o timer chega a 0 */
  onComplete?: () => void;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function StudyTimer({ initialMinutes, onComplete }: StudyTimerProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isRunning || secondsRemaining <= 0) return;
    const t = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning, secondsRemaining]);

  const handleReset = () => {
    setIsRunning(false);
    setSecondsRemaining(initialMinutes * 60);
  };

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.primary + '26', borderColor: colors.primary + '40' },
      ]}
    >
      <ThemedText style={[styles.time, { color: colors.foreground }]}>
        {formatTime(secondsRemaining)}
      </ThemedText>
      <TouchableOpacity
        onPress={() => setIsRunning((v) => !v)}
        style={[styles.iconBtn, { backgroundColor: colors.primary + '30' }]}
        activeOpacity={0.8}
      >
        <Feather
          name={isRunning ? 'pause' : 'play'}
          size={18}
          color={colors.foreground}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleReset}
        style={[styles.iconBtn, { backgroundColor: colors.primary + '30' }]}
        activeOpacity={0.8}
      >
        <Feather name="rotate-ccw" size={18} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    fontWeight: '600',
    minWidth: 44,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
