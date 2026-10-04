"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { QuestionForm } from "@/components/QuestionForm";
import { CatPill, Empty, LevelPill, Modal, Pager, WideRow, useFeedback } from "@/components/ui";
import { apiFetch, assetUrl } from "@/lib/api";
import { qs } from "@/lib/format";
import { DIFFICULTIES, LEVELS, QUESTION_TYPES, TYPES } from "@/lib/game";
import type { AdminCategory, AdminQuestion, DeleteResult, Page } from "@/lib/types";
import { useDebounced, useLoad } from "@/lib/use-load";

const PAGE_SIZE = 15;

export default function QuestionBankPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <QuestionBank />
    </Suspense>
  );
}

/** Admin Panel > Question Bank (the prototype's #/a/questions). */
function QuestionBank() {
  const params = useSearchParams();
  const router = useRouter();
  const { confirm, alert, toast } = useFeedback();

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState(params.get("cat") ?? "");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminQuestion | "new" | null>(params.get("new") ? "new" : null);
  const [previewing, setPreviewing] = useState<AdminQuestion | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const searchText = useDebounced(search.trim());

  // ?new=1 (the dashboard's "Add question") opens the form once; drop it from the URL.
  useEffect(() => {
    if (params.get("new")) router.replace(cat ? `/questions?cat=${cat}` : "/questions");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const list = useLoad(
    () =>
      apiFetch<Page<AdminQuestion>>(
        `/admin/questions${qs({ categoryId: cat, type, difficulty: level, active: status, search: searchText, page, pageSize: PAGE_SIZE })}`,
      ),
    [cat, type, level, status, searchText, page],
  );
  const rows = list.data?.items ?? [];

  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  async function toggle(q: AdminQuestion, isActive: boolean) {
    setBusy(q.id);
    try {
      await apiFetch(`/admin/questions/${q.id}/active`, { method: "PATCH", body: { isActive } });
      list.setData((d) => d && { ...d, items: d.items.map((x) => (x.id === q.id ? { ...x, isActive } : x)) });
      toast(isActive ? "Question activated" : "Question deactivated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change the question.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(q: AdminQuestion) {
    const answered = q.answerCount > 0;
    const ok = await confirm({
      title: answered ? "Deactivate this question?" : "Delete this question?",
      message: (
        <>
          &ldquo;{q.questionText}&rdquo;
          {answered && (
            <>
              <br />
              <br />
              It has <b>{q.answerCount}</b> recorded answer{q.answerCount === 1 ? "" : "s"}, so it will be deactivated instead
              of deleted, to keep reports accurate.
            </>
          )}
        </>
      ),
      okText: answered ? "Deactivate" : "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiFetch<DeleteResult>(`/admin/questions/${q.id}`, { method: "DELETE" });
      if (res.outcome === "DELETED") toast("Question deleted");
      else if (answered) toast("Question deactivated");
      else await alert("Question deactivated", <p>{res.message}</p>);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the question.", "error");
    }
    void list.reload();
    void categories.reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Question items</h2>
          <p>Create, edit, and organize guessing items by category, type, and difficulty.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")} disabled={!categories.data?.length}>
          ＋ Add question
        </button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <input className="input search" value={search} onChange={filter(setSearch)} placeholder="🔍 Search question, answer, or topic…" aria-label="Search" />
          <select className="input" value={cat} onChange={filter(setCat)} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={type} onChange={filter(setType)} aria-label="Type">
            <option value="">All types</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPES[t].label}
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
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Type</th>
                <th>Level</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody className={list.loading && list.data ? "opacity-60" : ""}>
              {list.error ? (
                <WideRow cols={6}>
                  <Empty icon="⚠️">{list.error}</Empty>
                </WideRow>
              ) : !list.data ? (
                <WideRow cols={6}>
                  <Empty icon="⏳">Loading questions…</Empty>
                </WideRow>
              ) : !rows.length ? (
                <WideRow cols={6}>
                  <Empty icon="🔎">No questions match your filters.</Empty>
                </WideRow>
              ) : (
                rows.map((q) => (
                  <tr key={q.id}>
                    <td className="q-cell">
                      <b title={q.questionText}>{q.questionText}</b>
                      <span className="muted small">
                        Answer: <b className="!inline text-ink-2">{q.answer}</b>
                        {q.topic ? ` · ${q.topic}` : ""}
                      </span>
                    </td>
                    <td>
                      <CatPill category={q.category} />
                    </td>
                    <td className="small whitespace-nowrap">
                      {TYPES[q.type].icon} {TYPES[q.type].label}
                    </td>
                    <td>
                      <LevelPill level={q.difficulty} />
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={q.isActive}
                          disabled={busy === q.id}
                          onChange={(e) => void toggle(q, e.target.checked)}
                          aria-label={q.isActive ? "Active" : "Inactive"}
                        />
                        <span />
                      </label>
                    </td>
                    <td className="actions">
                      <button className="icon-btn" title="Preview" aria-label="Preview" onClick={() => setPreviewing(q)}>
                        👁️
                      </button>
                      <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(q)}>
                        ✏️
                      </button>
                      <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => void remove(q)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {list.data && <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} noun="items" onPage={setPage} />}
      </div>

      {editing && categories.data && (
        <QuestionForm
          question={editing === "new" ? null : editing}
          categories={categories.data}
          defaultCategoryId={cat || undefined}
          onClose={() => setEditing(null)}
          onSaved={(_saved, isNew) => {
            setEditing(null);
            toast(isNew ? "Question added" : "Changes saved");
            void list.reload();
            void categories.reload();
          }}
        />
      )}
      {previewing && <Preview question={previewing} onClose={() => setPreviewing(null)} />}
    </>
  );
}

/** The prototype's "Student preview". */
function Preview({ question: q, onClose }: { question: AdminQuestion; onClose: () => void }) {
  const options = useMemo(
    () => [q.answer, ...q.choices].map((o) => ({ o, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.o),
    [q],
  );
  const tiles = useMemo(
    () =>
      q.answer
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .split("")
        .map((ch) => ({ ch, k: Math.random() }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.ch),
    [q],
  );
  return (
    <Modal
      title="Student preview"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="q-card">
        <div className="q-meta">
          <span className="pill pill-brand">
            {TYPES[q.type].icon} {TYPES[q.type].label}
          </span>
          <LevelPill level={q.difficulty} />
          {!q.isActive && <span className="pill pill-gray">Inactive</span>}
        </div>
        <div className="q-text">{q.questionText}</div>
        {q.codeSnippet && <pre className="q-code">{q.codeSnippet}</pre>}
        {q.type === "PICTURE" && q.imageUrl && (
          <div className="q-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(q.imageUrl)} alt="" />
          </div>
        )}
        {q.type === "MULTIPLE_CHOICE" && (
          <div className="choices">
            {options.map((o, i) => (
              <div key={o} className={`choice ${o === q.answer ? "correct" : ""}`}>
                <span className="key">{"ABCD"[i]}</span>
                {o}
              </div>
            ))}
          </div>
        )}
        {q.type === "WORD_PUZZLE" && (
          <div className="tiles">
            {tiles.map((ch, i) => (
              <span className="tile" key={i}>
                {ch}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="small mt-3">
        <b>Answer:</b> {q.answer}
        {q.alternates.length > 0 && <span className="muted"> (also: {q.alternates.join(", ")})</span>}
      </p>
      {q.hint && (
        <p className="small">
          <b>Hint:</b> {q.hint}
        </p>
      )}
      <p className="small">
        <b>Explanation:</b> {q.explanation}
      </p>
    </Modal>
  );
}
