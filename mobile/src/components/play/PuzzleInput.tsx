/**
 * Word puzzle answer (the prototype's .slots / .tiles): tap a letter tile to
 * put it in the first empty box, tap a box to empty it, Clear empties all.
 * `slots[i]` is the index of the tile placed in box i, or null.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Button } from '../ui';

export function emptySlots(answerLength: number): (number | null)[] {
  return new Array<number | null>(answerLength).fill(null);
}

/** The typed answer: the letters in the boxes, a space between words. */
export function puzzleValue(
  tiles: readonly string[],
  slots: readonly (number | null)[],
  wordLengths: readonly number[],
): string {
  let k = 0;
  return wordLengths
    .map((length) =>
      Array.from({ length }, () => {
        const tile = slots[k++];
        return tile === null || tile === undefined ? '' : tiles[tile];
      }).join(''),
    )
    .join(' ');
}

export function PuzzleInput({
  tiles,
  wordLengths,
  slots,
  onChange,
  disabled,
}: {
  tiles: readonly string[];
  wordLengths: readonly number[];
  slots: readonly (number | null)[];
  onChange: (slots: (number | null)[]) => void;
  disabled: boolean;
}) {
  function place(tile: number) {
    const empty = slots.indexOf(null);
    if (disabled || empty === -1 || slots.includes(tile)) return;
    const next = slots.slice();
    next[empty] = tile;
    onChange(next);
  }

  function remove(slot: number) {
    if (disabled || slots[slot] === null) return;
    const next = slots.slice();
    next[slot] = null;
    onChange(next);
  }

  let k = 0;
  return (
    <View>
      <View style={s.slots}>
        {wordLengths.map((length, w) => (
          <View key={w} style={s.word}>
            {Array.from({ length }, () => {
              const i = k++;
              const tile = slots[i] ?? null;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Letter box ${i + 1}`}
                  onPress={() => remove(i)}
                  style={[s.slot, tile !== null && s.slotFilled]}
                >
                  <Text style={s.letter}>{tile !== null ? tiles[tile] : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={s.tiles}>
        {tiles.map((letter, i) => {
          const used = slots.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Letter ${letter}`}
              disabled={used}
              onPress={() => place(i)}
              style={({ pressed }) => [s.tile, pressed && s.tilePressed, used && s.tileUsed]}
            >
              <Text style={s.letter}>{letter}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.clear}>
        <Button
          title="Clear"
          variant="ghost"
          small
          onPress={() => !disabled && onChange(emptySlots(slots.length))}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 14,
    columnGap: 6,
    marginTop: 16,
    marginBottom: 6,
  },
  word: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  slot: {
    width: 34,
    height: 42,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.slotBorder,
    backgroundColor: colors.slotBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  letter: { fontSize: 20, fontWeight: '800', color: colors.ink },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
  },
  tile: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderBottomWidth: 4,
    borderBottomColor: colors.accentShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePressed: { transform: [{ translateY: 3 }], borderBottomWidth: 0 },
  // Hidden but still taking its place, as the prototype's visibility: hidden.
  tileUsed: { opacity: 0 },
  clear: { alignItems: 'center', marginTop: 10 },
});
