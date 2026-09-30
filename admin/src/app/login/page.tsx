"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

const SCHOOL = "J.H. Cerilles State College – Dumingag Campus";
const DEMO = { email: "admin@jhcsc.edu.ph", password: "admin123" };

/** Admin login, matching the prototype's #/a/login screen. */
export default function LoginPage() {
  const router = useRouter();
  const { token, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (ready && token) router.replace("/dashboard");
  }, [ready, token, router]);

  // A sleeping Render free-tier server takes up to ~50s to answer the first request.
  useEffect(() => {
    if (!loading) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 min-[861px]:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[linear-gradient(160deg,#5B3BE8,#1B1442)] p-12 text-white min-[861px]:flex">
        <div className="flex items-center gap-3.5">
          <div className="logo-mark">?</div>
          <div>
            <b className="font-display text-2xl">GuessUp</b>
            <div className="text-[13px] font-bold opacity-75">Administrator Panel</div>
          </div>
        </div>
        <div>
          <h2 className="mt-[30px] text-4xl leading-[1.15]">
            Build the question bank.
            <br />
            See what students miss.
            <br />
            Reteach where it counts.
          </h2>
          <p className="mt-3.5 max-w-[420px] opacity-80">
            Manage categories and question items, monitor game sessions, and generate performance
            reports for the BSIT program.
          </p>
        </div>
        <p className="text-[13px] opacity-60">{SCHOOL}</p>
      </div>

      <div className="grid place-items-center bg-white px-4 py-8">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[28px]">Welcome back</h1>
          <p className="mb-[22px] mt-1 text-muted">Sign in with an administrator account.</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="em">Email address</label>
              <input
                className="input"
                id="em"
                type="email"
                autoComplete="username"
                placeholder="admin@jhcsc.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input
                className="input"
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="error-text" role="alert">
              {error}
            </div>
            <button className="btn btn-primary mt-1 w-full" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            {slow && (
              <p className="mt-2 text-center text-xs text-muted">
                Waking up the server — the first sign-in can take up to a minute.
              </p>
            )}
          </form>
          <button
            type="button"
            className="demo-chip"
            onClick={() => {
              setEmail(DEMO.email);
              setPassword(DEMO.password);
            }}
          >
            🧪 <b>Demo:</b> {DEMO.email} / {DEMO.password}{" "}
            <span className="text-muted">(click to fill)</span>
          </button>
          <p className="mt-4 text-center text-sm">
            <Link href="/status" className="font-extrabold text-brand no-underline">
              Check API connection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
