/**
 * Leaderboard (the prototype's #/s/leaderboard). Rankings are per subject
 * category only: a chip per category, then the podium (2nd, 1st, 3rd), the
 * student's own row pinned when ranked below 3rd, and the rest of the top 50.
 * The server ranks (points, then accuracy); the app only draws the rows.
 *
 * Opens on `?cat=<id>` (the result screen's "View"), else the category of the
 * student's latest round, else the first category. Reloads on focus and on
 * pull to refresh.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useBottomNavSpace } from '../../../src/components/BottomNav';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorText,
  ErrorView,
  LoadingView,
  TopBar,
} from '../../../src/components/ui';
import { apiErrorMessage } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { num } from '../../../src/lib/format';
import {
  fetchCategories,
  fetchHistory,
  fetchLeaderboard,
  type Category,
  type Leaderboard,
  type RankingRow,
} from '../../../src/lib/game';
import { colors } from '../../../src/theme';

/** The prototype's .pod-1/2/3 bases: gradient and height. */
const PODIUM = {
  1: { colors: colors.gold, height: 96, fontSize: 30 },
  2: { colors: colors.silver, height: 72, fontSize: 24 },
  3: { colors: colors.bronze, height: 56, fontSize: 22 },
} as const;

/** Home with the level picker open on this category (the prototype's #/s/home?cat=). */
const playCategory = (categoryId: string) =>
  router.navigate({ pathname: '/home', params: { cat: categoryId } });

export default function RanksScreen() {
  const { user } = useAuth();
  const navSpace = useBottomNavSpace();
  const { cat } = useLocalSearchParams<{ cat?: string }>();

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [catId, setCatId] = useState<string | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const latest = useRef(0);
  const categoriesRef = useRef<Category[] | null>(null);
  const catIdRef = useRef<string | null>(null);
  /** The ?cat= param was just cleared after use; the effect it re-runs need not load again. */
  const paramCleared = useRef(false);

  // Chip positions, to scroll the active one into view.
  const chipsRef = useRef<ScrollView>(null);
  const chipX = useRef(new Map<string, number>());

  const scrollToChip = useCallback((id: string | null) => {
    const x = id ? chipX.current.get(id) : undefined;
    if (x !== undefined) chipsRef.current?.scrollTo({ x: Math.max(0, x - 60), animated: true });
  }, []);

  /** Loads the board of `wanted` (or the default category), plus the categories if needed. */
  const load = useCallback(
    async (mode: 'quiet' | 'refresh', wanted: string | null) => {
      const id = ++latest.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        let list = categoriesRef.current;
        if (!list || mode === 'refresh') list = await fetchCategories();
        let target = wanted && list.some((c) => c.id === wanted) ? wanted : null;
        if (!target) {
          const [last] = await fetchHistory(1);
          target =
            last && list.some((c) => c.id === last.category.id)
              ? last.category.id
              : (list[0]?.id ?? null);
        }
        const next = target ? await fetchLeaderboard(target) : null;
        if (id !== latest.current) return; // a newer load is under way
        categoriesRef.current = list;
        catIdRef.current = target;
        setCategories(list);
        setCatId(target);
        setBoard(next);
        setError('');
      } catch (e) {
        if (id === latest.current) setError(apiErrorMessage(e));
      } finally {
        if (id === latest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (!cat && paramCleared.current) {
        paramCleared.current = false;
        return;
      }
      void load('quiet', cat ?? catIdRef.current);
      if (cat) {
        paramCleared.current = true;
        router.setParams({ cat: undefined });
      }
    }, [cat, load]),
  );

  function choose(id: string) {
    if (id === catIdRef.current && board) return;
    catIdRef.current = id;
    setCatId(id);
    setBoard(null);
    scrollToChip(id);
    void load('quiet', id);
  }

  if (!categories) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {error && !loading ? (
          <ErrorView message={error} retrying={loading} onRetry={() => void load('quiet', cat ?? null)} />
        ) : (
          <LoadingView />
        )}
      </SafeAreaView>
    );
  }

  const isMe = (row: RankingRow) => row.userId === user?.id;
  // The student's own photo from the signed-in user, so a change shows at once.
  const photoOf = (row: RankingRow) => (isMe(row) ? (user?.avatarUrl ?? null) : row.avatarUrl);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.screen, { paddingBottom: navSpace }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh', catIdRef.current)}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
      >
        <TopBar title="Leaderboard" />
        <Text style={s.lead}>Rankings are per subject, so everyone can shine somewhere.</Text>

        <ScrollView
          ref={chipsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipRow}
        >
          {categories.map((category) => {
            const active = category.id === catId;
            return (
              <Pressable
                key={category.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => choose(category.id)}
                onLayout={(e) => {
                  chipX.current.set(category.id, e.nativeEvent.layout.x);
                  if (active) scrollToChip(category.id);
                }}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {category.icon} {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={s.boardError}>
            <ErrorText>{error}</ErrorText>
            {!board ? (
              <Button
                title="Try again"
                small
                loading={loading}
                onPress={() => void load('quiet', catIdRef.current)}
              />
            ) : null}
          </View>
        ) : null}

        {!board ? (
          !error ? <ActivityIndicator color={colors.brand} style={s.spinner} /> : null
        ) : !board.rows.length ? (
          <View>
            <EmptyState icon="🏁">No one has played this subject yet. Be the first!</EmptyState>
            <Button title="Play now" style={s.center} onPress={() => playCategory(board.category.id)} />
          </View>
        ) : (
          <>
            <View style={s.podium}>
              {[board.rows[1], board.rows[0], board.rows[2]].map((row, i) =>
                row ? (
                  <Pod key={row.userId} row={row} me={isMe(row)} photo={photoOf(row)} />
                ) : (
                  <View key={`empty-${i}`} style={s.flex} />
                ),
              )}
            </View>

            {board.me && board.me.rank > 3 ? (
              <LbRow row={board.me} me pinned name={user?.fullName} photo={photoOf(board.me)} />
            ) : null}

            {board.rows.slice(3).map((row) => (
              <LbRow key={row.userId} row={row} me={isMe(row)} photo={photoOf(row)} />
            ))}

            {!board.me ? (
              <Card style={s.notRanked}>
                <Text style={s.bold}>You're not ranked here yet.</Text>
                <Text style={s.notRankedText}>Finish a round in this subject to join.</Text>
                <Button
                  title="Play this subject"
                  small
                  style={s.center}
                  onPress={() => playCategory(board.category.id)}
                />
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Pod({ row, me, photo }: { row: RankingRow; me: boolean; photo: string | null }) {
  const pod = PODIUM[row.rank as 1 | 2 | 3];
  return (
    <View style={s.pod}>
      <Avatar name={row.fullName} uri={photo} style={[s.podAvatar, me && s.podAvatarMe]} />
      <Text style={s.podName} numberOfLines={2}>
        {row.fullName}
      </Text>
      <Text style={s.podPoints}>{num(row.totalPoints)} pts</Text>
      <View style={[s.base, { height: pod.height }]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`pod${row.rank}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={pod.colors[0]} />
              <Stop offset="1" stopColor={pod.colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#pod${row.rank})`} />
        </Svg>
        <Text style={[s.baseText, { fontSize: pod.fontSize }]}>{row.rank}</Text>
      </View>
    </View>
  );
}

/** The prototype's .lb-row; the student's own row says "You" and is outlined. */
function LbRow({
  row,
  me,
  pinned = false,
  name,
  photo,
}: {
  row: RankingRow;
  me: boolean;
  photo: string | null;
  /** The student's row shown above the list. */
  pinned?: boolean;
  /** The name to take initials from (the signed-in student's for the pinned row). */
  name?: string;
}) {
  return (
    <View
      style={[s.lbRow, me && s.lbRowMe, pinned && s.lbPinned]}
      accessibilityLabel={`Rank ${row.rank}, ${me ? 'you' : row.fullName}, ${row.totalPoints} points`}
    >
      <Text style={s.lbRank}>{row.rank}</Text>
      <Avatar
        name={name ?? row.fullName}
        uri={photo}
        size={38}
        color={me ? colors.brand : colors.lbAvatar}
      />
      <View style={s.lbName}>
        <Text style={s.lbNameText} numberOfLines={1}>
          {me ? 'You' : row.fullName}
        </Text>
        <Text style={s.lbMeta}>
          {row.roundsPlayed} rounds · {row.accuracy}% acc.
        </Text>
      </View>
      <Text style={s.lbPoints}>{num(row.totalPoints)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
  lead: { marginTop: -6, marginBottom: 10, fontSize: 13, fontWeight: '700', color: colors.muted },
  chipScroll: { marginHorizontal: -18, flexGrow: 0 },
  chipRow: { gap: 8, paddingHorizontal: 18, paddingTop: 2, paddingBottom: 10 },
  chip: {
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '800', color: colors.ink2 },
  chipTextActive: { color: colors.white },
  boardError: { marginTop: 8, gap: 8 },
  spinner: { marginTop: 40 },
  center: { alignSelf: 'center' },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  pod: { flex: 1, alignItems: 'center' },
  podAvatar: { marginBottom: 6 },
  // The prototype's 3px accent outline around the student's own avatar.
  podAvatarMe: { borderWidth: 3, borderColor: colors.accent },
  podName: {
    minHeight: 30,
    fontSize: 12.5,
    lineHeight: 15,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  podPoints: { fontSize: 12, fontWeight: '800', color: colors.muted },
  base: {
    alignSelf: 'stretch',
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  baseText: { fontWeight: '800', color: colors.white },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  // The prototype's 3px brand outline; the padding shrinks so the row keeps its size.
  lbRowMe: { borderWidth: 3, borderColor: colors.brand, paddingVertical: 7, paddingHorizontal: 9 },
  lbPinned: { marginBottom: 14 },
  lbRank: { width: 26, fontSize: 17, fontWeight: '800', color: colors.muted, textAlign: 'center' },
  lbName: { flex: 1, minWidth: 0 },
  lbNameText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  lbMeta: { fontSize: 12, fontWeight: '700', color: colors.muted },
  lbPoints: { fontSize: 17, fontWeight: '800', color: colors.brandDark },
  notRanked: { alignItems: 'center', marginTop: 8 },
  notRankedText: { marginTop: 4, marginBottom: 10, fontSize: 13, color: colors.muted },
  bold: { fontWeight: '800', color: colors.ink },
});
