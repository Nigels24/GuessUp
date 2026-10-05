/**
 * Result screen (the prototype's #/s/result): score, accuracy, correct
 * count, time used, rank (with "View" to open that category's leaderboard),
 * badges earned in the round, the answer review, then Home or Play again
 * (same category and level).
 *
 * Right after a round (`fresh=1`) it uses the /finish response, which also
 * lists the new badges. Otherwise (a recent round tapped on Home, or after a
 * restart) it loads GET /game/sessions/:id.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  ErrorText,
  ErrorView,
  LoadingView,
  Pill,
} from '../../../src/components/ui';
import { Bounce, Confetti, PopIn } from '../../../src/components/motion';
import { apiErrorMessage } from '../../../src/lib/api';
import { dur } from '../../../src/lib/format';
import {
  fetchRound,
  finishedResult,
  levelInfo,
  startRound,
  type NewBadge,
  type SessionResult,
} from '../../../src/lib/game';
import { colors } from '../../../src/theme';

function trophy(accuracy: number): string {
  return accuracy >= 80 ? '🏆' : accuracy >= 50 ? '🎉' : '💪';
}

function message(accuracy: number): string {
  if (accuracy === 100) return 'Perfect round!';
  if (accuracy >= 80) return 'Excellent work!';
  if (accuracy >= 50) return 'Good job, keep going!';
  return 'Keep practicing, you got this!';
}

export default function ResultScreen() {
  const { sessionId, fresh } = useLocalSearchParams<{ sessionId: string; fresh?: string }>();
  const isFresh = fresh === '1';
  const [cached] = useState(() => (isFresh ? finishedResult(sessionId) : null));
  const [data, setData] = useState<SessionResult | null>(cached);
  const newBadges: NewBadge[] = cached?.newBadges ?? [];
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchRound(sessionId));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!cached) void load();
  }, [cached, load]);

  const home = () => router.dismissTo('/home');

  async function playAgain() {
    if (!data || starting) return;
    setStarting(true);
    setStartError('');
    try {
      const round = await startRound(data.session.category.id, data.session.difficulty);
      router.replace({ pathname: '/play/[sessionId]', params: { sessionId: round.sessionId } });
    } catch (e) {
      setStartError(apiErrorMessage(e));
      setStarting(false);
    }
  }

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        {error && !loading ? (
          <>
            <ErrorView message={error} retrying={loading} onRetry={() => void load()} />
            <View style={s.errorHome}>
              <Button title="🏠 Home" variant="ghost" onPress={home} />
            </View>
          </>
        ) : (
          <LoadingView />
        )}
      </SafeAreaView>
    );
  }

  const { session, review } = data;
  const level = levelInfo(session.difficulty);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.screen}>
        <View style={s.topbar}>
          <Pressable
            onPress={home}
            accessibilityRole="button"
            accessibilityLabel="Home"
            hitSlop={8}
            style={s.iconBtn}
          >
            <Text style={s.iconBtnText}>✕</Text>
          </Pressable>
          <Text style={s.topbarTitle}>{isFresh ? 'Round complete' : 'Round details'}</Text>
        </View>

        <View style={s.hero}>
          <Bounce>
            <Text style={s.trophy}>{trophy(session.accuracy)}</Text>
          </Bounce>
          <Text style={s.message}>{message(session.accuracy)}</Text>
          <View style={s.heroMeta}>
            <Text style={s.heroCategory}>
              {session.category.icon} {session.category.name} ·
            </Text>
            <Pill color={level.color}>{level.label}</Pill>
          </View>
          <Text style={s.bigScore}>{session.totalScore}</Text>
          <Text style={s.pointsLabel}>points</Text>
        </View>

        <View style={s.statRow}>
          <Stat
            value={`${session.accuracy}%`}
            label="Accuracy"
            color={session.accuracy >= 60 ? colors.ok : colors.bad}
          />
          <Stat value={`${session.correctCount}/${session.totalItems}`} label="Correct" />
          <Stat value={dur(session.timeSpent)} label="Time used" />
        </View>

        {data.rankInCategory ? (
          <View style={[s.card, s.rankCard]}>
            <Text style={s.rankIcon}>📊</Text>
            <View style={s.flex}>
              <Text style={s.rankText}>
                <Text style={s.bold}>Rank #{data.rankInCategory}</Text> of{' '}
                {data.totalPlayersInCategory}
              </Text>
              <Text style={s.small}>in {session.category.name}</Text>
            </View>
            <Button
              title="View"
              variant="ghost"
              small
              onPress={() =>
                router.dismissTo({ pathname: '/ranks', params: { cat: session.category.id } })
              }
            />
          </View>
        ) : null}

        {newBadges.length ? (
          <>
            <Text style={[s.sectionHeading, { marginTop: 6 }]}>
              🎖️ New badge{newBadges.length > 1 ? 's' : ''} unlocked!
            </Text>
            {newBadges.map((badge, i) => (
              <PopIn key={badge.code} duration={400} delay={300 + i * 150}>
                <LinearGradient
                  colors={[GOLD_FROM, GOLD_TO]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.newBadge}
                >
                  <Text style={s.badgeIcon}>{badge.icon}</Text>
                  <View style={s.flex}>
                    <Text style={s.bold}>{badge.name}</Text>
                    <Text style={s.small}>{badge.description}</Text>
                  </View>
                </LinearGradient>
              </PopIn>
            ))}
          </>
        ) : null}

        <Text style={s.sectionHeading}>Review answers</Text>
        {review.map((item) => (
          <View key={item.index} style={s.reviewItem}>
            <Text style={s.reviewIcon}>{item.isCorrect ? '✅' : '❌'}</Text>
            <View style={s.flex}>
              <Text style={s.reviewQuestion}>
                {item.index}. {item.questionText}
              </Text>
              <Text style={s.reviewLine}>
                <Text style={s.muted}>Your answer: </Text>
                {item.submitted ? (
                  <Text style={[s.bold, { color: item.isCorrect ? colors.ok : colors.bad }]}>
                    {item.submitted}
                  </Text>
                ) : (
                  <Text style={[s.bold, s.italic, { color: colors.bad }]}>
                    no answer (time ran out)
                  </Text>
                )}
              </Text>
              {item.isCorrect ? null : (
                <Text style={s.reviewLine}>
                  Correct: <Text style={s.bold}>{item.correctAnswer}</Text>
                </Text>
              )}
              <Text style={s.small}>
                {item.timeTaken}s{item.hintUsed ? ' · 💡 hint used' : ''} · +{item.pointsEarned} pts
              </Text>
            </View>
          </View>
        ))}

        {startError ? <ErrorText>{startError}</ErrorText> : null}
        <View style={s.buttons}>
          <Button title="🏠 Home" variant="ghost" style={s.flex} onPress={home} />
          <Button
            title="↻ Play again"
            style={s.flex}
            loading={starting}
            onPress={() => void playAgain()}
          />
        </View>
      </ScrollView>
      {/* As in the prototype: confetti once, right after a round of 80 % or more. */}
      {isFresh && session.accuracy >= 80 ? <Confetti /> : null}
    </SafeAreaView>
  );
}

/** The prototype's .new-badge gradient (135°). */
const GOLD_FROM = '#FFF7DB';
const GOLD_TO = '#FFE9A8';

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const cardShadow = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24 },
  errorHome: { paddingHorizontal: 24, paddingBottom: 24 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16, color: colors.ink2 },
  topbarTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.ink },
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  trophy: { fontSize: 64 },
  message: { marginTop: 4, fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 10,
  },
  heroCategory: { fontSize: 13, fontWeight: '700', color: colors.muted },
  bigScore: { fontSize: 58, lineHeight: 62, fontWeight: '800', color: colors.brandDark },
  pointsLabel: { fontWeight: '800', color: colors.muted },
  statRow: { flexDirection: 'row', gap: 10, marginVertical: 18 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...cardShadow,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, ...cardShadow },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rankIcon: { fontSize: 28 },
  rankText: { color: colors.ink },
  sectionHeading: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.newBadge, // under the gradient
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  badgeIcon: { fontSize: 32 },
  reviewItem: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    ...cardShadow,
  },
  reviewIcon: { fontSize: 18 },
  reviewQuestion: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  reviewLine: { marginTop: 3, fontSize: 13.5, color: colors.ink },
  muted: { color: colors.muted },
  bold: { fontWeight: '800', color: colors.ink },
  italic: { fontStyle: 'italic' },
  small: { fontSize: 13, color: colors.muted },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
