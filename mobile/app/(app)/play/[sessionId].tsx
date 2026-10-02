/**
 * Play screen stub (step 3B part 2a). Part 2b builds the real screen.
 *
 * Note for 2b: POST /game/sessions already served item 1 and started its
 * clock, so on first entry the screen must not call GET /current blindly
 * (it would work, but the clock is already running); GET /current is for
 * "Next question" and for coming back to a round after a restart.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../../src/components/ui';
import { colors } from '../../../src/theme';

export default function PlayScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.title}>Round {sessionId}</Text>
        <View style={s.back}>
          <PrimaryButton
            title="Back"
            loadingTitle="Back"
            loading={false}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  back: { marginTop: 24, alignSelf: 'stretch' },
});
