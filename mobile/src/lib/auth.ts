/**
 * Student session for the GuessUp Android app.
 *
 * The access token is kept in expo-secure-store (the Android Keystore), not in
 * AsyncStorage, and is never logged. setAuthToken() applies it to the API
 * client on startup and right after login or registration.
 */
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from './api';

const TOKEN_KEY = 'guessup_token';
const USER_KEY = 'guessup_user';

export const ADMIN_REFUSED_MESSAGE =
  'Administrator accounts sign in through the Admin Panel.';

export const YEAR_LEVELS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
] as const;
export type YearLevel = (typeof YEAR_LEVELS)[number];

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
  yearLevel: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Session {
  token: string;
  user: User;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  yearLevel: YearLevel;
}

/** Read the saved session and apply its token. Null when signed out. */
export async function restoreSession(): Promise<Session | null> {
  try {
    const [token, user] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!token || !user) return null;
    setAuthToken(token);
    return { token, user: JSON.parse(user) as User };
  } catch {
    return null;
  }
}

async function saveSession(session: Session): Promise<void> {
  setAuthToken(session.token);
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function clearSession(): Promise<void> {
  setAuthToken(null);
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]).catch(() => undefined);
}

/** POST /auth/login. Only STUDENT accounts may sign in to the app. */
export async function login(email: string, password: string): Promise<Session> {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  if (data.user.role !== 'STUDENT') throw new Error(ADMIN_REFUSED_MESSAGE);
  const session = { token: data.accessToken, user: data.user };
  await saveSession(session);
  return session;
}

/** POST /auth/register. The server always creates a STUDENT account. */
export async function register(input: RegisterInput): Promise<Session> {
  const { data } = await api.post<AuthResponse>('/auth/register', input);
  const session = { token: data.accessToken, user: data.user };
  await saveSession(session);
  return session;
}

/** GET /auth/me: the account as the server sees it now. */
export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

/** Keep the saved copy of the user in step after a profile change. */
export async function saveUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => undefined);
}

/** PATCH /me: the prototype's Edit profile. Returns the updated user. */
export async function updateProfile(input: {
  fullName: string;
  yearLevel: YearLevel;
}): Promise<User> {
  const { data } = await api.patch<User>('/me', input);
  return data;
}

/** POST /me/password. A wrong current password is a 400 with the prototype's message. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/me/password', { currentPassword, newPassword });
}
