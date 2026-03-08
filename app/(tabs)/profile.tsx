import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import Feather from '@expo/vector-icons/Feather';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  getPreferences,
  setPreferences,
  type UserPreferences,
  type FormatoPreferido,
  type DuracaoSessao,
  type NivelResumo,
  type TamanhoFonte,
  type Contraste,
  type Espacamento,
  type Animacoes,
} from '@/lib/preferences';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { usePreferencesContext } from '@/contexts/PreferencesContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const FORMATO_OPTIONS: { value: FormatoPreferido; label: string }[] = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'chat', label: 'Chat' },
];

const DURACAO_OPTIONS: { value: DuracaoSessao; label: string }[] = [
  { value: 'curta', label: 'Curta (15-20 min)' },
  { value: 'media', label: 'Média (25-30 min)' },
  { value: 'longa', label: 'Longa (45+ min)' },
];

const NIVEL_RESUMO_OPTIONS: { value: NivelResumo; label: string }[] = [
  { value: 'breve', label: 'Breve (2-3 frases)' },
  { value: 'medio', label: 'Médio (1 parágrafo)' },
  { value: 'completo', label: 'Completo (2-3 parágrafos)' },
];

const FONTE_OPTIONS: { value: TamanhoFonte; label: string }[] = [
  { value: 'P', label: 'P' },
  { value: 'M', label: 'M' },
  { value: 'G', label: 'G' },
];

const CONTRASTE_OPTIONS: { value: Contraste; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'alto', label: 'Alto' },
];

const ESPACAMENTO_OPTIONS: { value: Espacamento; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'amplo', label: 'Amplo' },
];

const ANIMACOES_OPTIONS: { value: Animacoes; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'reduzidas', label: 'Reduzidas' },
];

function OptionChips<K extends string>({
  options,
  value,
  onSelect,
  colors,
}: {
  options: { value: K; label: string }[];
  value: K;
  onSelect: (v: K) => void;
  colors: Record<string, string>;
}) {
  return (
    <View style={styles.chipsRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onSelect(opt.value)}
          style={[
            styles.chip,
            { backgroundColor: value === opt.value ? colors.primary : colors.muted },
          ]}
          activeOpacity={0.8}
        >
          <ThemedText
            style={[
              styles.chipText,
              { color: value === opt.value ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {opt.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RowSwitch({
  title,
  subtitle,
  value,
  onValueChange,
  colors,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: Record<string, string>;
}) {
  return (
    <View style={[styles.switchRow, { borderColor: colors.border }]}>
      <View style={styles.switchLabelWrap}>
        <ThemedText style={styles.switchTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.switchSubtitle, { color: colors.mutedForeground }]}>{subtitle}</ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const prefsContext = usePreferencesContext();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [pomodoroInput, setPomodoroInput] = useState('');
  const [pomodoroWorkInput, setPomodoroWorkInput] = useState('');

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/(tabs)');
        return;
      }
      setDisplayName(user.displayName ?? '');
      setEmail(user.email ?? '');
      const p = await getPreferences();
      setPrefs(p);
      setPomodoroInput(String(p.pomodoroBreakMinutes ?? 5));
      setPomodoroWorkInput(p.pomodoroWorkMinutes != null ? String(p.pomodoroWorkMinutes) : '');
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const updatePref = async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (!prefs) return;
    const next = await setPreferences({ [key]: value });
    setPrefs(next);
    await prefsContext?.refresh();
  };

  const handleSair = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
    router.replace('/(tabs)');
  };

  if (loading || !prefs) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingWrap, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

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
        <ThemedText style={styles.pageTitle}>Perfil e Configurações</ThemedText>
        <ThemedText style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Defina como prefere estudar: formato inicial, duração das sessões, tamanho do resumo, modo foco e mais.
        </ThemedText>

        {/* Perfil */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color={colors.foreground} />
            <ThemedText style={styles.sectionTitle}>Perfil</ThemedText>
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Nome</ThemedText>
            <Input value={displayName} editable={false} style={[styles.inputReadonly, { backgroundColor: colors.muted + '80' }]} />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>E-mail</ThemedText>
            <Input value={email} editable={false} style={[styles.inputReadonly, { backgroundColor: colors.muted + '80' }]} />
          </View>
          <Button variant="destructive" onPress={handleSair} style={styles.sairBtn}>
            <Feather name="log-out" size={18} color={colors.destructiveForeground} style={{ marginRight: 8 }} />
            <ThemedText style={{ color: colors.destructiveForeground, fontWeight: '600' }}>Sair</ThemedText>
          </Button>
        </View>

        {/* Preferências de estudo */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="book-open" size={20} color={colors.foreground} />
            <ThemedText style={styles.sectionTitle}>Preferências de estudo</ThemedText>
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Formato preferido</ThemedText>
            <OptionChips
              options={FORMATO_OPTIONS}
              value={prefs.formatoPreferido}
              onSelect={(v) => updatePref('formatoPreferido', v)}
              colors={colors}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Duração da sessão</ThemedText>
            <OptionChips
              options={DURACAO_OPTIONS}
              value={prefs.duracaoSessao}
              onSelect={(v) => updatePref('duracaoSessao', v)}
              colors={colors}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Tamanho do resumo</ThemedText>
            <ThemedText style={[styles.hint, { color: colors.mutedForeground }]}>
              Nas telas de estudo, o resumo pode ser exibido em 3 níveis (quando o PDF tiver sido processado com essa opção).
            </ThemedText>
            <OptionChips
              options={NIVEL_RESUMO_OPTIONS}
              value={prefs.nivelResumo}
              onSelect={(v) => updatePref('nivelResumo', v)}
              colors={colors}
            />
          </View>
        </View>

        {/* Modo foco */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="target" size={20} color={colors.foreground} />
            <ThemedText style={styles.sectionTitle}>Modo foco</ThemedText>
          </View>
          <ThemedText style={[styles.hint, { color: colors.mutedForeground, marginBottom: 16 }]}>
            Nas telas de estudo, esconde resumo, abas e links. Mostra apenas o formato escolhido e o timer.
          </ThemedText>
          <RowSwitch
            title="Modo foco como padrão"
            value={prefs.modoFoco}
            onValueChange={(v) => updatePref('modoFoco', v)}
            colors={colors}
          />
          <RowSwitch
            title="Esconder menu no modo foco"
            subtitle="Esconde também a barra superior"
            value={prefs.modoFocoEsconderMenu}
            onValueChange={(v) => updatePref('modoFocoEsconderMenu', v)}
            colors={colors}
          />
        </View>

        {/* Avisos e pausas */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Avisos e pausas</ThemedText>
          <RowSwitch
            title="Aviso antes de ir estudar"
            subtitle="Pergunta «Pronto para continuar?» antes de abrir a tela de estudo"
            value={prefs.avisoTransicao}
            onValueChange={(v) => updatePref('avisoTransicao', v)}
            colors={colors}
          />
          <RowSwitch
            title="Pausas tipo Pomodoro"
            subtitle="Após o timer de sessão, oferece pausa configurável"
            value={prefs.pausasPomodoro}
            onValueChange={(v) => updatePref('pausasPomodoro', v)}
            colors={colors}
          />
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Duração do foco (min)</ThemedText>
            <ThemedText style={[styles.hint, { color: colors.mutedForeground }]}>
              Vazio = usar duração da sessão (curta/média/longa). 1–120.
            </ThemedText>
            <Input
              value={pomodoroWorkInput}
              keyboardType="number-pad"
              placeholder="Usar duração da sessão"
              onChangeText={(t) => setPomodoroWorkInput(t.replace(/\D/g, ''))}
              onBlur={async () => {
                const n = pomodoroWorkInput.trim() === '' ? null : parseInt(pomodoroWorkInput, 10);
                const value = n === null || Number.isNaN(n) ? null : Math.min(120, Math.max(1, n));
                await updatePref('pomodoroWorkMinutes', value);
                setPomodoroWorkInput(value != null ? String(value) : '');
              }}
              style={[styles.inputReadonly, { backgroundColor: colors.muted + '80', minWidth: 80 }]}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Duração da pausa Pomodoro (min)</ThemedText>
            <ThemedText style={[styles.hint, { color: colors.mutedForeground }]}>
              1–60 minutos. Valor usado quando a pausa começar.
            </ThemedText>
            <Input
              value={pomodoroInput}
              keyboardType="number-pad"
              onChangeText={(t) => setPomodoroInput(t.replace(/\D/g, ''))}
              onBlur={async () => {
                const n = parseInt(pomodoroInput, 10);
                const clamped = Number.isNaN(n) || n < 1 ? 5 : Math.min(60, Math.max(1, n));
                await updatePref('pomodoroBreakMinutes', clamped);
                setPomodoroInput(String(clamped));
              }}
              style={[styles.inputReadonly, { backgroundColor: colors.muted + '80', minWidth: 80 }]}
            />
          </View>
        </View>

        {/* Conforto visual */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="eye" size={20} color={colors.foreground} />
            <ThemedText style={styles.sectionTitle}>Conforto visual</ThemedText>
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Tamanho da fonte</ThemedText>
            <OptionChips
              options={FONTE_OPTIONS}
              value={prefs.tamanhoFonte}
              onSelect={(v) => updatePref('tamanhoFonte', v)}
              colors={colors}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Contraste</ThemedText>
            <OptionChips
              options={CONTRASTE_OPTIONS}
              value={prefs.contraste}
              onSelect={(v) => updatePref('contraste', v)}
              colors={colors}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Espaçamento</ThemedText>
            <OptionChips
              options={ESPACAMENTO_OPTIONS}
              value={prefs.espacamento}
              onSelect={(v) => updatePref('espacamento', v)}
              colors={colors}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: colors.foreground }]}>Animações</ThemedText>
            <ThemedText style={[styles.hint, { color: colors.mutedForeground }]}>
              Reduzidas: transições quase instantâneas. Recomendado se movimento na tela incomoda.
            </ThemedText>
            <OptionChips
              options={ANIMACOES_OPTIONS}
              value={prefs.animacoes}
              onSelect={(v) => updatePref('animacoes', v)}
              colors={colors}
            />
          </View>
          <RowSwitch
            title="Alertas de tempo"
            subtitle="Lembrete a cada intervalo"
            value={prefs.alertasTempo}
            onValueChange={(v) => updatePref('alertasTempo', v)}
            colors={colors}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  pageTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, marginBottom: 24 },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  hint: { fontSize: 12, marginBottom: 8 },
  inputReadonly: { opacity: 0.9 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  chipText: { fontSize: 14, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  switchLabelWrap: { flex: 1, marginRight: 12 },
  switchTitle: { fontSize: 14, fontWeight: '500' },
  switchSubtitle: { fontSize: 12, marginTop: 2 },
  sairBtn: { marginTop: 8 },
});
