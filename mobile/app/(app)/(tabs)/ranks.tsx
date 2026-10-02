/** Ranks tab: placeholder until the Leaderboard screen is built. */
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace } from '../../../src/components/BottomNav';
import { EmptyState, TopBar } from '../../../src/components/ui';
import { colors } from '../../../src/theme';

export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.screen, { paddingBottom: bottomNavSpace(insets.bottom) }]}>
        <TopBar title="Leaderboard" />
        <EmptyState icon="🏆">Coming soon.</EmptyState>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
});
