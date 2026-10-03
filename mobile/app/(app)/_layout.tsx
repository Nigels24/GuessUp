/**
 * Signed-in screens: the bottom tabs, and the play and result screens above
 * them (no tab bar while a round is being played or reviewed).
 */
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="play/[sessionId]" options={{ gestureEnabled: false }} />
      <Stack.Screen name="result/[sessionId]" />
    </Stack>
  );
}
