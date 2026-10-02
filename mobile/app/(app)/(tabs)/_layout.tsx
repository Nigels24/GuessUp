/** Bottom tabs: Home, Ranks, Progress, Profile (the prototype's .bottom-nav). */
import { Tabs } from 'expo-router/js-tabs';
import { BottomNav } from '../../../src/components/BottomNav';
import { colors } from '../../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
