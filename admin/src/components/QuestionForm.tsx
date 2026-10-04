"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { apiFetch, ApiError, assetUrl } from "@/lib/api";
import {
  DIFFICULTIES,
  LEVELS,
  MAX_IMAGE_BYTES,
  MC_DISTRACTORS,
  PUZZLE_MAX_LETTERS,
  QUESTION_TYPES,
  TYPES,
  type Difficulty,
  type QuestionType,
} from "@/lib/game";
import type { AdminCategory, AdminQuestion, QuestionPayload, UploadedImage } from "@/lib/types";

const OPTION_KEYS = "ABCD";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

/** The prototype's "Add question" / "Edit question" form. */
export function QuestionForm({
  question,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  question: AdminQuestion | null;
  categories: AdminCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSaved: (saved: AdminQuestion, isNew: boolean) => void;
}) {
  const isNew = !question;
  const [categoryId, setCategoryId] = useState(question?.category.id ?? defaultCategoryId ?? categories[0]?.id ?? "");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [type, setType] = useState<QuestionType>(question?.type ?? "MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? "EASY");
  const [questionText, setQuestionText] = useState(question?.questionText ?? "");
  const [codeSnippet, setCodeSnippet] = useState(question?.codeSnippet ?? "");
  const [answer, setAnswer] = useState(question?.answer ?? "");
  const [alternates, setAlternates] = useState((question?.alternates ?? []).join(", "));
  // Multiple choice: four options, one marked correct (stored as answer + 3 choices).
  const [options, setOptions] = useState<string[]>(() =>
    question?.type === "MULTIPLE_CHOICE"
      ? [question.answer, ...question.choices].concat(["", "", "", ""]).slice(0, MC_DISTRACTORS + 1)
      : ["", "", "", ""],
  );
  const [correct, setCorrect] = useState(0);
  const [image, setImage] = useState<{ url: string; publicId: string | null } | null>(
    question?.imageUrl ? { url: question.imageUrl, publicId: question.imagePublicId } : null,
  );
  const [hint, setHint] = useState(question?.hint ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [isActive, setIsActive] = useState(question?.isActive ?? true);

  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [library, setLibrary] = useState<{ name: string; url: string }[]>([]);
  const bodyTop = useRef<HTMLDivElement>(null);
  /** Cloudinary uploads made in this form; the unsaved ones are discarded. */
  const uploads = useRef(new Set<string>());

  const noHints = LEVELS[difficulty].hints === 0;

  useEffect(() => {
    if (type === "PICTURE" && !library.length) {
      apiFetch<{ name: string; url: string }[]>("/admin/uploads/library").then(setLibrary).catch(() => undefined);
    }
  }, [type, library.length]);

  function discard(publicId: string | null | undefined) {
    if (!publicId || !uploads.current.has(publicId)) return;
    uploads.current.delete(publicId);
    void apiFetch(`/admin/uploads/image?publicId=${encodeURIComponent(publicId)}`, { method: "DELETE" }).catch(() => undefined);
  }

  function replaceImage(next: { url: string; publicId: string | null } | null) {
    discard(image?.publicId);
    setImage(next);
  }

  function close() {
    for (const id of Array.from(uploads.current)) discard(id);
    onClose();
  }

  async function upload(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) return setErrors(["Only JPG, PNG, WebP and SVG images can be uploaded."]);
    if (file.size > MAX_IMAGE_BYTES) return setErrors(["The image must be 2 MB or smaller."]);
    setUploading(true);
    setErrors([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<UploadedImage>("/admin/uploads/image", { method: "POST", body: form });
      uploads.current.add(res.publicId);
      replaceImage({ url: res.url, publicId: res.publicId });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "The image could not be uploaded."]);
    } finally {
      setUploading(false);
    }
  }

  function payload(): QuestionPayload {
    const isMc = type === "MULTIPLE_CHOICE";
    return {
      categoryId,
      type,
      difficulty,
      questionText,
      codeSnippet: codeSnippet.replace(/\s+$/, "") || null,
      imageUrl: type === "PICTURE" ? (image?.url ?? null) : null,
      imagePublicId: type === "PICTURE" ? (image?.publicId ?? null) : null,
      answer: isMc ? options[correct]! : answer,
      alternates: isMc ? [] : alternates.split(",").map((a) => a.trim()).filter(Boolean),
      choices: isMc ? options.filter((_, i) => i !== correct) : [],
      hint: noHints ? null : hint.trim() || null,
      explanation,
      topic: topic.trim() || null,
      isActive,
    };
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    try {
      const body = payload();
      const saved = isNew
        ? await apiFetch<AdminQuestion>("/admin/questions", { method: "POST", body })
        : await apiFetch<AdminQuestion>(`/admin/questions/${question.id}`, { method: "PATCH", body });
      // Uploads replaced before saving are no longer needed.
      for (const id of Array.from(uploads.current)) if (id !== saved.imagePublicId) discard(id);
      uploads.current.clear();
      onSaved(saved, isNew);
    } catch (err) {
      setErrors(err instanceof ApiError ? err.messages : [err instanceof Error ? err.message : "Could not save the question."]);
      setSaving(false);
      bodyTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  return (
    <Modal
      title={isNew ? "Add question" : "Edit question"}
      size="lg"
      onClose={close}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || uploading}>
            {saving ? "Saving…" : isNew ? "Add question" : "Save changes"}
          </button>
        </>
      }
    >
      <div ref={bodyTop} />
      {errors.length > 0 && (
        <div className="error-text mb-2" role="alert">
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <ul className="list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="qc">Subject category *</label>
          <select className="input" id="qc" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qt">Topic</label>
          <input className="input" id="qt" value={topic} maxLength={40} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Subnetting" />
          <span className="help">Used in &quot;most missed topics&quot; reports.</span>
        </div>
        <div className="field">
          <label htmlFor="qty">Question type *</label>
          <select className="input" id="qty" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPES[t].icon} {TYPES[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ql">Difficulty level *</label>
          <select className="input" id="ql" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {LEVELS[d].label} ({LEVELS[d].seconds}s, {LEVELS[d].points} pts)
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="qq">Question / clue *</label>
          <textarea className="input" id="qq" rows={2} maxLength={300} value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
        </div>
        <div className="field full">
          <label htmlFor="qcode">
            Code snippet <span className="muted">(optional)</span>
          </label>
          <textarea
            className="input mono"
            id="qcode"
            rows={2}
            maxLength={1000}
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Shown in a code box under the question"
          />
        </div>

        {type === "PICTURE" && (
          <div className="field full">
            <label>Question image *</label>
            <div className="img-drop">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(image.url)} alt="Question image preview" />
              ) : (
                <p className="muted small mb-2">No image selected</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <label className={`btn btn-ghost btn-sm ${uploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                  {uploading ? "Uploading…" : image ? "⬆ Replace image" : "⬆ Upload image"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(file);
                    }}
                  />
                </label>
                <select
                  className="input !w-auto !px-2.5 !py-1.5 text-[13px]"
                  value={library.some((l) => l.url === image?.url) ? image!.url : ""}
                  onChange={(e) => e.target.value && replaceImage({ url: e.target.value, publicId: null })}
                  aria-label="Pick from picture library"
                >
                  <option value="">…or pick from picture library</option>
                  {library.map((l) => (
                    <option key={l.url} value={l.url}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => replaceImage(null)} disabled={!image}>
                  Remove
                </button>
              </div>
              <span className="help mt-1.5 block">Uploaded to Cloudinary. JPG, PNG, WebP or SVG, up to 2 MB.</span>
            </div>
          </div>
        )}

        {type === "MULTIPLE_CHOICE" ? (
          <div className="field full">
            <label>Options * — mark the correct answer</label>
            <div className="grid gap-2 min-[700px]:grid-cols-2">
              {options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 ${i === correct ? "border-[#16A34A] bg-[#DCFCE7]" : "border-line"}`}>
                  <input
                    type="radio"
                    name="correct"
                    checked={i === correct}
                    onChange={() => setCorrect(i)}
                    aria-label={`Option ${OPTION_KEYS[i]} is correct`}
                    className="h-4 w-4 accent-[#16A34A]"
                  />
                  <b className="w-4 text-center text-sm text-ink-2">{OPTION_KEYS[i]}</b>
                  <input
                    className="input !border-0 !bg-transparent !px-1 !py-1.5 !shadow-none"
                    value={opt}
                    maxLength={80}
                    placeholder={i === correct ? "Correct answer" : `Wrong option`}
                    onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                  />
                  {i === correct && <span className="pill pill-ok">Correct</span>}
                </div>
              ))}
            </div>
            <span className="help">Students see the 4 options in a random order.</span>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="qa">Correct answer *</label>
              <input className="input" id="qa" value={answer} maxLength={80} onChange={(e) => setAnswer(e.target.value)} />
              {type === "WORD_PUZZLE" && (
                <span className="help">Letters and spaces only. Letters are scrambled automatically. Keep it short (≤ {PUZZLE_MAX_LETTERS} letters).</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="qalt">Other accepted answers</label>
              <input className="input" id="qalt" value={alternates} onChange={(e) => setAlternates(e.target.value)} placeholder="Comma-separated, e.g., 1:m, one-to-many" />
              <span className="help">Capitals, spaces, and symbols are ignored.</span>
            </div>
            {type === "WORD_PUZZLE" && <PuzzlePreview answer={answer} />}
          </>
        )}

        <div className="field full">
          <label htmlFor="qh">Hint</label>
          <input
            className="input"
            id="qh"
            value={noHints ? "" : hint}
            maxLength={200}
            disabled={noHints}
            onChange={(e) => setHint(e.target.value)}
            placeholder={noHints ? "Not available on Difficult" : "Partial clue (not available on Difficult)"}
          />
          {noHints && <span className="help">Difficult items have no hints, so none is saved.</span>}
        </div>
        <div className="field full">
          <label htmlFor="qx">Explanation *</label>
          <textarea
            className="input"
            id="qx"
            rows={2}
            maxLength={500}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Shown to the student after answering"
          />
        </div>
        <div className="field full !flex-row items-center gap-2.5">
          <label className="toggle">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} aria-label="Active" />
            <span />
          </label>
          <span className="font-bold">Active (included in game rounds)</span>
        </div>
      </div>
    </Modal>
  );
}

/** How the puzzle will look on the phone: letter slots per word and the scrambled tiles. */
function PuzzlePreview({ answer }: { answer: string }) {
  const words = answer
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z]/g, ""))
    .filter(Boolean);
  const letters = words.join("");
  const [seed, setSeed] = useState(0);
  const tiles = useMemo(() => scramble(letters, seed), [letters, seed]);
  const tooLong = letters.length > PUZZLE_MAX_LETTERS;

  return (
    <div className="field full">
      <label>Puzzle preview</label>
      <div className="img-drop">
        {letters ? (
          <>
            <div className="slots">
              {words.map((w, i) => (
                <div className="slot-word" key={i}>
                  {w.split("").map((_, j) => (
                    <span className="slot" key={j} />
                  ))}
                </div>
              ))}
            </div>
            <div className="tiles">
              {tiles.map((ch, i) => (
                <span className="tile" key={i}>
                  {ch}
                </span>
              ))}
            </div>
            <p className={`small mt-2.5 ${tooLong ? "font-bold text-bad" : "muted"}`}>
              {letters.length} / {PUZZLE_MAX_LETTERS} letters ·{" "}
              <button type="button" className="font-bold text-brand" onClick={() => setSeed((s) => s + 1)}>
                Shuffle again
              </button>
            </p>
          </>
        ) : (
          <p className="muted small">Type the answer to see the letter tiles.</p>
        )}
      </div>
    </div>
  );
}

/** A shuffle that avoids showing the answer unscrambled (like the server's). */
function scramble(letters: string, seed: number): string[] {
  const a = letters.split("");
  let state = seed * 9301 + letters.length * 49297 + 1;
  const rnd = (max: number) => {
    state = (state * 9301 + 49297) % 233280;
    return Math.floor((state / 233280) * max);
  };
  for (let k = 0; k < 6; k++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    if (a.length < 2 || a.join("") !== letters) break;
  }
  return a;
}
