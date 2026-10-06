/**
 * List rows shared by Home and My Progress: the prototype's .hist-row (a
 * finished round; tapping opens its result) and .cat-line (a category icon
 * tile, a body and a value or button on the right).
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ago, count, tint } from '../lib/format';
import { levelInfo, type CategoryRef, type HistoryEntry } from '../lib/game';
import { colors } from '../theme';

export function HistoryRow({ round, first }: { round: HistoryEntry; first: boolean }) {
  const good = round.accuracy >= 60;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/result/[sessionId]', params: { sessionId: round.id } })
      }
      style={({ pressed }) => [s.histRow, !first && s.divider, pressed && s.pressed]}
    >
      <View style={[s.histIcon, { backgroundColor: tint(round.category.color, '1f') }]}>
        <Text style={s.histIconText}>{round.category.icon}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.histName} numberOfLines={1}>
          {round.category.name}
        </Text>
        <Text style={s.histMeta}>
          {levelInfo(round.difficulty).label} · {ago(round.endedAt)}
        </Text>
      </View>
      <View style={s.histScore}>
        <Text style={s.histPoints}>{count(round.totalScore, 'pt', 'pts')}</Text>
        <Text style={[s.histAccuracy, { color: good ? colors.ok : colors.muted }]}>
          {round.accuracy}%
        </Text>
      </View>
    </Pressable>
  );
}

export function CategoryLine({
  category,
  first,
  children,
  right,
}: {
  category: CategoryRef;
  first: boolean;
  /** The body, beside the icon. */
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={[s.catLine, !first && s.divider]}>
      <View style={[s.catIcon, { backgroundColor: tint(category.color, '1f') }]}>
        <Text style={s.catIconText}>{category.icon}</Text>
      </View>
      <View style={s.body}>{children}</View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { opacity: 0.6 },
  body: { flex: 1, minWidth: 0 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  histIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histIconText: { fontSize: 19 },
  histName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  histMeta: { fontSize: 13, color: colors.muted },
  histScore: { alignItems: 'flex-end' },
  histPoints: { fontWeight: '800', color: colors.brandDark },
  histAccuracy: { fontSize: 13, fontWeight: '800' },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  catIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconText: { fontSize: 17 },
});
