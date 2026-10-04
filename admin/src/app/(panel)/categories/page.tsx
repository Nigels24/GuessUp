"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, LoadError, Modal, useFeedback } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { DIFFICULTIES, LEVELS } from "@/lib/game";
import type { AdminCategory } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/** Admin Panel > Categories (the prototype's #/a/categories). */
export default function CategoriesPage() {
  const { confirm, alert, toast } = useFeedback();
  const { data, error, loading, reload } = useLoad(() => apiFetch<AdminCategory[]>("/admin/categories"), []);
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);

  async function remove(cat: AdminCategory) {
    const blocked = (message: string) => alert("Cannot delete category", <p>{message}</p>);
    // The prototype checks first; the server checks again (409) in case it changed meanwhile.
    if (cat.questionCount || cat.sessionCount) {
      return blocked(blockedMessage(cat));
    }
    const ok = await confirm({
      title: "Delete category?",
      message: (
        <>
          Delete <b>{cat.name}</b>? This cannot be undone.
        </>
      ),
      okText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/categories/${cat.id}`, { method: "DELETE" });
      toast("Category deleted");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) await blocked(err.message);
      else toast(err instanceof Error ? err.message : "Could not delete the category.", "error");
    }
    void reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Subject categories</h2>
          <p>Core professional courses of the BSIT curriculum.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          ＋ Add category
        </button>
      </div>

      {error && !data ? (
        <div className="panel">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <p className="muted">Loading categories…</p>
      ) : !data?.length ? (
        <div className="panel">
          <Empty icon="🗂️">No categories yet.</Empty>
        </div>
      ) : (
        <div className="cat-cards">
          {data.map((cat) => (
            <div key={cat.id} className="cat-admin" style={{ borderTopColor: cat.color }}>
              <div className="top">
                <span className="ic" style={{ background: `${cat.color}1f` }}>
                  {cat.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h4>{cat.name}</h4>
                  <span className="muted small">
                    {cat.questionCount} questions · {cat.sessionCount} rounds
                  </span>
                </div>
              </div>
              <p className="muted small">{cat.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <span key={d} className="pill" style={{ background: `${LEVELS[d].color}1a`, color: LEVELS[d].color }}>
                    {LEVELS[d].label}: {cat.byDifficulty[d].total}
                  </span>
                ))}
              </div>
              {cat.activeQuestionCount < cat.questionCount && (
                <span className="muted small">{cat.questionCount - cat.activeQuestionCount} inactive</span>
              )}
              <div className="foot">
                <Link className="small font-extrabold" href={`/questions?cat=${cat.id}`}>
                  View questions →
                </Link>
                <span>
                  <button className="icon-btn" title="Edit" aria-label={`Edit ${cat.name}`} onClick={() => setEditing(cat)}>
                    ✏️
                  </button>
                  <button className="icon-btn" title="Delete" aria-label={`Delete ${cat.name}`} onClick={() => void remove(cat)}>
                    🗑️
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(isNew) => {
            setEditing(null);
            toast(isNew ? "Category added" : "Category updated");
            void reload();
          }}
        />
      )}
    </>
  );
}

function blockedMessage(cat: AdminCategory): string {
  const parts: string[] = [];
  if (cat.questionCount) {
    parts.push(
      `${cat.name} still has ${cat.questionCount} question${cat.questionCount > 1 ? "s" : ""}. Delete or move them first. The database keeps referential integrity, so a question cannot point to a missing category.`,
    );
  }
  if (cat.sessionCount) {
    parts.push(
      `${cat.questionCount ? "It also has" : `${cat.name} has`} ${cat.sessionCount} recorded game session${cat.sessionCount > 1 ? "s" : ""}. Categories with game history are kept so reports and leaderboards stay accurate.`,
    );
  }
  return parts.join(" ");
}

/** "Operating Systems" -> "operating-systems" (same rule as the server). */
function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null;
  onClose: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const isNew = !category;
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState(category?.icon ?? "📘");
  const [color, setColor] = useState(category?.color ?? "#6C4CF1");
  const [description, setDescription] = useState(category?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const shownSlug = isNew && !slugTouched ? slugify(name) : slug;

  async function save() {
    if (!name.trim()) return setError("Category name is required.");
    setSaving(true);
    setError("");
    try {
      const body = { name: name.trim(), icon: icon.trim() || "📘", color, description: description.trim() };
      if (isNew) {
        await apiFetch("/admin/categories", { method: "POST", body: { ...body, slug: shownSlug || undefined } });
      } else {
        await apiFetch(`/admin/categories/${category.id}`, { method: "PATCH", body });
      }
      onSaved(isNew);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the category.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add category" : "Edit category"}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Add category" : "Save"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="error-text" role="alert">
          {error}
        </div>
        <div className="field">
          <label htmlFor="cn">Category name *</label>
          <input className="input" id="cn" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g., Operating Systems" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="cs">Short name (slug)</label>
          <input
            className="input mono"
            id="cs"
            value={shownSlug}
            maxLength={40}
            disabled={!isNew}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <span className="help">
            {isNew ? "Made from the name; lowercase letters, digits and dashes." : "The slug cannot change after the category is created."}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="ci">Icon (emoji)</label>
            <input className="input" id="ci" value={icon} maxLength={16} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cc">Color</label>
            <input className="input h-[46px] cursor-pointer p-1" id="cc" type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cd">Description</label>
          <textarea className="input" id="cd" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
