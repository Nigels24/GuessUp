/** Step 2 placeholder: greets the student. The real Home screen comes next step. */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark, PrimaryButton } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth-context';
import { colors } from '../../src/theme';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const firstName = user?.fullName.split(/\s+/)[0] ?? '';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <LogoMark size={56} />
        <Text style={s.hello}>Hi, {firstName}! 👋</Text>
        <Text style={s.sub}>
          {user?.yearLevel ? `${user.yearLevel} · ` : ''}
          {user?.email}
        </Text>
        <Text style={s.note}>
          Categories and games arrive in the next step.
        </Text>
        <View style={s.logout}>
          <PrimaryButton
            title="Log out"
            loadingTitle="Logging out…"
            loading={false}
            onPress={() => void logout()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  hello: { marginTop: 18, fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { marginTop: 4, color: colors.muted, fontWeight: '700' },
  note: { marginTop: 18, color: colors.ink2, textAlign: 'center' },
  logout: { marginTop: 28, alignSelf: 'stretch' },
});
