/**
 * API client for the GuessUp Android app.
 *
 * The base URL is read at runtime from device storage, NOT baked into the
 * build, so the same APK can point at:
 *   - a laptop running the API on the same Wi-Fi  (http://192.168.x.x:3000/api)
 *   - the Android emulator's host machine          (http://10.0.2.2:3000/api)
 *   - the deployed Render API                      (https://...onrender.com/api)
 * Change it on the app's settings screen; no rebuild needed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { type AxiosInstance } from 'axios';

const STORAGE_KEY = 'guessup_api_url';

/** Used until the student saves their own address. */
export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api';

export const api: AxiosInstance = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 60000, // the Render free tier can take ~50s to wake from sleep
  headers: { 'Content-Type': 'application/json' },
});

/** Read the saved address (falls back to the default). */
export async function getApiUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

/** Save the address and apply it to the client right away. */
export async function setApiUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  api.defaults.baseURL = clean;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // Storage unavailable: the address still applies for this session.
  }
}

/** Call once at startup so the saved address is used. */
export async function loadApiUrl(): Promise<string> {
  const url = await getApiUrl();
  api.defaults.baseURL = url;
  return url;
}

export interface HealthResponse {
  status: string;
  time: string;
  db: 'up' | 'down';
}

/** GET /health — also wakes a sleeping Render free-tier server. */
export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

/**
 * Attach the JWT issued at login to every request (used from step 2).
 * export function setAuthToken(token: string | null) { ... }
 */
export function setAuthToken(token: string | null): void {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
