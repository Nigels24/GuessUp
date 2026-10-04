"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PeriodSelect, periodFor, type Period } from "@/components/PeriodSelect";
import { AccPill, CatPill, Empty, LevelPill, LoadError, Modal, Pager, StatusPill, WideRow } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { dateTime, dur, qs } from "@/lib/format";
import { DIFFICULTIES, LEVELS, SESSION_STATUS, type SessionStatus } from "@/lib/game";
import type { AdminCategory, Page, SessionDetail, SessionRow } from "@/lib/types";
import { useDebounced, useLoad } from "@/lib/use-load";

const PAGE_SIZE = 20;

export default function SessionsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Sessions />
    </Suspense>
  );
}

/** Admin Panel > Game Sessions (the prototype's #/a/sessions). */
function Sessions() {
  const params = useSearchParams();
  const router = useRouter();
  // Set by the student dialog's "Game sessions" link.
  const studentId = params.get("student") ?? "";

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState<Period>(() => periodFor(studentId ? "all" : "30"));
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<string | null>(null);
  const searchText = useDebounced(search.trim());

  const categories = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const list = useLoad(
    () =>
      apiFetch<Page<SessionRow>>(
        `/admin/sessions${qs({
          studentId,
          search: searchText,
          categoryId: cat,
          difficulty: level,
          status,
          from: period.from,
          to: period.to,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
    [studentId, searchText, cat, level, status, period.from, period.to, page],
  );
  const rows = list.data?.items ?? [];
  const studentName = studentId && rows[0]?.user.id === studentId ? rows[0].user.fullName : null;

  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Recorded game sessions</h2>
          <p>Every finished round and every submitted answer is recorded.</p>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar">
          {studentId ? (
            <span className="pill pill-brand !py-1.5 text-[13px]">
              👤 {studentName ?? "One student"}
              <button className="ml-1 font-extrabold" aria-label="Show all students" onClick={() => router.replace("/sessions")}>
                ✕
              </button>
            </span>
          ) : (
            <input className="input search" value={search} onChange={filter(setSearch)} placeholder="🔍 Search student…" aria-label="Search student" />
          )}
          <select className="input" value={cat} onChange={filter(setCat)} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={level} onChange={filter(setLevel)} aria-label="Level">
            <option value="">All levels</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {LEVELS[d].label}
              </option>
            ))}
          </select>
          <select className="input" value={status} onChange={filter(setStatus)} aria-label="Status">
            <option value="">Any status</option>
            {(Object.keys(SESSION_STATUS) as SessionStatus[]).map((s) => (
              <option key={s} value={s}>
                {SESSION_STATUS[s].label}
              </option>
            ))}
          </select>
          <PeriodSelect
            value={period}
            allTime
            onChange={(p) => {
              setPeriod(p);
              setPage(1);
            }}
          />
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Category</th>
                <th>Level</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Time</th>
                <th>Hints</th>
                <th />
              </tr>
            </thead>
            <tbody className={list.loading && list.data ? "opacity-60" : ""}>
              {list.error ? (
                <WideRow cols={10}>
                  <LoadError message={list.error} onRetry={list.reload} />
                </WideRow>
              ) : !list.data ? (
                <WideRow cols={10}>
                  <Empty icon="⏳">Loading sessions…</Empty>
                </WideRow>
              ) : !rows.length ? (
                <WideRow cols={10}>
                  <Empty icon="🎮">No sessions in this period.</Empty>
                </WideRow>
              ) : (
                rows.map((s) => {
                  const done = s.status === "COMPLETED";
                  return (
                    <tr key={s.id}>
                      <td className="small whitespace-nowrap">{dateTime(s.startedAt)}</td>
                      <td>
                        <b>{s.user.fullName}</b>
                        {!done && (
                          <div className="mt-0.5">
                            <StatusPill status={s.status} />
                          </div>
                        )}
                      </td>
                      <td>
                        <CatPill category={s.category} />
                      </td>
                      <td>
                        <LevelPill level={s.difficulty} />
                      </td>
                      <td>
                        <b>{s.totalScore}</b>
                      </td>
                      <td>
                        {done ? s.correctCount : "—"}/{s.totalItems}
                        {!done && <span className="muted small block">{s.answeredCount} answered</span>}
                      </td>
                      <td>{done ? <AccPill value={s.accuracy} /> : "—"}</td>
                      <td className="small">{done ? dur(s.timeSpent) : "—"}</td>
                      <td>{done ? s.hintsUsed : "—"}</td>
                      <td className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewing(s.id)} disabled={!s.answeredCount}>
                          Answers
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} noun="sessions" onPage={setPage} />}
      </div>
      {viewing && <SessionView id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** The prototype's "Session answers" dialog. */
function SessionView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: s, error, reload } = useLoad(() => apiFetch<SessionDetail>(`/admin/sessions/${id}`), [id]);
  return (
    <Modal
      title="Session answers"
      size="lg"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !s ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted -mt-1.5">
            {s.user.fullName} · {s.category.icon} {s.category.name} · {LEVELS[s.difficulty].label} · {dateTime(s.startedAt)} ·{" "}
            <b>{s.totalScore} pts</b>
            {s.status !== "COMPLETED" && (
              <span className="ml-2">
                <StatusPill status={s.status} />
              </span>
            )}
          </p>
          <div className="table-wrap mt-3">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Submitted</th>
                  <th>Result</th>
                  <th>Time</th>
                  <th>Hint</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {s.answers.map((a) => (
                  <tr key={a.index}>
                    <td>{a.index}</td>
                    <td className="q-cell">
                      <b title={a.question.questionText}>{a.question.questionText}</b>
                      <span className="muted small">Answer: {a.question.answer}</span>
                    </td>
                    <td>{a.submitted || "—"}</td>
                    <td>{a.isCorrect ? <span className="pill pill-ok">Correct</span> : <span className="pill pill-bad">Wrong</span>}</td>
                    <td>{a.timeTaken}s</td>
                    <td>{a.hintUsed ? "💡" : "—"}</td>
                    <td>
                      <b>{a.pointsEarned}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
