"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PeriodSelect, periodFor, periodText, type Period } from "@/components/PeriodSelect";
import {
  AccPill,
  Avatar,
  CatPill,
  Empty,
  LevelPill,
  LoadError,
  Modal,
  Pager,
  PrintHeader,
  PrintSheet,
  Stars,
  StatusPill,
  WideRow,
  useFeedback,
} from "@/components/ui";
import { apiDownload, apiFetch } from "@/lib/api";
import { dateTime, dur, qs } from "@/lib/format";
import { DIFFICULTIES, LEVELS, SESSION_STATUS, type SessionStatus } from "@/lib/game";
import type { AdminCategory, Page, SessionDetail, SessionRow } from "@/lib/types";
import { useDebounced, useLoad } from "@/lib/use-load";

const PAGE_SIZE = 20;
/** "Print" loads every matching session; above this the administrator narrows the filters (or downloads the CSV). */
const PRINT_MAX = 1000;
/** The API's largest page. */
const FETCH_PAGE = 100;

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

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
  const [busy, setBusy] = useState<"print" | "csv" | null>(null);
  const [printRows, setPrintRows] = useState<SessionRow[] | null>(null);
  const { toast } = useFeedback();
  const searchText = useDebounced(search.trim());

  /** The list's filters, shared by the table, Print and Download CSV. */
  const filters = { studentId, search: searchText, categoryId: cat, difficulty: level, status, from: period.from, to: period.to };
  const categories = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const list = useLoad(
    () => apiFetch<Page<SessionRow>>(`/admin/sessions${qs({ ...filters, page, pageSize: PAGE_SIZE })}`),
    [studentId, searchText, cat, level, status, period.from, period.to, page],
  );
  const rows = list.data?.items ?? [];
  const studentName = studentId && rows[0]?.user.id === studentId ? rows[0].user.fullName : null;
  const total = list.data?.total ?? 0;

  /** Every matching session (not only this page), then the print dialog. */
  async function printAll() {
    if (total > PRINT_MAX) {
      toast(`${total} sessions match. Print at most ${PRINT_MAX}: choose a shorter period or more filters, or download the CSV.`, "error");
      return;
    }
    setBusy("print");
    try {
      const all: SessionRow[] = [];
      for (let p = 1; ; p++) {
        const res = await apiFetch<Page<SessionRow>>(`/admin/sessions${qs({ ...filters, page: p, pageSize: FETCH_PAGE })}`);
        all.push(...res.items);
        if (!res.items.length || all.length >= res.total) break;
      }
      setPrintRows(all);
    } catch (err) {
      toast(errorText(err, "Could not load the sessions to print."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCsv() {
    setBusy("csv");
    try {
      await apiDownload(`/admin/sessions${qs({ ...filters, format: "csv" })}`, "guessup_sessions.csv");
    } catch (err) {
      toast(errorText(err, "Could not download the file."), "error");
    } finally {
      setBusy(null);
    }
  }

  /** The Answers dialog; a round with no answers has nothing to show. Used by the row and its button. */
  const openAnswers = (s: SessionRow) => {
    if (s.answeredCount) setViewing(s.id);
  };

  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  /** The active filters, for both printouts. */
  const filterText = [
    studentId ? `Student: ${studentName ?? "one student"}` : searchText && `Search: “${searchText}”`,
    cat ? (categories.data?.find((c) => c.id === cat)?.name ?? "One category") : "All categories",
    level ? LEVELS[level as keyof typeof LEVELS].label : "All levels",
    status ? SESSION_STATUS[status as SessionStatus].label : "Any status",
    periodText(period),
  ];

  return (
    <>
      <PrintHeader
        landscape
        logos
        title="Recorded game sessions"
        details={[...filterText, list.data && `page ${page} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))} (${total} sessions)`]}
      />
      <div className="page-head">
        <div>
          <h2>Recorded game sessions</h2>
          <p>Every finished round and every submitted answer is recorded.</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => void printAll()} disabled={!list.data || !total || busy !== null}>
            {busy === "print" ? "Preparing…" : "🖨 Print"}
          </button>
          <button className="btn btn-ghost" onClick={() => void downloadCsv()} disabled={!list.data || !total || busy !== null}>
            {busy === "csv" ? "Preparing…" : "⬇ Download CSV"}
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar no-print">
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
                <th>Stars</th>
                <th>Time</th>
                <th>Hints</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody className={list.loading && list.data ? "opacity-60" : ""}>
              {list.error ? (
                <WideRow cols={11}>
                  <LoadError message={list.error} onRetry={list.reload} />
                </WideRow>
              ) : !list.data ? (
                <WideRow cols={11}>
                  <Empty icon="⏳">Loading sessions…</Empty>
                </WideRow>
              ) : !rows.length ? (
                <WideRow cols={11}>
                  <Empty icon="🎮">No sessions in this period.</Empty>
                </WideRow>
              ) : (
                rows.map((s) => {
                  const done = s.status === "COMPLETED";
                  const canOpen = s.answeredCount > 0;
                  return (
                    <tr
                      key={s.id}
                      className={canOpen ? "row-link" : "row-static"}
                      {...(canOpen && {
                        tabIndex: 0,
                        "aria-label": `View answers for ${s.user.fullName} – ${s.category.name} ${LEVELS[s.difficulty].label}`,
                        onClick: () => {
                          // Selecting text in a row is not a click on it.
                          if (window.getSelection()?.toString()) return;
                          openAnswers(s);
                        },
                        onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                          // Keys on the Answers button are the button's own.
                          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                          e.preventDefault();
                          openAnswers(s);
                        },
                      })}
                    >
                      <td className="small whitespace-nowrap">{dateTime(s.startedAt)}</td>
                      <td>
                        <div className="user-cell">
                          <Avatar name={s.user.fullName} src={s.user.avatarUrl} />
                          <div>
                            <b>{s.user.fullName}</b>
                            {!done && (
                              <div className="mt-0.5">
                                <StatusPill status={s.status} />
                              </div>
                            )}
                          </div>
                        </div>
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
                      <td>
                        <Stars value={s.stars} />
                      </td>
                      <td className="small">{done ? dur(s.timeSpent) : "—"}</td>
                      <td>{done ? s.hintsUsed : "—"}</td>
                      <td className="actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation(); // the row would open it again
                            openAnswers(s);
                          }}
                          disabled={!canOpen}
                        >
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
      {printRows && (
        <PrintSheet orientation="landscape" onDone={() => setPrintRows(null)}>
          <PrintHeader
            logos
            title="Recorded game sessions"
            details={[...filterText, `${printRows.length} session${printRows.length === 1 ? "" : "s"}`]}
          />
          <SessionsPrintTable rows={printRows} />
        </PrintSheet>
      )}
    </>
  );
}

/** Every matching session, as printed by the Print button. */
function SessionsPrintTable({ rows }: { rows: SessionRow[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Student</th>
          <th>Category</th>
          <th>Level</th>
          <th>Status</th>
          <th>Points</th>
          <th>Correct</th>
          <th>Started</th>
          <th>Finished</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>
              <b>{s.user.fullName}</b>
              <span className="muted small block">{s.user.email}</span>
            </td>
            <td>
              {s.category.icon} {s.category.name}
            </td>
            <td>
              <LevelPill level={s.difficulty} />
            </td>
            <td>
              <StatusPill status={s.status} />
            </td>
            <td>
              <b>{s.totalScore}</b>
            </td>
            <td>
              {s.status === "COMPLETED" ? s.correctCount : "—"}/{s.totalItems}
            </td>
            <td className="small">{dateTime(s.startedAt)}</td>
            <td className="small">{s.endedAt ? dateTime(s.endedAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The prototype's "Session answers" dialog. */
function SessionView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: s, error, reload } = useLoad(() => apiFetch<SessionDetail>(`/admin/sessions/${id}`), [id]);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useFeedback();

  async function downloadCsv() {
    setDownloading(true);
    try {
      await apiDownload(`/admin/sessions/${encodeURIComponent(id)}?format=csv`, "guessup_session.csv");
    } catch (err) {
      toast(errorText(err, "Could not download the file."), "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      title="Session answers"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setPrinting(true)} disabled={!s || printing}>
            🖨 Print
          </button>
          <button className="btn btn-ghost" onClick={() => void downloadCsv()} disabled={!s || downloading}>
            {downloading ? "Preparing…" : "⬇ Download CSV"}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {s && printing && (
        <PrintSheet onDone={() => setPrinting(false)}>
          <SessionPrintRecord s={s} />
        </PrintSheet>
      )}
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !s ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted -mt-1.5">
            {s.user.fullName} · {s.category.icon} {s.category.name} · {LEVELS[s.difficulty].label} · {dateTime(s.startedAt)} ·{" "}
            <b>{s.totalScore} pts</b>
            {s.stars !== null && (
              <>
                {" "}
                · <Stars value={s.stars} />
              </>
            )}
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

/** One session on paper: its details, then every answer. */
function SessionPrintRecord({ s }: { s: SessionDetail }) {
  const done = s.status === "COMPLETED";
  const facts: [string, React.ReactNode][] = [
    ["Student", s.user.fullName],
    ["Email", s.user.email],
    ["Year level", s.user.yearLevel || "—"],
    ["Category", `${s.category.icon} ${s.category.name}`],
    ["Difficulty", LEVELS[s.difficulty].label],
    ["Status", SESSION_STATUS[s.status].label],
    ["Started", dateTime(s.startedAt)],
    ["Finished", s.endedAt ? dateTime(s.endedAt) : "—"],
    ["Total points", s.totalScore],
    ["Correct", done ? `${s.correctCount} of ${s.totalItems}` : `— of ${s.totalItems} (${s.answeredCount} answered)`],
    ["Stars", s.stars === null ? "—" : <Stars value={s.stars} />],
    ["Time · hints", done ? `${dur(s.timeSpent)} · ${s.hintsUsed}` : "—"],
  ];
  return (
    <>
      <PrintHeader logos title="Game session record" details={[]} />
      <dl className="print-record">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Question</th>
            <th>Student answer</th>
            <th>Correct answer</th>
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
              <td className="q-cell">{a.question.questionText}</td>
              <td>{a.submitted || "—"}</td>
              <td>{a.question.answer}</td>
              <td>{a.isCorrect ? <span className="pill pill-ok">Correct</span> : <span className="pill pill-bad">Wrong</span>}</td>
              <td>{a.timeTaken}s</td>
              <td>{a.hintUsed ? "Yes" : "—"}</td>
              <td>
                <b>{a.pointsEarned}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
