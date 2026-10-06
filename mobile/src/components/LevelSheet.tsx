/**
 * The prototype's level picker: a bottom sheet with the category's
 * description, the three levels (Easy selected first) with their timer, hint
 * and points rules, and "▶ Start round (5 items)". Starting calls
 * POST /game/sessions; the caller navigates with the returned round.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../lib/api';
import { count, tint } from '../lib/format';
import {
  LEVELS,
  ROUND_SIZE,
  startRound,
  type Category,
  type Difficulty,
  type RoundState,
} from '../lib/game';
import { colors } from '../theme';
import { ErrorText, Pill, PrimaryButton } from './ui';

export function LevelSheet({
  category,
  onClose,
  onStarted,
}: {
  /** The category to play; null hides the sheet. */
  category: Category | null;
  onClose: () => void;
  onStarted: (round: RoundState) => void;
}) {
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<Difficulty>('EASY');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Every opening starts on Easy, as in the prototype.
  useEffect(() => {
    if (category) {
      setChosen('EASY');
      setError('');
      setStarting(false);
    }
  }, [category]);

  async function start() {
    if (!category || starting) return;
    setStarting(true);
    setError('');
    try {
      const round = await startRound(category.id, chosen);
      onStarted(round);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  const close = () => {
    if (!starting) onClose();
  };

  return (
    <Modal
      visible={!!category}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.head}>
            <Text style={s.title} numberOfLines={2}>
              {category ? `${category.icon} ${category.name}` : ''}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={s.close}
              hitSlop={8}
            >
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.body} bounces={false}>
            {category?.description ? <Text style={s.desc}>{category.description}</Text> : null}
            {LEVELS.map((level) => {
              const selected = level.key === chosen;
              return (
                <Pressable
                  key={level.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setChosen(level.key)}
                  style={[s.opt, selected && s.optSelected]}
                >
                  <View style={[s.dot, { backgroundColor: tint(level.color, '22') }]}>
                    <Text style={s.dotIcon}>{level.icon}</Text>
                  </View>
                  <View style={s.optBody}>
                    <Text style={s.optLabel}>{level.label}</Text>
                    <Text style={s.optDesc}>{level.desc}</Text>
                    <View style={s.rules}>
                      <Pill>⏱ {level.seconds}s / item</Pill>
                      <Pill>
                        {level.hints
                          ? `💡 ${count(level.hints, 'hint')} (−${level.hintPenalty} pts)`
                          : '🚫 No hints'}
                      </Pill>
                      <Pill>⭐ {level.points} pts</Pill>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {error ? <ErrorText>{error}</ErrorText> : null}
            <View style={s.go}>
              <PrimaryButton
                title={`▶ Start round (${ROUND_SIZE} items)`}
                loadingTitle="Starting…"
                loading={starting}
                onPress={() => void start()}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '90%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.ink },
  close: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: colors.ink2 },
  body: { paddingHorizontal: 20, paddingTop: 10 },
  desc: { color: colors.muted, fontWeight: '700', marginTop: -4, marginBottom: 14 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  optSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  dot: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: { fontSize: 20 },
  optBody: { flex: 1 },
  optLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  optDesc: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  go: { marginTop: 6 },
});
