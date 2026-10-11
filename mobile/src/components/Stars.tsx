/**
 * A round's stars (0–3): filled gold, empty gray. `animate` pops them in one
 * after another (the Result screen); reduce-motion shows them at once.
 * The number comes from the server (api/src/common/stars.ts).
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { starSlots, starsA11y } from '../lib/stars';
import { colors } from '../theme';
import { StarPop } from './motion';

/** Gap between two stars popping in, in ms. */
const STEP_MS = 260;

export function Stars({
  stars,
  size = 13,
  animate = false,
  delay = 0,
  style,
}: {
  /** null = never played (all empty). */
  stars: number | null | undefined;
  size?: number;
  animate?: boolean;
  /** Before the first star pops in, in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const glyph = (filled: boolean) => (
    <Text style={[s.star, { fontSize: size, lineHeight: size * 1.2 }, filled ? s.filled : s.empty]}>★</Text>
  );
  return (
    <View
      style={[s.row, { gap: Math.max(1, size * 0.12) }, style]}
      accessible
      accessibilityLabel={starsA11y(stars)}
    >
      {starSlots(stars).map((filled, i) =>
        animate ? (
          <StarPop key={i} delay={delay + i * STEP_MS}>
            {glyph(filled)}
          </StarPop>
        ) : (
          <View key={i}>{glyph(filled)}</View>
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { fontWeight: '800', includeFontPadding: false },
  filled: { color: '#F59E0B' },
  empty: { color: colors.track },
});
