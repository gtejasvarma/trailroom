"use client";
// The account sheet (phone) / modal (desktop): why we ask, from the prototype's gateCopy, and one
// way in, Continue with Google. Dismissible. The picture beside the title is the guest's own
// first pose at tile size, or their photo before any render exists.
import { useState } from "react";
import type { SignInResult } from "../lib/account";
import { continueWithGoogle } from "../lib/account";
import { copy } from "../lib/copy";
import { useRenderImage } from "../lib/use-render-image";
import { alertStyle, body, btnSecondary } from "../lib/ui";
import { PhotoThumb } from "./photo-thumb";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export type AccountReason = (typeof copy.account.reasons)[number];

export interface AccountContext {
  /** The pose set whose first pose is shown beside the title (reveal). */
  poseSetId?: string;
  pose?: string;
  /** Their photo, before any render exists (picknext). */
  photoThumbUrl?: string;
  /** How many poses are actually ready; the copy states it. */
  poseCount?: number;
}

function Aside({ ctx }: { ctx: AccountContext }) {
  const tile = useRenderImage(
    ctx.poseSetId ?? null,
    ctx.pose ?? null,
    Boolean(ctx.poseSetId),
    "tile",
  );
  const box = "block size-full min-h-[104px] object-cover bg-surface";
  if (ctx.poseSetId) {
    return tile.url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tile.url} alt={copy.account.tileAlt} className={box} />
    ) : (
      <span aria-hidden="true" className={box} />
    );
  }
  if (ctx.photoThumbUrl) {
    return (
      <PhotoThumb
        src={ctx.photoThumbUrl}
        alt={copy.account.photoAlt}
        className={box}
      />
    );
  }
  return <span aria-hidden="true" className={box} />;
}

export function AccountSheet({
  open,
  reason,
  context,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  reason: AccountReason;
  context: AccountContext;
  onClose: () => void;
  onSignedIn: (result: SignInResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = context.poseCount ?? 4;

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const result = await continueWithGoogle();
      onSignedIn(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.account.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={copy.account.title(reason, n)}
      subtitle={copy.account.sub(reason, n)}
      aside={<Aside ctx={context} />}
      onClose={onClose}
    >
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className={`mb-3 ${body}`}>
          {copy.account.working}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="lg"
        onClick={link}
        disabled={busy}
        className="w-full"
      >
        {copy.account.google}
      </Button>
      <p className="mt-3 text-center text-[12px] leading-[17px] text-ink-600">
        {copy.account.carryOver} {copy.account.pending(reason, n)}
      </p>
      <button
        type="button"
        onClick={onClose}
        className={`${btnSecondary} mt-2 w-full border-0`}
      >
        {copy.account.close}
      </button>
    </Sheet>
  );
}
