"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { User } from "@/lib/api";
import { ACCOUNT_NAV, NAV } from "./nav";

const SCHOOL = "J.H. Cerilles State College – Dumingag Campus";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part) && !part.endsWith("."))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Sidebar and top bar of the prototype's administrator panel. */
export function AdminShell({
  user,
  onLogout,
  children,
}: {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const title = [...NAV, ACCOUNT_NAV].find((n) => pathname.startsWith(n.href))?.label ?? "GuessUp";
  const onAccount = pathname.startsWith(ACCOUNT_NAV.href);

  return (
    <div className="flex min-h-screen bg-panel">
      <aside
        className={`fixed left-0 top-0 z-[100] flex h-screen w-[248px] shrink-0 flex-col bg-sidebar px-3.5 py-5 text-sidebar-text transition-transform min-[861px]:sticky min-[861px]:translate-x-0 ${
          menuOpen ? "translate-x-0 shadow-lg" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-2 pb-[22px] text-white">
          <div className="logo-mark !h-10 !w-10 !rounded-[13px] !text-[22px]">?</div>
          <div>
            <b className="block font-display text-[21px] leading-none">GuessUp</b>
            <small className="text-[11px] font-bold opacity-70">Administrator Panel</small>
          </div>
        </div>
        <nav className="flex flex-col gap-[3px]">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-bold no-underline ${
                  active ? "bg-brand text-white" : "text-sidebar-text hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="w-[22px] text-center">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href={ACCOUNT_NAV.href}
          onClick={() => setMenuOpen(false)}
          className={`mb-3 mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-bold no-underline ${
            onAccount ? "bg-brand text-white" : "text-sidebar-text hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="w-[22px] text-center">{ACCOUNT_NAV.icon}</span>
          {ACCOUNT_NAV.label}
        </Link>
        <div className="border-t border-white/10 px-2 pt-3 text-xs">{SCHOOL}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col" onClick={() => setMenuOpen(false)}>
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3.5 min-[861px]:px-7">
          <button
            className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-2 hover:bg-brand-soft min-[861px]:hidden"
            aria-label="Menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            ☰
          </button>
          <h1 className="flex-1 text-[22px]">{title}</h1>
          <div className="flex items-center gap-2.5 text-[13px]">
            <Link
              href={ACCOUNT_NAV.href}
              title="My account"
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-ink no-underline hover:bg-brand-soft"
            >
              <span className="hidden text-right min-[861px]:inline">
                <b>{user.fullName}</b>
                <br />
                <span className="text-muted">Administrator</span>
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-brand font-display text-[13px] font-extrabold text-white">
                {initials(user.fullName)}
              </span>
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
              Log out
            </button>
          </div>
        </header>
        <main className="px-4 pb-10 pt-6 min-[861px]:px-7">{children}</main>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-[rgba(20,14,60,.45)] p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm rounded-[22px] bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-1.5 pt-[18px]">
              <h3 id="logout-title" className="text-xl">
                Log out?
              </h3>
            </div>
            <p className="px-5 pb-4 pt-2.5 text-ink-2">You will return to the admin login page.</p>
            <div className="flex justify-end gap-2.5 border-t border-line px-5 pb-[18px] pt-3">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={onLogout} autoFocus>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
