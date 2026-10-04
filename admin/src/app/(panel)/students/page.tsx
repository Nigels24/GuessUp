"use client";

import Link from "next/link";
import { useState } from "react";
import { AccPill, Avatar, Bars, Empty, LoadError, Modal, Pager, WideRow, useFeedback } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { ago, date, num, qs } from "@/lib/format";
import { YEAR_LEVELS } from "@/lib/game";
import type { Page, StudentDetail, StudentRow } from "@/lib/types";
import { useDebounced, useLoad } from "@/lib/use-load";

const PAGE_SIZE = 25;

/** Admin Panel > Students (the prototype's #/a/students). */
export default function StudentsPage() {
  const { confirm, toast } = useFeedback();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const searchText = useDebounced(search.trim());

  const list = useLoad(
    () => apiFetch<Page<StudentRow>>(`/admin/students${qs({ search: searchText, yearLevel: year, status, page, pageSize: PAGE_SIZE })}`),
    [searchText, year, status, page],
  );
  const rows = list.data?.items ?? [];

  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  async function toggle(u: StudentRow) {
    const off = u.status === "ACTIVE";
    const ok = await confirm({
      title: `${off ? "Deactivate" : "Activate"} ${u.fullName}?`,
      message: off
        ? "The student will not be able to log in, and will be hidden from leaderboards."
        : "The student will be able to log in and play again.",
      okText: off ? "Deactivate" : "Activate",
      danger: off,
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      const updated = await apiFetch<StudentRow>(`/admin/students/${u.id}/status`, {
        method: "PATCH",
        body: { status: off ? "INACTIVE" : "ACTIVE" },
      });
      list.setData((d) => d && { ...d, items: d.items.map((x) => (x.id === u.id ? updated : x)) });
      toast(`${u.fullName} ${off ? "deactivated" : "activated"}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change the account.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Student accounts</h2>
          <p>View, activate, or deactivate student accounts. Deactivated students cannot log in.</p>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar">
          <input className="input search" value={search} onChange={filter(setSearch)} placeholder="🔍 Search name or email…" aria-label="Search" />
          <select className="input" value={year} onChange={filter(setYear)} aria-label="Year level">
            <option value="">All year levels</option>
            {YEAR_LEVELS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select className="input" value={status} onChange={filter(setStatus)} aria-label="Status">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Year</th>
                <th>Rounds</th>
                <th>Points</th>
                <th>Accuracy</th>
                <th>Last active</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody className={list.loading && list.data ? "opacity-60" : ""}>
              {list.error ? (
                <WideRow cols={8}>
                  <LoadError message={list.error} onRetry={list.reload} />
                </WideRow>
              ) : !list.data ? (
                <WideRow cols={8}>
                  <Empty icon="⏳">Loading students…</Empty>
                </WideRow>
              ) : !rows.length ? (
                <WideRow cols={8}>
                  <Empty icon="👥">No students match.</Empty>
                </WideRow>
              ) : (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <Avatar name={u.fullName} inactive={u.status !== "ACTIVE"} />
                        <div>
                          <b>{u.fullName}</b>
                          <span className="sub">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.yearLevel || "—"}</td>
                    <td>{u.rounds}</td>
                    <td>
                      <b>{num(u.totalPoints)}</b>
                    </td>
                    <td>{u.rounds ? <AccPill value={u.accuracy} /> : "—"}</td>
                    <td className="muted small">{ago(u.lastActive)}</td>
                    <td>
                      {u.status === "ACTIVE" ? <span className="pill pill-ok">● Active</span> : <span className="pill pill-gray">● Inactive</span>}
                    </td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewing(u.id)}>
                        View
                      </button>{" "}
                      <button
                        className={`btn btn-sm ${u.status === "ACTIVE" ? "btn-ghost" : "btn-ok"}`}
                        disabled={busy === u.id}
                        onClick={() => void toggle(u)}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} noun="students" onPage={setPage} />}
      </div>
      {viewing && <StudentView id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** The prototype's student detail dialog. */
function StudentView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: u, error, reload } = useLoad(() => apiFetch<StudentDetail>(`/admin/students/${id}`), [id]);
  return (
    <Modal
      title={u?.fullName ?? "Student"}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Link className="btn btn-ghost" href={`/sessions?student=${id}`}>
            Game sessions
          </Link>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !u ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted -mt-1.5">
            {u.email} · {u.yearLevel || "—"} · joined {date(u.createdAt)}
            {u.status !== "ACTIVE" && <span className="pill pill-gray ml-2">Inactive</span>}
          </p>
          <div className="tiles-4 mt-3.5">
            <div className="kpi">
              <div>
                <b>{u.rounds}</b>
                <span className="l">Rounds</span>
              </div>
            </div>
            <div className="kpi">
              <div>
                <b>{num(u.totalPoints)}</b>
                <span className="l">Points</span>
              </div>
            </div>
            <div className="kpi">
              <div>
                <b>{u.accuracy}%</b>
                <span className="l">Accuracy</span>
              </div>
            </div>
            <div className="kpi">
              <div>
                <b>{u.badges.length}</b>
                <span className="l" title={u.badges.map((b) => b.name).join(", ")}>
                  Badges {u.badges.map((b) => b.icon).join("")}
                </span>
              </div>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <h3 className="mb-2.5 text-base">Accuracy by category</h3>
              {u.perCategory.length ? (
                <Bars
                  rows={u.perCategory.map((x) => ({
                    key: x.category.id,
                    label: `${x.category.icon} ${x.category.name}`,
                    title: x.category.name,
                    pct: x.accuracy,
                    value: `${x.accuracy}%`,
                    color: x.category.color,
                  }))}
                />
              ) : (
                <p className="muted">No rounds yet.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2.5 text-base">Most missed topics</h3>
              {u.topicsToReview.length ? (
                <div className="flex flex-col gap-2">
                  {u.topicsToReview.map((t) => (
                    <div key={`${t.category.id}|${t.topic}`} className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-[11px] text-lg" style={{ background: `${t.category.color}1f` }}>
                        {t.category.icon}
                      </span>
                      <div>
                        <b className="block text-sm">{t.topic}</b>
                        <span className="muted small">
                          missed {t.wrong}/{t.attempts}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">None.</p>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
