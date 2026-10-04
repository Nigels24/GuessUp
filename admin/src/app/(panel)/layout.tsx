"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminShell } from "@/components/AdminShell";
import { FeedbackProvider } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

/** Every page in this group requires a signed-in administrator. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token, ready, logout } = useAuth();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  if (!ready || !token || !user) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  }
  return (
    <FeedbackProvider>
      <AdminShell user={user} onLogout={logout}>
        {children}
      </AdminShell>
    </FeedbackProvider>
  );
}
