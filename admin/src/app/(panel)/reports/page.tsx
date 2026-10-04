"use client";

import { useState } from "react";
import { PeriodSelect, periodFor, type Period } from "@/components/PeriodSelect";
import { AccPill, Bars, CatPill, Cols, Kpi, LevelPill, LoadError, WideRow, Avatar, useFeedback } from "@/components/ui";
import { apiDownload, apiFetch } from "@/lib/api";
import { date, num, qs, shortDay } from "@/lib/format";
import { TYPES } from "@/lib/game";
import type { ActivityReport, AdminCategory, MostMissedReport, ScoresReport } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/** Rows in the on-screen "most missed" table (the prototype shows 15); the CSV holds up to 100. */
const MISSED_ROWS = 15;
const MIN_ATTEMPTS = [1, 3, 5, 10];

/** Admin Panel > Reports (the prototype's #/a/reports). */
export default function ReportsPage() {
  const { toast } = useFeedback();
  const [period, setPeriod] = useState<Period>(() => periodFor("30"));
  const [cat, setCat] = useState("");
  const [minAttempts, setMinAttempts] = useState(3);
  const [downloading, setDownloading] = useState<string | null>(null);

  const filters = { from: period.from, to: period.to, categoryId: cat };
  const categories = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const activity = useLoad(() => apiFetch<ActivityReport>(`/admin/reports/activity${qs(filters)}`), [period.from, period.to, cat]);
  const scores = useLoad(() => apiFetch<ScoresReport>(`/admin/reports/scores${qs(filters)}`), [period.from, period.to, cat]);
  const missed = useLoad(
    () => apiFetch<MostMissedReport>(`/admin/reports/most-missed${qs({ ...filters, minAttempts, limit: MISSED_ROWS })}`),
    [period.from, period.to, cat, minAttempts],
  );

  async function download(report: "activity" | "scores" | "most-missed", fallback: string) {
    setDownloading(report);
    try {
      const extra = report === "most-missed" ? { minAttempts, limit: 100 } : {};
      await apiDownload(`/admin/reports/${report}${qs({ ...filters, ...extra, format: "csv" })}`, fallback);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not download the file.", "error");
    } finally {
      setDownloading(null);
    }
  }

  const a = activity.data;
  const csvButton = (report: "activity" | "scores" | "most-missed", fallback: string) => (
    <button className="btn btn-ghost btn-sm no-print" onClick={() => void download(report, fallback)} disabled={downloading === report}>
      {downloading === report ? "Preparing…" : "⬇ Export CSV"}
    </button>
  );
  const firstError = activity.error || scores.error || missed.error;
  const reloadAll = () => {
    void activity.reload();
    void scores.reload();
    void missed.reload();
  };
  const dayStep = Math.max(1, Math.ceil((a?.roundsPerDay.length ?? 0) / 14));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Performance reports</h2>
          <p>Player activity, average scores per category, and the items most frequently answered incorrectly.</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <PeriodSelect value={period} onChange={setPeriod} className="!w-auto" />
          <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </div>
      {a && (
        <p className="muted small -mt-2.5 mb-3.5">
          {date(`${a.from}T12:00:00+08:00`)} – {date(`${a.to}T12:00:00+08:00`)} · completed rounds only
        </p>
      )}

      {firstError ? (
        <div className="panel">
          <LoadError message={firstError} onRetry={reloadAll} />
        </div>
      ) : (
        <>
          <div className="tiles-4">
            <Kpi icon="👥" bg="#EDE9FE" value={a ? a.activePlayers : "…"} label="Active players" />
            <Kpi icon="🎮" bg="#DCFCE7" value={a ? a.rounds : "…"} label="Rounds played" />
            <Kpi icon="✍️" bg="#E0F2FE" value={a ? num(a.answers) : "…"} label="Answers recorded" />
            <Kpi icon="🎯" bg="#FEF3C7" value={a ? `${a.accuracy}%` : "…"} label="Overall accuracy" />
          </div>

          <div className="grid-2 mb-[18px]">
            <div className="panel">
              <div className="panel-head">
                <h3>Average score per category</h3>
                {csvButton("scores", "guessup_average_scores.csv")}
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Rounds</th>
                      <th>Avg score</th>
                      <th>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!scores.data ? (
                      <WideRow cols={4}>
                        <span className="muted">Loading…</span>
                      </WideRow>
                    ) : (
                      scores.data.byCategory.map((x) => (
                        <tr key={x.category.id}>
                          <td>
                            <CatPill category={x.category} />
                          </td>
                          <td>{x.rounds}</td>
                          <td>
                            <b>{x.rounds ? x.avgScore : "—"}</b>
                          </td>
                          <td>{x.rounds ? <AccPill value={x.accuracy} /> : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {scores.data && (
                    <>
                      <thead>
                        <tr>
                          <th>Difficulty</th>
                          <th>Rounds</th>
                          <th>Avg score</th>
                          <th>Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.data.byDifficulty.map((x) => (
                          <tr key={x.difficulty}>
                            <td>
                              <LevelPill level={x.difficulty} />
                            </td>
                            <td>{x.rounds}</td>
                            <td>
                              <b>{x.rounds ? x.avgScore : "—"}</b>
                            </td>
                            <td>{x.rounds ? <AccPill value={x.accuracy} /> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Topics needing reteaching</h3>
              </div>
              <div className="panel-body">
                {!missed.data ? (
                  <p className="muted">Loading…</p>
                ) : missed.data.topics.length ? (
                  <Bars
                    rows={missed.data.topics.map((t) => ({
                      key: `${t.category.id}|${t.topic}`,
                      label: `${t.category.icon} ${t.topic}`,
                      title: `${t.category.name} · ${t.topic}: missed ${t.wrong}/${t.attempts}`,
                      pct: t.wrongRate,
                      value: `${t.wrongRate}%`,
                      color: "#EF4444",
                    }))}
                  />
                ) : (
                  <p className="muted">No data for this period.</p>
                )}
                <p className="muted small mt-2.5">Percent of answers that were wrong, per topic.</p>
              </div>
            </div>
          </div>

          <div className="panel mb-[18px]">
            <div className="panel-head">
              <h3>Items most frequently answered incorrectly</h3>
              <div className="flex items-center gap-2">
                <label className="muted small no-print" htmlFor="minAtt">
                  Min. attempts
                </label>
                <select
                  id="minAtt"
                  className="input no-print !w-auto !rounded-[10px] !px-2.5 !py-1.5 text-[13px]"
                  value={minAttempts}
                  onChange={(e) => setMinAttempts(Number(e.target.value))}
                >
                  {MIN_ATTEMPTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {csvButton("most-missed", "guessup_most_missed.csv")}
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Level</th>
                    <th>Attempts</th>
                    <th>Wrong</th>
                    <th>Wrong rate</th>
                  </tr>
                </thead>
                <tbody>
                  {!missed.data ? (
                    <WideRow cols={8}>
                      <span className="muted">Loading…</span>
                    </WideRow>
                  ) : !missed.data.items.length ? (
                    <WideRow cols={8}>
                      <span className="muted">
                        No data for this period
                        {minAttempts > 1 ? ` (items answered at least ${minAttempts} times)` : ""}.
                      </span>
                    </WideRow>
                  ) : (
                    missed.data.items.map((m, i) => (
                      <tr key={m.question.id}>
                        <td>{i + 1}</td>
                        <td className="q-cell">
                          <b title={m.question.questionText}>{m.question.questionText}</b>
                          <span className="muted small">
                            Answer: {m.question.answer}
                            {!m.question.isActive && " · inactive"}
                          </span>
                        </td>
                        <td>
                          <CatPill category={m.question.category} />
                        </td>
                        <td className="small">{TYPES[m.question.type].label}</td>
                        <td>
                          <LevelPill level={m.question.difficulty} />
                        </td>
                        <td>{m.attempts}</td>
                        <td>{m.wrong}</td>
                        <td>
                          <span className="pill pill-bad">{m.wrongRate}%</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2 mb-[18px]">
            <div className="panel">
              <div className="panel-head">
                <h3>Rounds per day</h3>
              </div>
              <div className="panel-body">
                {a ? (
                  <Cols
                    rows={a.roundsPerDay.map((d, i) => ({
                      key: d.date,
                      label: i % dayStep === 0 ? shortDay(d.date).replace(/^\w+ /, "") : "",
                      value: d.rounds,
                      title: `${shortDay(d.date)}: ${d.rounds} round${d.rounds === 1 ? "" : "s"}`,
                    }))}
                  />
                ) : (
                  <p className="muted">Loading…</p>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Rounds per category</h3>
              </div>
              <div className="panel-body">
                {a ? (
                  <Bars
                    rows={a.roundsPerCategory.map((x) => ({
                      key: x.category.id,
                      label: `${x.category.icon} ${x.category.name}`,
                      title: x.category.name,
                      pct: (x.rounds / Math.max(1, ...a.roundsPerCategory.map((r) => r.rounds))) * 100,
                      value: x.rounds,
                      color: x.category.color,
                    }))}
                  />
                ) : (
                  <p className="muted">Loading…</p>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Player activity</h3>
              {csvButton("activity", "guessup_player_activity.csv")}
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Year</th>
                    <th>Rounds</th>
                    <th>Points</th>
                    <th>Accuracy</th>
                    <th>Last played</th>
                  </tr>
                </thead>
                <tbody>
                  {!a ? (
                    <WideRow cols={7}>
                      <span className="muted">Loading…</span>
                    </WideRow>
                  ) : !a.players.length ? (
                    <WideRow cols={7}>
                      <span className="muted">No data for this period.</span>
                    </WideRow>
                  ) : (
                    a.players.map((p) => (
                      <tr key={p.student.id}>
                        <td>{p.rank}</td>
                        <td>
                          <div className="user-cell">
                            <Avatar name={p.student.fullName} />
                            <div>
                              <b>{p.student.fullName}</b>
                              <span className="sub">{p.student.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{p.student.yearLevel || "—"}</td>
                        <td>{p.rounds}</td>
                        <td>
                          <b>{num(p.points)}</b>
                        </td>
                        <td>
                          <AccPill value={p.accuracy} />
                        </td>
                        <td className="small muted">{date(p.lastPlayed)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
