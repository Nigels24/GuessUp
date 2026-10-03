/** The prototype's year level choice: four options, two per row (register and Edit profile). */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { YEAR_LEVELS, type YearLevel } from '../lib/auth';
import { colors } from '../theme';
import { styles as ui } from './ui';

export function YearLevelPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: YearLevel | '';
  onChange: (level: YearLevel) => void;
  disabled?: boolean;
}) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>Year level</Text>
      <View style={s.years} accessibilityRole="radiogroup">
        {YEAR_LEVELS.map((level) => {
          const selected = level === value;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              style={[s.year, selected && s.yearSelected]}
            >
              <Text style={[s.yearText, selected && s.yearTextSelected]}>{level}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  year: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  yearSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  yearText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  yearTextSelected: { color: colors.brandDark, fontWeight: '800' },
});
