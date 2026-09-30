import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';

/** The app opens on Home when a session is saved, otherwise on Login. */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/home' : '/login'} />;
}
