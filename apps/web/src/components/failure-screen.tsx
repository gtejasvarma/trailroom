"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { closestThree, getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths, startTryOnPath } from "../lib/flow";
import {
  alertStyle,
  body,
  btnPrimary,
  btnSecondary,
  h1,
  h2,
  page,
} from "../lib/ui";
import { ItemCard } from "./item-card";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      router.push(await startTryOnPath(itemId));
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.errors.generic);
      setBusy(false);
    }
  }

  const text = {
    not_ready:
      item?.tryOn === "not_yet"
        ? [
            copy.failure.notYetTitle,
            copy.failure.notYetBody((item.readinessReasons ?? []).join(" ")),
          ]
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
  const tryAgain = (
    <button
      type="button"
      onClick={retry}
      disabled={busy}
      className={btnPrimary}
    >
      {copy.failure.tryAgain}
    </button>
  );

  return (
    <div
      className={`${page} max-w-[900px]`}
      data-testid="honest-failure"
      data-kind={kind}
      data-try-on={item?.tryOn}
    >
      <h1 className={h1}>{text[0]}</h1>
      <p className={`mt-3 max-w-[60ch] ${body}`}>{text[1]}</p>
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {kind === "render_failed" ? (
          <>
            {tryAgain}
            <Link href={paths.photo(itemId)} className={btnSecondary}>
              {copy.failure.differentPhoto}
            </Link>
          </>
        ) : null}
        {kind === "internal" ? tryAgain : null}
        {kind === "capacity" || kind === "daily_limit" ? (
          <Link href={paths.catalogue} className={btnPrimary}>
            {copy.failure.toCatalogue}
          </Link>
        ) : null}
      </div>
      {showClosest ? (
        <section className="mt-10" aria-labelledby="closest-heading">
          <h2 id="closest-heading" className={h2}>
            {copy.failure.closestTitle}
          </h2>
          <ul className="mt-4 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 md:gap-5">
            {closestThree(itemId).map((i) => (
              <li key={i.id}>
                <ItemCard item={i} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
