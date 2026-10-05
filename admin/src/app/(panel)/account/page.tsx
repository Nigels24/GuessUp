"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, PasswordInput, useFeedback } from "@/components/ui";
import { apiFetch, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PHOTO_TYPES, photoProblem, squarePhoto } from "@/lib/photo";

/** Same rule as the API (api/src/me/me.rules.ts). */
const ADMIN_PASSWORD_MIN = 10;

/**
 * My account: the signed-in administrator's photo, name and password
 * (POST/DELETE /api/me/avatar, PATCH /api/me, POST /api/me/password).
 */
export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <div className="page-head">
        <div>
          <h2>My account</h2>
          <p>Your photo, name and password for the Administrator Panel.</p>
        </div>
      </div>
      <div className="grid max-w-[980px] gap-[18px] min-[1001px]:grid-cols-2">
        <ProfileSection user={user} />
        <PasswordSection />
      </div>
    </>
  );
}

function ProfileSection({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const { toast } = useFeedback();
  const [fullName, setFullName] = useState(user.fullName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const name = fullName.trim();
  const unchanged = name === user.fullName;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.length < 2) return setError("Enter your full name (at least 2 characters).");
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<User>("/me", { method: "PATCH", body: { fullName: name } });
      updateUser(updated);
      setFullName(updated.fullName);
      toast("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void save(e)} noValidate>
      <div className="panel-head">
        <h3>Profile</h3>
      </div>
      <div className="panel-body">
        <PhotoField user={user} />
        <div className="field">
          <label htmlFor="acc-name">Full name</label>
          <input className="input" id="acc-name" value={fullName} maxLength={80} autoComplete="name" onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-email">Email address</label>
          <input className="input" id="acc-email" value={user.email} disabled readOnly />
          <span className="help">The sign-in email cannot be changed here.</span>
        </div>
        <div className="error-text" role="alert">
          {error}
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving || unchanged}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

/**
 * The profile photo: Upload / Change / Remove. The picked image is checked and
 * cropped to a 512×512 JPEG in the browser, shown at once as a preview, then
 * uploaded; the header avatar follows through updateUser.
 */
function PhotoField({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const { confirm, toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The preview is a local object URL; release it when replaced.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still fires
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      const photo = await squarePhoto(file);
      setPreview(URL.createObjectURL(photo));
      const form = new FormData();
      form.append("file", photo, "avatar.jpg");
      updateUser(await apiFetch<User>("/me/avatar", { method: "POST", body: form }));
      toast("Photo updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the photo.");
    } finally {
      setPreview(null);
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Remove your photo?",
      message: "Your initials will be shown instead.",
      okText: "Remove photo",
      danger: true,
    });
    if (!ok) return;
    setError("");
    setBusy(true);
    try {
      await apiFetch<null>("/me/avatar", { method: "DELETE" });
      updateUser({ ...user, avatarUrl: null });
      toast("Photo removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  const hasPhoto = Boolean(user.avatarUrl);
  return (
    <div className="field">
      <label>Photo</label>
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative">
          <Avatar
            name={user.fullName}
            src={preview ?? user.avatarUrl}
            className="!h-20 !w-20 !rounded-full !text-2xl"
          />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-[rgba(20,14,60,.45)]" role="status" aria-label="Saving photo">
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
            </span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Saving…" : hasPhoto ? "Change photo" : "Upload photo"}
          </button>
          {hasPhoto && (
            <button type="button" className="btn btn-ghost btn-sm text-[#DC2626]" disabled={busy} onClick={() => void remove()}>
              Remove photo
            </button>
          )}
        </div>
        <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" onChange={(e) => void pick(e)} aria-label="Choose a photo" />
      </div>
      <span className="help">JPG, PNG or WebP, up to 15 MB. It is cropped to a square and resized before upload.</span>
      {error && (
        <div className="error-text mt-1.5" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  /** The client-side checks; the server checks the same and the current password. */
  function problem(): string | null {
    if (!current || !next || !confirm) return "Fill in all three password fields.";
    if (next.length < ADMIN_PASSWORD_MIN) return `The new password must be at least ${ADMIN_PASSWORD_MIN} characters.`;
    if (next !== confirm) return "The new passwords do not match.";
    if (next === current) return "The new password must be different from the current password.";
    return null;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    const p = problem();
    if (p) return setError(p);
    setSaving(true);
    setError("");
    try {
      await apiFetch<null>("/me/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      // A wrong current password is a 400 with the server's message; never log the fields.
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void save(e)} noValidate>
      <div className="panel-head">
        <h3>Change password</h3>
      </div>
      <div className="panel-body">
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <PasswordInput id="pw-current" name="currentPassword" value={current} onChange={setCurrent} autoComplete="current-password" disabled={saving} />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <PasswordInput id="pw-new" name="newPassword" value={next} onChange={setNext} autoComplete="new-password" disabled={saving} />
          <span className="help">At least {ADMIN_PASSWORD_MIN} characters, different from the current one.</span>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <PasswordInput id="pw-confirm" name="confirmPassword" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={saving} />
        </div>
        {done ? (
          <p className="mb-3.5 min-h-[18px] text-[13px] font-bold text-[#15803D]" role="status">
            ✓ Password changed. Use the new password the next time you sign in.
          </p>
        ) : (
          <div className="error-text" role="alert">
            {error}
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
