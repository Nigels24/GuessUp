/** Student registration, matching the prototype's #/s/register screen. */
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStyles as login } from '../../src/components/authStyles';
import {
  ErrorText,
  Field,
  PasswordField,
  PrimaryButton,
  styles as ui,
} from '../../src/components/ui';
import { apiErrorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { YEAR_LEVELS, type YearLevel } from '../../src/lib/auth';
import { colors } from '../../src/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [yearLevel, setYearLevel] = useState<YearLevel | ''>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const name = fullName.trim();
    const mail = email.trim();
    // Same checks and wording as the prototype.
    if (!name || !mail || !yearLevel || !password)
      return setError('Please fill in all fields.');
    if (!EMAIL_PATTERN.test(mail))
      return setError('Enter a valid email address.');
    if (password.length < 8)
      return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    // Server limits, checked here so the student sees a friendly message.
    if (name.length < 2 || name.length > 80)
      return setError('Full name must be 2 to 80 characters.');

    setError('');
    setLoading(true);
    try {
      await register({ fullName: name, email: mail, yearLevel, password });
      // The root layout switches to Home once the session is set.
    } catch (err) {
      setError(apiErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={login.safe}>
      <KeyboardAvoidingView
        style={login.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={login.screen}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.topbar}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/login')
              }
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={s.back}
            >
              <Text style={s.backText}>←</Text>
            </Pressable>
            <Text style={s.heading}>Create account</Text>
          </View>

          <View style={login.card}>
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              textContentType="name"
            />
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@jhcsc.edu.ph"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            <View style={ui.field}>
              <Text style={ui.label}>Year level</Text>
              <View style={s.years} accessibilityRole="radiogroup">
                {YEAR_LEVELS.map((level) => {
                  const selected = level === yearLevel;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setYearLevel(level)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[s.year, selected && s.yearSelected]}
                    >
                      <Text
                        style={[s.yearText, selected && s.yearTextSelected]}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PasswordField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={() => void submit()}
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton
              title="Create account"
              loadingTitle="Creating account…"
              loading={loading}
              onPress={() => void submit()}
            />
          </View>

          <Text style={login.alt}>
            Already have an account?{' '}
            <Link href="/login" replace style={login.altLink}>
              Log in
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, color: colors.ink2 },
  heading: { flex: 1, fontSize: 24, fontWeight: '800', color: colors.ink },
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
