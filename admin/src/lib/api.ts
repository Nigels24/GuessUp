/**
 * Small fetch wrapper for the GuessUp API.
 *
 * - Base URL from NEXT_PUBLIC_API_URL (the only value the panel's bundle holds).
 * - Attaches the administrator's bearer token.
 * - A 401 on an authenticated request means the session is over: the token is
 *   cleared and the user is sent to /login.
 * - 60-second timeout, because the Render free tier can take ~50s to wake up.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api").replace(
  /\/+$/,
  "",
);

const TOKEN_KEY = "guessup_admin_token";
const USER_KEY = "guessup_admin_user";
const TIMEOUT_MS = 60_000;

export type Role = "STUDENT" | "ADMIN";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  yearLevel: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/* ---------- session storage (localStorage, guarded for private windows) ---------- */

export function getStoredSession(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    return token && user ? { token, user: JSON.parse(user) as User } : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage blocked: the session lasts until the tab is closed.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing stored.
  }
}

function currentToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/* ---------- signed-out handling ---------- */

let onSignedOut: () => void = () => {
  window.location.assign("/login");
};

/** AuthProvider replaces the default so it can reset its state and use the router. */
export function setSignedOutHandler(handler: () => void): void {
  onSignedOut = handler;
}

/* ---------- requests ---------- */

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Send the stored token (default true). Login and health checks pass false. */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const token = auth ? currentToken() : null;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(
      error instanceof DOMException && error.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Could not reach the server. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearSession();
      onSignedOut();
    }
    throw new ApiError(errorMessage(data, res.status), res.status);
  }
  return data as T;
}

/** Nest sends `message` as a string, or as a list of validation messages. */
function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  if (typeof message === "string") return message;
  if (status === 429) return "Too many attempts. Please wait a minute and try again.";
  return `Request failed (${status}).`;
}
