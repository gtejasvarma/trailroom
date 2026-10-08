"use client";
import { useState } from "react";
import { continueWithGoogle } from "../lib/account";
import { copy } from "../lib/copy";
import { alertStyle, body, btnPrimary, btnSecondary } from "../lib/ui";
import { Sheet } from "./ui/sheet";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Sheet open={open} title={copy.account.title(poseCount)} onClose={onClose}>
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
    </Sheet>
  );
}
