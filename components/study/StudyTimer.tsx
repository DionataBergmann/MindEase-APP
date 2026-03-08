import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Button } from '@/components/atoms/Button';

export type StudyTimerProps = {
  /** Duração inicial em minutos */
  initialMinutes: number;
  /** Chamado quando o timer chega a 0 */
  onComplete?: () => void;
  editable?: boolean;
  onMinutesChange?: (minutes: number) => void;
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function StudyTimer({ initialMinutes, onComplete, editable, onMinutesChange }: StudyTimerProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMinutes, setEditMinutes] = useState(String(initialMinutes));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setSecondsRemaining(initialMinutes * 60);
    setEditMinutes(String(initialMinutes));
  }, [initialMinutes]);

  useEffect(() => {
    if (!isRunning || secondsRemaining <= 0) return;
    const t = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          const cb = onCompleteRef.current;
          if (cb) setTimeout(cb, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning, secondsRemaining]);

  useEffect(() => {
    if (secondsRemaining === 0 && !isRunning && initialMinutes >= 1) {
      setSecondsRemaining(initialMinutes * 60);
    }
  }, [secondsRemaining, isRunning, initialMinutes]);

  const handleReset = () => {
    setIsRunning(false);
    setSecondsRemaining(initialMinutes * 60);
  };

  const openModal = () => {
    if (!editable || isRunning) return;
    setEditMinutes(String(Math.floor(secondsRemaining / 60) || 1));
    setModalOpen(true);
  };

  const handleApply = () => {
    const n = Math.max(1, Math.min(120, Number(editMinutes) || 1));
    setEditMinutes(String(n));
    setSecondsRemaining(n * 60);
    onMinutesChange?.(n);
    setModalOpen(false);
  };

  return (
    <>
      <View
        style={[
          styles.wrapper,
          { backgroundColor: colors.primary + '26', borderColor: colors.primary + '40' },
        ]}
      >
        <TouchableOpacity onPress={openModal} disabled={!editable || isRunning} activeOpacity={editable && !isRunning ? 0.7 : 1}>
          <ThemedText style={[styles.time, { color: colors.foreground }]}>
            {formatTime(secondsRemaining)}
          </ThemedText>
        </TouchableOpacity>
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

      {modalOpen && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setModalOpen(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              <ThemedText style={[styles.modalTitle, { color: colors.foreground }]}>Editar duração do timer</ThemedText>
              <ThemedText style={[styles.modalHint, { color: colors.mutedForeground }]}>
                Defina por quantos minutos quer estudar (1 a 120).
              </ThemedText>
              <TextInput
                value={editMinutes}
                onChangeText={(t) => setEditMinutes(t.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                placeholder="Ex.: 25"
                style={[styles.modalInput, { backgroundColor: colors.muted + '80', color: colors.foreground, borderColor: colors.border }]}
                placeholderTextColor={colors.mutedForeground}
              />
              <View style={styles.modalActions}>
                <Button variant="outline" onPress={() => setModalOpen(false)}>
                  <ThemedText style={{ color: colors.foreground, fontWeight: '600' }}>Cancelar</ThemedText>
                </Button>
                <Button onPress={handleApply}>
                  <ThemedText style={{ color: colors.primaryForeground, fontWeight: '600' }}>Aplicar</ThemedText>
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
