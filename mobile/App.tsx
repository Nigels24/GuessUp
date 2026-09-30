/**
 * GuessUp — starter screen.
 *
 * Step 1 only: set the API address and confirm the phone can reach the server.
 * The game screens (login, home, play, result, leaderboard, progress, profile)
 * follow the approved prototype and are built in later steps.
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { checkHealth, loadApiUrl, setApiUrl } from './src/lib/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; db: string; time: string }
  | { kind: 'error'; message: string };

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    void loadApiUrl().then(setUrl);
  }, []);

  async function test() {
    setStatus({ kind: 'loading' });
    try {
      await setApiUrl(url);
      const health = await checkHealth();
      setStatus({ kind: 'ok', db: health.db, time: health.time });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not reach the server';
      setStatus({ kind: 'error', message });
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.screen}>
        <StatusBar style="light" />

        <View style={styles.logo}>
          <Text style={styles.logoText}>?</Text>
        </View>
        <Text style={styles.title}>GuessUp</Text>
        <Text style={styles.subtitle}>Guess it. Learn it. Own it.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>API address</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:3000/api"
            placeholderTextColor="#9C97C2"
          />
          <Text style={styles.help}>
            Emulator: http://10.0.2.2:3000/api{'\n'}
            Physical phone: your laptop{"'"}s IP, e.g. http://192.168.1.10:3000/api{'\n'}
            Deployed: https://your-api.onrender.com/api
          </Text>

          <TouchableOpacity style={styles.button} onPress={test} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Save and test connection</Text>
          </TouchableOpacity>

          {status.kind === 'loading' && (
            <View style={styles.result}>
              <ActivityIndicator color="#6C4CF1" />
              <Text style={styles.resultText}>
                Contacting the server… (a sleeping free-tier server can take ~50s)
              </Text>
            </View>
          )}
          {status.kind === 'ok' && (
            <View style={[styles.result, styles.resultOk]}>
              <Text style={styles.resultTitle}>Connected</Text>
              <Text style={styles.resultText}>
                Database: {status.db}
                {'\n'}Server time: {new Date(status.time).toLocaleString()}
              </Text>
            </View>
          )}
          {status.kind === 'error' && (
            <View style={[styles.result, styles.resultBad]}>
              <Text style={styles.resultTitle}>Not connected</Text>
              <Text style={styles.resultText}>{status.message}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Android-Based Gamified Guessing Game Application{'\n'}
          J.H. Cerilles State College – Dumingag Campus
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#2E1A8C' },
  screen: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#FFC83D',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  logoText: { fontSize: 38, fontWeight: '800', color: '#1E1847' },
  title: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: { textAlign: 'center', color: '#C9C0F5', marginTop: 2, fontWeight: '600' },
  card: { marginTop: 26, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18 },
  label: { fontWeight: '800', color: '#4B4770', marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderColor: '#E6E3F5',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1E1847',
  },
  help: { marginTop: 8, fontSize: 12, color: '#7C789A', lineHeight: 18 },
  button: {
    marginTop: 16,
    backgroundColor: '#6C4CF1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  result: { marginTop: 16, borderRadius: 14, padding: 12, backgroundColor: '#F6F4FF' },
  resultOk: { backgroundColor: '#DCFCE7' },
  resultBad: { backgroundColor: '#FEE2E2' },
  resultTitle: { fontWeight: '800', color: '#1E1847', marginBottom: 2 },
  resultText: { color: '#4B4770', fontSize: 13, lineHeight: 19 },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    color: '#9C97C2',
    fontSize: 12,
    lineHeight: 18,
  },
});
