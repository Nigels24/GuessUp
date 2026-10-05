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
  /** Profile photo; null shows the initials. */
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Every validation message the server sent (a form shows them all). */
    readonly messages: string[] = [message],
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
  /** JSON-encoded, or sent as is when it is FormData (file uploads). */
  body?: unknown;
  /** Send the stored token (default true). Login and health checks pass false. */
  auth?: boolean;
}

/** The raw response of a successful request; errors become ApiError. */
async function send(path: string, options: RequestOptions, accept: string): Promise<Response> {
  const { method = "GET", body, auth = true } = options;
  const token = auth ? currentToken() : null;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = { Accept: accept };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
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

  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 401 && token) {
      clearSession();
      onSignedOut();
    }
    const messages = errorMessages(data, res.status);
    throw new ApiError(messages[0]!, res.status, messages);
  }
  return res;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options, "application/json");
  return (res.status === 204 ? null : await res.json().catch(() => null)) as T;
}

/**
 * Downloads a file (the reports' CSV export) with the administrator's token
 * and saves it under the name the server gives, or `fallbackName`.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const res = await send(path, {}, "text/csv, */*");
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

/** Question images: seeded ones are served by the API (/static/...), uploads are full URLs. */
export function assetUrl(url: string): string {
  return url.startsWith("/") ? `${API_URL.replace(/\/api$/, "")}${url}` : url;
}

/** Nest sends `message` as a string, or as a list of validation messages. */
function errorMessages(data: unknown, status: number): string[] {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) {
    const texts = message.filter((m): m is string => typeof m === "string");
    if (texts.length) return texts;
  }
  if (typeof message === "string") return [message];
  if (status === 429) return ["Too many attempts. Please wait a minute and try again."];
  if (status === 413) return ["The image must be 2 MB or smaller."];
  return [`Request failed (${status}).`];
}
