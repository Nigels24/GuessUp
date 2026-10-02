/**
 * Profile tab: the prototype's profile header and Log out. Badges and the
 * other account actions come with the full Profile screen.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace } from '../../../src/components/BottomNav';
import { Avatar, Pill } from '../../../src/components/ui';
import { useAuth } from '../../../src/lib/auth-context';
import { colors } from '../../../src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          void logout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[s.screen, { paddingBottom: bottomNavSpace(insets.bottom) }]}
      >
        <View style={s.head}>
          <Avatar name={user?.fullName} size={84} />
          <Text style={s.name}>{user?.fullName}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.pills}>
            <Pill tone="brand">{user?.yearLevel || 'Student'}</Pill>
            <Pill>BSIT</Pill>
          </View>
        </View>

        <Text style={s.sectionHeading}>Account</Text>
        <View style={s.menu}>
          <Pressable
            accessibilityRole="button"
            disabled={leaving}
            onPress={confirmLogout}
            style={({ pressed }) => [s.menuItem, pressed && s.menuPressed]}
          >
            <Text style={s.danger}>🚪 Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { paddingHorizontal: 18, paddingTop: 6 },
  head: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, gap: 2 },
  name: { marginTop: 10, fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  email: { fontSize: 13, fontWeight: '700', color: colors.muted },
  pills: { flexDirection: 'row', gap: 6, marginTop: 8 },
  sectionHeading: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  menu: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuItem: { paddingVertical: 14, paddingHorizontal: 16 },
  menuPressed: { backgroundColor: colors.bg },
  danger: { fontSize: 15, fontWeight: '800', color: colors.bad },
});
