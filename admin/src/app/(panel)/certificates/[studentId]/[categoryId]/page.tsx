"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadError } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { longDate } from "@/lib/format";
import { LEVELS } from "@/lib/game";
import type { CertificateDetail } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

const SCHOOL = "J.H. Cerilles State College – Dumingag Campus";
const DEFAULT_TITLE = "Administrator";
/** The last "Prepared by" values typed in this browser, per administrator. */
const PREPARED_BY_KEY = "guessup.cert.preparedBy";

interface PreparedBy {
  name: string;
  title: string;
}

function loadPreparedBy(userId: string): PreparedBy | null {
  try {
    const saved = JSON.parse(localStorage.getItem(`${PREPARED_BY_KEY}.${userId}`) ?? "null") as Partial<PreparedBy> | null;
    if (saved && typeof saved.name === "string" && typeof saved.title === "string") return { name: saved.name, title: saved.title };
  } catch {
    // Private window or bad JSON: use the defaults.
  }
  return null;
}

function savePreparedBy(userId: string, value: PreparedBy | null) {
  try {
    const key = `${PREPARED_BY_KEY}.${userId}`;
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // Not saved; the values still apply to this certificate.
  }
}

/**
 * The printable Certificate of Completion (panel revision): one A4 landscape
 * page. "Prepared by" defaults to the signed-in administrator's name (My account)
 * and "Administrator"; both can be edited before printing and are remembered in
 * this browser.
 * On paper only the certificate prints; the sidebar, header and buttons are hidden
 * (so the sheet uses no <header>/<footer> elements, which the print CSS hides).
 */
export default function CertificatePage({ params }: { params: { studentId: string; categoryId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const { studentId, categoryId } = params;
  const { data: c, error, reload } = useLoad(
    () => apiFetch<CertificateDetail>(`/admin/certificates/${encodeURIComponent(studentId)}/${encodeURIComponent(categoryId)}`),
    [studentId, categoryId],
  );
  const userId = user?.id ?? "";
  const defaults: PreparedBy = { name: user?.fullName ?? "", title: DEFAULT_TITLE };
  const [preparedBy, setPreparedBy] = useState<PreparedBy | null>(null);

  // Restore the last values typed in this browser (after mount: localStorage is client-only).
  useEffect(() => {
    if (userId) setPreparedBy(loadPreparedBy(userId));
  }, [userId]);

  const signer = preparedBy ?? defaults;
  function edit(change: Partial<PreparedBy>) {
    const value = { ...signer, ...change };
    setPreparedBy(value);
    savePreparedBy(userId, value);
  }
  function reset() {
    setPreparedBy(null);
    savePreparedBy(userId, null);
  }

  return (
    <>
      {/* Only while this page is open: a borderless A4 landscape sheet. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } }`}</style>
      <div className="page-head no-print">
        <div>
          <h2>Certificate of completion</h2>
          <p>Check the details, then print. Use A4 paper, landscape.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => router.back()}>
            ← Back
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!c}>
            🖨 Print
          </button>
        </div>
      </div>

      <div className="panel cert-signer no-print">
        <div className="field">
          <label htmlFor="cert-signer-name">Prepared by — name</label>
          <input
            className="input"
            id="cert-signer-name"
            value={signer.name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => edit({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="cert-signer-title">Title</label>
          <input
            className="input"
            id="cert-signer-title"
            value={signer.title}
            maxLength={60}
            autoComplete="off"
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <button type="button" className="cert-signer-reset" onClick={reset} disabled={!preparedBy}>
          Reset to my account name
        </button>
      </div>

      {error ? (
        <div className="panel">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : !c ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="cert-scroll">
          <article className="cert">
            <div className="cert-frame">
              <div className="cert-top">
                <p className="cert-school">{SCHOOL}</p>
                <p className="cert-program">Bachelor of Science in Information Technology</p>
              </div>

              <h1 className="cert-title">Certificate of Completion</h1>

              <p className="cert-line">This certifies that</p>
              <p className="cert-name">{c.student.fullName}</p>
              <p className="cert-line cert-body">
                has completed all levels of <b>{c.category.name}</b> in GuessUp, an Android-based gamified guessing game for
                Information Technology students.
              </p>

              <div className="cert-levels">
                {c.levels.map((l) => (
                  <div key={l.difficulty} className="cert-level">
                    <span className="cert-level-name">{LEVELS[l.difficulty].label}</span>
                    <span className="cert-level-score">
                      {l.correctCount}/{l.totalItems}
                    </span>
                    <span className="cert-stars" aria-label={`${l.stars} of 3 stars`}>
                      {[0, 1, 2].map((i) => (
                        <i key={i} className={i < l.stars ? "on" : undefined}>
                          ★
                        </i>
                      ))}
                    </span>
                    <span className="cert-level-pts">best round · {l.totalScore} pts</span>
                  </div>
                ))}
              </div>

              <div className="cert-foot">
                <div className="cert-date">
                  <span className="cert-label">Date completed</span>
                  <b>{longDate(c.completedAt)}</b>
                </div>
                {/* Signature over printed name: the signature goes in the space above the underlined name. */}
                <div className="cert-sign">
                  <span className="cert-label">Prepared by:</span>
                  <span className="cert-sign-space" />
                  {/* Kept when empty: the underline stays for a handwritten name. */}
                  <b className="cert-sign-name">{signer.name.trim() || "\u00a0"}</b>
                  {signer.title.trim() && <span className="cert-sign-title">{signer.title.trim()}</span>}
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
