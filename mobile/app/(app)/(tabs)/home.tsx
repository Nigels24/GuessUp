/**
 * Home (the prototype's #/s/home): greeting, the "Ready to guess?" card with
 * the student's totals, the subject categories and the latest rounds.
 * Tapping a category opens the level picker; tapping a recent round opens
 * its result. Data reloads whenever the tab
 * comes into focus (e.g. back from a round) and on pull to refresh.
 * `?cat=<id>` (the prototype's #/s/home?cat=, used by "Play now" and
 * "Practice" on other tabs) opens the level picker for that category.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomNavSpace } from '../../../src/components/BottomNav';
import { LevelSheet } from '../../../src/components/LevelSheet';
import { HistoryRow } from '../../../src/components/rows';
import {
  Avatar,
  ErrorText,
  ErrorView,
  LoadingView,
  showToast,
} from '../../../src/components/ui';
import { apiErrorMessage } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { count, greeting, num, tint } from '../../../src/lib/format';
import {
  fetchCategories,
  fetchHistory,
  fetchSummary,
  type Category,
  type HistoryEntry,
  type MeSummary,
} from '../../../src/lib/game';
import { colors } from '../../../src/theme';

/** Rounds listed under "Recent rounds", as in the prototype. */
const RECENT_COUNT = 3;

interface HomeData {
  categories: Category[];
  summary: MeSummary;
  history: HistoryEntry[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navSpace = useBottomNavSpace();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetCategory, setSheetCategory] = useState<Category | null>(null);
  const latest = useRef(0);
  const { cat } = useLocalSearchParams<{ cat?: string }>();

  const load = useCallback(async (mode: 'quiet' | 'refresh') => {
    const id = ++latest.current;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      const [categories, summary, history] = await Promise.all([
        fetchCategories(),
        fetchSummary(),
        fetchHistory(RECENT_COUNT),
      ]);
      if (id !== latest.current) return; // a newer load is under way
      setData({ categories, summary, history });
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

  const openCategory = useCallback((category: Category) => {
    if (!category.activeQuestionCount) {
      showToast('No questions in this category yet.');
      return;
    }
    setSheetCategory(category);
  }, []);

  // Opened with ?cat=: show that category's level picker once, then forget the param.
  useEffect(() => {
    if (!cat || !data) return;
    const category = data.categories.find((c) => c.id === cat);
    router.setParams({ cat: undefined });
    if (category) openCategory(category);
  }, [cat, data, openCategory]);

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

  const { categories, summary, history } = data;
  const firstName = user?.fullName.split(/\s+/)[0] ?? '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.screen, { paddingBottom: navSpace }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      >
        <View style={s.hello}>
          <View style={s.helloText}>
            <Text style={s.greet}>{greeting()} 👋</Text>
            <Text style={s.name} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.navigate('/profile')}
          >
            <Avatar name={user?.fullName} uri={user?.avatarUrl} />
          </Pressable>
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}

        <LinearGradient
          colors={[colors.brand, HERO_TO]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroMark}>?</Text>
          <Text style={s.heroTitle}>Ready to guess?</Text>
          <Text style={s.heroSub}>Pick a subject, choose a level, and beat the timer.</Text>
          <View style={s.heroStats}>
            <HeroStat value={num(summary.totalPoints)} label="Total points" />
            <HeroStat value={String(summary.roundsPlayed)} label="Rounds" />
            <HeroStat
              value={`${summary.badges.length}/${summary.allBadges.length}`}
              label="Badges"
            />
          </View>
        </LinearGradient>

        <View style={s.sectionTitle}>
          <Text style={s.sectionHeading}>Subject categories</Text>
          <Text style={s.sectionMeta}>{count(categories.length, 'subject')}</Text>
        </View>
        <View style={s.grid}>
          {categories.map((category) => {
            const stats = summary.perCategory.find((p) => p.categoryId === category.id);
            return (
              <CategoryCard
                key={category.id}
                category={category}
                rounds={stats?.roundsPlayed ?? 0}
                accuracy={stats?.accuracy ?? 0}
                onPress={() => openCategory(category)}
              />
            );
          })}
        </View>

        {history.length ? (
          <>
            <View style={s.sectionTitle}>
              <Text style={s.sectionHeading}>Recent rounds</Text>
              <Pressable onPress={() => router.navigate('/progress')} hitSlop={8}>
                <Text style={s.link}>See all</Text>
              </Pressable>
            </View>
            <View style={s.card}>
              {history.slice(0, RECENT_COUNT).map((round, i) => (
                <HistoryRow key={round.id} round={round} first={i === 0} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <LevelSheet
        category={sheetCategory}
        onClose={() => setSheetCategory(null)}
        onStarted={(round) => {
          setSheetCategory(null);
          router.push({
            pathname: '/play/[sessionId]',
            params: { sessionId: round.sessionId },
          });
        }}
      />
    </SafeAreaView>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.heroStat}>
      <Text style={s.heroStatValue}>{value}</Text>
      <Text style={s.heroStatLabel}>{label}</Text>
    </View>
  );
}

function CategoryCard({
  category,
  rounds,
  accuracy,
  onPress,
}: {
  category: Category;
  rounds: number;
  accuracy: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.catCard, pressed && s.pressed]}
    >
      <View style={[s.catIcon, { backgroundColor: tint(category.color, '1f') }]}>
        <Text style={s.catIconText}>{category.icon}</Text>
      </View>
      <Text style={s.catName}>{category.name}</Text>
      <Text style={s.catMeta}>
        {rounds
          ? `${count(rounds, 'round')} · ${accuracy}% accuracy`
          : `${count(category.activeQuestionCount, 'item')} · not played yet`}
      </Text>
      <View style={s.meter}>
        <View style={[s.meterFill, { width: `${accuracy}%`, backgroundColor: category.color }]} />
      </View>
    </Pressable>
  );
}

const cardShadow = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** The prototype's .hero-card gradient: #6C4CF1 → #9B6BFF at 135°. */
const HERO_TO = '#9B6BFF';

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
  hello: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 16,
  },
  helloText: { flex: 1, marginRight: 12 },
  greet: { color: colors.muted, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink },
  hero: {
    // Under the 135° gradient, so Android's elevation shadow has a surface.
    backgroundColor: colors.brand,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroMark: {
    position: 'absolute',
    right: -8,
    bottom: -52,
    fontSize: 160,
    fontWeight: '800',
    color: colors.white,
    opacity: 0.13,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  heroSub: { marginTop: 4, fontSize: 14, color: colors.white, opacity: 0.9 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: colors.white },
  heroStatLabel: { fontSize: 11, fontWeight: '700', color: colors.white, opacity: 0.85 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionHeading: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sectionMeta: { fontSize: 13, color: colors.muted },
  link: { fontSize: 13, fontWeight: '800', color: colors.brand },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  catCard: {
    width: '48%',
    minHeight: 138,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 8,
    ...cardShadow,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconText: { fontSize: 24 },
  catName: { fontSize: 14.5, lineHeight: 17, fontWeight: '800', color: colors.ink },
  catMeta: { marginTop: 'auto', fontSize: 11.5, fontWeight: '700', color: colors.muted },
  meter: { height: 7, backgroundColor: colors.meter, borderRadius: 9, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 9 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 14,
    ...cardShadow,
  },
});
