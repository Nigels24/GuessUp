/** Student login, matching the prototype's #/s/login screen. */
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStyles as s } from '../../src/components/authStyles';
import {
  DemoChip,
  ErrorText,
  Field,
  LogoMark,
  PasswordField,
  PrimaryButton,
} from '../../src/components/ui';
import { apiErrorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';

const DEMO = { email: 'student@jhcsc.edu.ph', password: 'student123' };

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password)
      return setError('Enter your email and password.');
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // The root layout switches to Home once the session is set.
    } catch (err) {
      setError(apiErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={s.gear}
          onPress={() => router.push('/settings-api')}
          accessibilityRole="button"
          accessibilityLabel="API settings"
          hitSlop={8}
        >
          <Text style={s.gearText}>⚙</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={s.screen}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.hero}>
            <LogoMark />
            <Text style={s.title}>GuessUp</Text>
            <Text style={s.tagline}>Guess it. Learn it. Own it.</Text>
          </View>

          <View style={s.card}>
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@jhcsc.edu.ph"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
            />
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void submit()}
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton
              title="Log in"
              loadingTitle="Logging in…"
              loading={loading}
              onPress={() => void submit()}
            />
            <DemoChip
              email={DEMO.email}
              password={DEMO.password}
              onPress={() => {
                setEmail(DEMO.email);
                setPassword(DEMO.password);
              }}
            />
          </View>

          <Text style={s.alt}>
            New here?{' '}
            <Link href="/register" style={s.altLink}>
              Create an account
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
