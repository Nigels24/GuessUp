"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LEVELS, SESSION_STATUS, type Difficulty, type SessionStatus } from "@/lib/game";
import { initials } from "@/lib/format";
import type { CategoryRef } from "@/lib/types";

/* ---------- pills (the prototype's catPill, levelPill, accPill) ---------- */

export function CatPill({ category }: { category: CategoryRef | null | undefined }) {
  if (!category) return <span className="pill pill-gray">—</span>;
  return (
    <span className="pill" style={{ background: `${category.color}1f`, color: category.color }}>
      {category.icon} {category.name}
    </span>
  );
}

export function LevelPill({ level }: { level: Difficulty }) {
  const l = LEVELS[level];
  return (
    <span className="pill" style={{ background: `${l.color}22`, color: l.color }}>
      {l.label}
    </span>
  );
}

export function AccPill({ value }: { value: number }) {
  return <span className={`pill ${value >= 75 ? "pill-ok" : value >= 50 ? "pill-warn" : "pill-bad"}`}>{value}%</span>;
}

export function StatusPill({ status }: { status: SessionStatus }) {
  const s = SESSION_STATUS[status];
  return <span className={`pill ${s.pill}`}>{s.label}</span>;
}

/* ---------- small building blocks ---------- */

export function Avatar({ name, inactive = false }: { name: string; inactive?: boolean }) {
  return (
    <span className="avatar" style={inactive ? { background: "#94A3B8" } : undefined}>
      {initials(name)}
    </span>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="e-ic">{icon}</span>
      {children}
    </div>
  );
}

export function Kpi({ icon, bg, value, label }: { icon: string; bg: string; value: ReactNode; label: ReactNode }) {
  return (
    <div className="kpi">
      <span className="k-ic" style={{ background: bg }}>
        {icon}
      </span>
      <div>
        <b>{value}</b>
        <span className="l">{label}</span>
      </div>
    </div>
  );
}

/** Horizontal bars (the prototype's `bars`). `pct` is 0–100. */
export function Bars({ rows }: { rows: { key: string; label: ReactNode; title?: string; pct: number; value: ReactNode; color?: string }[] }) {
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <span className="lbl" title={r.title}>
            {r.label}
          </span>
          <div className="bar-track">
            <i style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, background: r.color || "var(--brand)" }} />
          </div>
          <span className="v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Vertical columns (the prototype's "Rounds per day"). */
export function Cols({ rows }: { rows: { key: string; label: string; value: number; title?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="cols" style={rows.length > 31 ? { gap: 2 } : undefined}>
      {rows.map((r) => (
        <div className="col" key={r.key} title={r.title}>
          <em>{r.value || ""}</em>
          <i style={{ height: (r.value / max) * 120 }} />
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** "Showing 1–15 of 105 items · page 1 of 7" with Prev / Next. */
export function Pager({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="toolbar-foot">
      <span className="muted small">
        Showing {first}–{last} of {total} {noun} · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Prev
        </button>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

/** A table body row that spans every column (loading, error, empty). */
export function WideRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols}>{children}</td>
    </tr>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty">
      <span className="e-ic">⚠️</span>
      {message}
      <div className="mt-3">
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

/* ---------- modal ---------- */

export function Modal({
  title,
  size,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  size?: "sm" | "lg";
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? `modal-${size}` : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- confirm + toast (the prototype's GU.ui.confirm / GU.ui.toast) ---------- */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  okText?: string;
  danger?: boolean;
}

interface Feedback {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Shows a message box with only an OK button (e.g. "Cannot delete category"). */
  alert: (title: string, message: ReactNode) => Promise<void>;
  toast: (message: string, type?: "ok" | "error") => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { alertOnly?: boolean; resolve: (ok: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "ok" | "error" }[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })),
    [],
  );
  const alert = useCallback(
    (title: string, message: ReactNode) =>
      new Promise<void>((resolve) => setDialog({ title, message, okText: "OK", alertOnly: true, resolve: () => resolve() })),
    [],
  );
  const toast = useCallback((message: string, type: "ok" | "error" = "ok") => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), type === "error" ? 4500 : 2800);
  }, []);

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, alert, toast }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          size="sm"
          onClose={() => close(false)}
          footer={
            <>
              {!dialog.alertOnly && (
                <button className="btn btn-ghost" onClick={() => close(false)}>
                  Cancel
                </button>
              )}
              <button className={`btn ${dialog.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} autoFocus>
                {dialog.okText ?? "Confirm"}
              </button>
            </>
          }
        >
          <div className="text-ink-2">{dialog.message}</div>
        </Modal>
      )}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
