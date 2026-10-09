"use client";
// The honest-failure screen (the prototype's `fail`): the piece with a plain statement of what
// happened, exactly the actions that fit the case, and for pieces we cannot show, the closest
// three we can put on you, each one tap into its try-on. No email promise: none is sent in V0.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { catalogUrl, closestThree, getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { alertStyle, btnPrimary, btnSecondary, labelStyle } from "../lib/ui";

export type FailureKind =
  "not_ready" | "render_failed" | "capacity" | "daily_limit" | "internal";

export function failureKindOf(code: string | undefined): FailureKind {
  return code === "not_ready" || code === "render_failed" || code === "capacity"
    ? code
    : "internal";
}

/** The honest-failure screen: says plainly what happened, with exactly the actions for the case. */
export function FailureScreen({
  kind,
  itemId,
}: {
  kind: FailureKind;
  itemId: string;
}) {
  const router = useRouter();
  const item = getItem(itemId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(id: string) {
    setBusy(id);
    setError(null);
    try {
      router.push(await startTryOnPath(id));
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
    }
  }

  const what = item?.shopCategory ?? "";
  const [title, line] = {
    not_ready:
      item?.tryOn === "not_yet"
        ? [copy.failure.notYetTitle(what), copy.failure.notYetBody(what)]
        : [
            copy.failure.notReadyTitle,
            copy.failure.notReadyBody((item?.readinessReasons ?? []).join(" ")),
          ],
    render_failed: [
      copy.failure.renderFailedTitle,
      copy.failure.renderFailedBody,
    ],
    capacity: [copy.failure.capacityTitle, copy.failure.capacityBody],
    daily_limit: [copy.failure.dailyLimitTitle, copy.failure.dailyLimitBody],
    internal: [copy.failure.internalTitle, copy.failure.internalBody],
  }[kind];

  const showClosest = kind === "not_ready" || kind === "render_failed";
  const photo = item?.photos[0];

  return (
    <div
      className="rise mx-auto w-full max-w-[720px] px-4 py-4 md:px-8 md:py-10"
      data-testid="honest-failure"
      data-kind={kind}
      data-try-on={item?.tryOn}
    >
      <div className="mb-[18px] flex items-start gap-3 rounded-lg border border-line p-3.5">
        {photo ? (
          <span className="block aspect-[3/4] w-14 flex-none overflow-hidden rounded-sm bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catalogUrl(photo.file)}
              alt={copy.failure.pieceAlt(item!.name)}
              className="size-full object-cover"
              style={{ objectPosition: photo.focus }}
            />
          </span>
        ) : null}
        <div className="flex-1">
          <h1 className="text-[17px] leading-[23px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-ink-700">{line}</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className={`mb-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {kind === "render_failed" || kind === "internal" ? (
          <button
            type="button"
            onClick={() => void start(itemId)}
            disabled={busy !== null}
            className={btnPrimary}
          >
            {copy.failure.tryAgain}
          </button>
        ) : null}
        {kind === "render_failed" ? (
          <Link href={paths.library(itemId)} className={btnSecondary}>
            {copy.failure.differentPhoto}
          </Link>
        ) : null}
        {kind === "capacity" || kind === "daily_limit" ? (
          <Link href={paths.catalogue} className={btnPrimary}>
            {copy.failure.toCatalogue}
          </Link>
        ) : null}
      </div>

      {showClosest ? (
        <section className="mt-6" aria-labelledby="closest-heading">
          <h2 id="closest-heading" className={`mb-2.5 ${labelStyle}`}>
            {copy.failure.closestTitle}
          </h2>
          <ul
            data-testid="closest"
            className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 md:gap-5"
          >
            {closestThree(itemId).map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void start(i.id)}
                  aria-label={copy.failure.closestLabel(i.name)}
                  className="block w-full text-left disabled:opacity-60"
                >
                  <span className="block aspect-[3/4] overflow-hidden rounded-md bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={catalogUrl(i.photos[0]!.file)}
                      alt=""
                      className="size-full object-cover"
                      style={{ objectPosition: i.photos[0]!.focus }}
                    />
                  </span>
                  <span className="mt-1.5 block truncate text-[12px] leading-4 text-ink-700">
                    {i.name}
                  </span>
                  <span className="block text-[12px] leading-4 text-ink tabular-nums">
                    {copy.item.price(i.priceUsd)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
