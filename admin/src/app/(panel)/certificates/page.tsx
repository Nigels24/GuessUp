"use client";

import Link from "next/link";
import { useState } from "react";
import { CatPill, Empty, LoadError, PrintHeader, WideRow } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { date, qs } from "@/lib/format";
import type { AdminCategory, CertificateRow } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/**
 * Admin Panel > Certificates (panel revision): every category completion
 * certificate earned (Easy, Average and Difficult each passed with 2+ stars
 * in one category), newest first, with View / Print.
 */
export default function CertificatesPage() {
  const [cat, setCat] = useState("");
  const categories = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const list = useLoad(() => apiFetch<CertificateRow[]>(`/admin/certificates${qs({ categoryId: cat })}`), [cat]);
  const rows = list.data ?? [];

  return (
    <>
      <PrintHeader
        title="Certificates of completion"
        details={[cat ? (categories.data?.find((c) => c.id === cat)?.name ?? "One category") : "All categories", list.data && `${rows.length} earned`]}
      />
      <div className="page-head">
        <div>
          <h2>Certificates of completion</h2>
          <p>Earned by getting 2 or more stars (3 of 5 correct) on Easy, Average and Difficult in the same category.</p>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar no-print">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {list.data && (
            <span className="muted small">
              {rows.length} certificate{rows.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Year</th>
                <th>Category</th>
                <th>Date completed</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody className={list.loading && list.data ? "opacity-60" : ""}>
              {list.error ? (
                <WideRow cols={5}>
                  <LoadError message={list.error} onRetry={list.reload} />
                </WideRow>
              ) : !list.data ? (
                <WideRow cols={5}>
                  <Empty icon="⏳">Loading certificates…</Empty>
                </WideRow>
              ) : !rows.length ? (
                <WideRow cols={5}>
                  <Empty icon="📜">No certificates earned yet.</Empty>
                </WideRow>
              ) : (
                rows.map((c) => (
                  <tr key={`${c.student.id}|${c.category.id}`}>
                    <td>
                      <b className="block text-sm">{c.student.fullName}</b>
                      <span className="muted small">{c.student.email}</span>
                    </td>
                    <td>{c.student.yearLevel || "—"}</td>
                    <td>
                      <CatPill category={c.category} />
                    </td>
                    <td className="small">{date(c.completedAt)}</td>
                    <td className="actions">
                      <Link className="btn btn-ghost btn-sm no-print" href={`/certificates/${c.student.id}/${c.category.id}`}>
                        📜 View / Print
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
