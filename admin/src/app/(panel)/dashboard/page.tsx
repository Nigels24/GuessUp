"use client";

import { useAuth } from "@/lib/auth-context";

/**
 * Step 2: greeting only (Log out is in the top bar, as in the prototype).
 * The prototype's statistics and charts come in a later step.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="panel p-6">
      <p className="text-sm font-bold text-muted">Welcome back,</p>
      <h2 className="text-[26px]">{user.fullName}</h2>
      <p className="mt-1 text-sm text-muted">Signed in as {user.email} · Administrator</p>
    </div>
  );
}
