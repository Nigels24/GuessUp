/**
 * My Progress (the prototype's #/s/progress), from completed rounds only:
 * rounds, accuracy and points; accuracy by subject; the topics missed most
 * ("Topics to review", each with Practice); and the score history (the latest
 * 20 rounds, newest first; tapping one opens its result). Every number comes
 * from GET /me/progress. Reloads on focus and on pull to refresh.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace } from '../../../src/components/BottomNav';
import { CategoryLine, HistoryRow } from '../../../src/components/rows';
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  ErrorView,
  LoadingView,
  SectionTitle,
  TopBar,
} from '../../../src/components/ui';
import { apiErrorMessage } from '../../../src/lib/api';
import { num } from '../../../src/lib/format';
import { fetchProgress, type MeProgress } from '../../../src/lib/game';
import { colors } from '../../../src/theme';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<MeProgress | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async (mode: 'quiet' | 'refresh') => {
    const id = ++latest.current;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const progress = await fetchProgress();
      if (id !== latest.current) return; // a newer load is under way
      setData(progress);
      setError('');
    } catch (e) {
      if (id === latest.current) setError(apiErrorMessage(e));
    } finally {
      if (id === latest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load('quiet');
    }, [load]),
  );

  if (!data) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {error && !loading ? (
          <ErrorView message={error} retrying={loading} onRetry={() => void load('quiet')} />
        ) : (
          <LoadingView />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.screen, { paddingBottom: bottomNavSpace(insets.bottom) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      >
        <TopBar title="My Progress" />
        {error ? <ErrorText>{error}</ErrorText> : null}

        {!data.roundsPlayed ? (
          <View>
            <EmptyState icon="📈">Play your first round to see your progress here.</EmptyState>
            <Button title="Start playing" style={s.center} onPress={() => router.navigate('/home')} />
          </View>
        ) : (
          <>
            <View style={s.statRow}>
              <Stat value={String(data.roundsPlayed)} label="Rounds" />
              <Stat value={`${data.accuracy}%`} label="Accuracy" />
              <Stat value={num(data.totalPoints)} label="Points" />
            </View>

            <SectionTitle title="Accuracy by subject" style={s.firstSection} />
            <Card>
              {data.perCategory.map((row, i) => (
                <CategoryLine
                  key={row.category.id}
                  category={row.category}
                  first={i === 0}
                  right={<Text style={s.value}>{row.accuracy}%</Text>}
                >
                  <Text style={s.lineTitle} numberOfLines={1}>
                    {row.category.name}
                  </Text>
                  <View style={s.meter}>
                    <View
                      style={[
                        s.meterFill,
                        { width: `${row.accuracy}%`, backgroundColor: row.category.color },
                      ]}
                    />
                  </View>
                </CategoryLine>
              ))}
            </Card>

            <SectionTitle title="Topics to review" />
            <Card>
              {data.topicsToReview.length ? (
                data.topicsToReview.map((topic, i) => (
                  <CategoryLine
                    key={`${topic.category.id}|${topic.topic}`}
                    category={topic.category}
                    first={i === 0}
                    right={
                      <Button
                        title="Practice"
                        variant="ghost"
                        small
                        onPress={() =>
                          router.navigate({
                            pathname: '/home',
                            params: { cat: topic.category.id },
                          })
                        }
                      />
                    }
                  >
                    <Text style={s.lineTitle} numberOfLines={1}>
                      {topic.topic}
                    </Text>
                    <Text style={s.small}>
                      {topic.category.name} · missed {topic.wrong} of {topic.attempts}
                    </Text>
                  </CategoryLine>
                ))
              ) : (
                <Text style={[s.small, s.allGood]}>No missed topics. Amazing! 🎯</Text>
              )}
            </Card>

            <SectionTitle title="Score history" />
            <Card style={s.historyCard}>
              {data.history.map((round, i) => (
                <HistoryRow key={round.id} round={round} first={i === 0} />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
  center: { alignSelf: 'center' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  firstSection: { marginTop: 4 },
  historyCard: { paddingVertical: 4, paddingHorizontal: 14 },
  lineTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  value: { width: 42, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.ink },
  meter: {
    marginTop: 5,
    height: 7,
    backgroundColor: colors.meter,
    borderRadius: 9,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 9 },
  small: { fontSize: 13, color: colors.muted },
  allGood: { paddingVertical: 8 },
});
