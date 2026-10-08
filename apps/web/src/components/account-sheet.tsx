"use client";
import { useEffect, useId, useRef, useState } from "react";
import { continueWithGoogle } from "../lib/account";
import { copy } from "../lib/copy";
import { alertStyle, body, btnPrimary, btnSecondary, h2 } from "../lib/ui";

/**
 * The one "Layer" in this build: a dismissible sheet over the finished render, gating actions
 * only. A native modal <dialog> gives the focus trap, Escape, and an inert page behind it.
 * Dismissing (close button, Escape, backdrop) leaves the renders where they were.
 */
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

/** Keeps Tab inside the sheet: from the last control it wraps to the first, and back. */
function trapTab(e: React.KeyboardEvent<HTMLDialogElement>) {
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function AccountSheet({
  open,
  poseCount,
  onClose,
  onLinked,
}: {
  open: boolean;
  /** How many poses are actually published; the title states it. */
  poseCount: number;
  onClose: () => void;
  onLinked: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      await continueWithGoogle();
      onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.account.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={trapTab}
      onClick={(e) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (e.target === ref.current) onClose();
      }}
      className="sheet m-0 mx-auto mt-auto w-full max-w-[480px] rounded-t-lg border-0 bg-canvas p-6 text-ink shadow-8"
    >
      <h2 id={titleId} className={h2}>
        {copy.account.title(poseCount)}
      </h2>
      <p className={`mt-2 ${body}`}>{copy.account.body}</p>
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className={`mt-4 ${body}`}>
          {copy.account.working}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={link}
          disabled={busy}
          className={btnPrimary}
        >
          {copy.account.google}
        </button>
        <button type="button" onClick={onClose} className={btnSecondary}>
          {copy.account.close}
        </button>
      </div>
    </dialog>
  );
}
