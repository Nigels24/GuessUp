"use client";

import Link from "next/link";
import { AccPill, Avatar, Bars, CatPill, Cols, Kpi, LevelPill, LoadError, WideRow } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { ago } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/** Admin Panel > Dashboard (the prototype's #/a/dashboard): activity in the last 30 days. */
export default function DashboardPage() {
  const { data: d, error, reload } = useLoad(() => apiFetch<DashboardSummary>("/admin/dashboard"), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Overview</h2>
          <p>Activity in the last 30 days</p>
        </div>
        <Link className="btn btn-primary" href="/questions?new=1">
          ＋ Add question
        </Link>
      </div>

      {error && !d ? (
        <div className="panel">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : (
        <>
          <div className="tiles-4">
            <Kpi
              icon="👥"
              bg="#EDE9FE"
              value={d ? d.students.active : "…"}
              label={d ? `Active students (${d.students.total} total)` : "Active students"}
            />
            <Kpi
              icon="❓"
              bg="#E0F2FE"
              value={d ? d.questions.active : "…"}
              label={d?.questions.inactive ? `Active questions (${d.questions.inactive} inactive)` : "Active questions"}
            />
            <Kpi
              icon="🎮"
              bg="#DCFCE7"
              value={d ? d.rounds.last30Days : "…"}
              label={d ? `Rounds played (${d.rounds.today} today, ${d.rounds.thisWeek} this week)` : "Rounds played"}
            />
            <Kpi icon="🎯" bg="#FEF3C7" value={d ? `${d.accuracy}%` : "…"} label="Average accuracy" />
          </div>

          <div className="grid-2 mb-[18px]">
            <div className="panel">
              <div className="panel-head">
                <h3>Average accuracy per category</h3>
                <Link className="small" href="/reports">
                  Full report →
                </Link>
              </div>
              <div className="panel-body">
                {d ? (
                  <Bars
                    rows={d.categoryAccuracy.map((x) => ({
                      key: x.category.id,
                      label: `${x.category.icon} ${x.category.name}`,
                      title: x.category.name,
                      pct: x.accuracy,
                      value: x.rounds ? `${x.accuracy}%` : "—",
                      color: x.category.color,
                    }))}
                  />
                ) : (
                  <p className="muted">Loading…</p>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Rounds per day</h3>
                <span className="muted small">Last 14 days</span>
              </div>
              <div className="panel-body">
                {d ? (
                  <Cols
                    rows={d.roundsPerDay.map((r) => ({
                      key: r.date,
                      label: String(Number(r.date.slice(8))),
                      value: r.rounds,
                      title: `${r.date}: ${r.rounds}`,
                    }))}
                  />
                ) : (
                  <p className="muted">Loading…</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <h3>Most missed items</h3>
                <Link className="small" href="/reports">
                  View all →
                </Link>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Category</th>
                      <th>Wrong</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!d ? (
                      <WideRow cols={3}>
                        <span className="muted">Loading…</span>
                      </WideRow>
                    ) : !d.mostMissed.length ? (
                      <WideRow cols={3}>
                        <span className="muted">No data yet.</span>
                      </WideRow>
                    ) : (
                      d.mostMissed.map((m) => (
                        <tr key={m.question.id}>
                          <td className="q-cell">
                            <b title={m.question.questionText}>{m.question.questionText}</b>
                            <span className="muted small">{m.question.topic}</span>
                          </td>
                          <td>
                            <CatPill category={m.question.category} />
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="pill pill-bad">{m.wrongRate}%</span>{" "}
                            <span className="muted small">
                              {m.wrong}/{m.attempts}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h3>Recent game sessions</h3>
                <Link className="small" href="/sessions">
                  View all →
                </Link>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <tbody>
                    {!d ? (
                      <WideRow cols={5}>
                        <span className="muted">Loading…</span>
                      </WideRow>
                    ) : !d.recentSessions.length ? (
                      <WideRow cols={5}>
                        <span className="muted">No sessions yet.</span>
                      </WideRow>
                    ) : (
                      d.recentSessions.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="user-cell">
                              <Avatar name={s.user.fullName} />
                              <div>
                                <b>{s.user.fullName}</b>
                                <span className="sub">
                                  {s.category.icon} {s.category.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <LevelPill level={s.difficulty} />
                          </td>
                          <td className="whitespace-nowrap">
                            <b>{s.totalScore}</b> pts
                          </td>
                          <td>
                            <AccPill value={s.accuracy} />
                          </td>
                          <td className="muted small whitespace-nowrap">{ago(s.endedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
