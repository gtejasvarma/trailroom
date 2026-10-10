"use client";
// An ask a friend sent, opened from the Asks tab: the pieces, "This one" (then "Your pick"), and
// "See it on me". Reached only for asks this person opened through a link; a revoked or expired
// ask reads as closed. Images are fetched with the person's token.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api, apiRaw } from "../lib/api";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import type { InboxDetail } from "../server/inbox";
import { AskPieces } from "./ask-pieces";
import { ButtonLink } from "./ui/button";

export function AskedScreen({ askId }: { askId: string }) {
  const [detail, setDetail] = useState<InboxDetail | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "ready">(
    "loading",
  );
  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api.inboxDetail(askId));
      setState("ready");
    } catch (e) {
      setState(
        e instanceof ApiError && e.status !== 404 ? "loading" : "missing",
      );
    }
  }, [askId]);
  useEffect(() => {
    void load();
  }, [load]);

  const pieces = detail && !detail.closed ? detail.pieces : null;
  useEffect(() => {
    if (!pieces) return;
    let cancelled = false;
    const made: string[] = [];
    void Promise.all(
      pieces.map(async (p) => {
        try {
          const res = await apiRaw(p.imageUrl);
          if (!res.ok) return;
          const url = URL.createObjectURL(await res.blob());
          made.push(url);
          if (!cancelled) setImages((cur) => ({ ...cur, [p.itemId]: url }));
        } catch {
          // The card keeps its placeholder.
        }
      }),
    );
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // The set of pieces does not change for one ask; reload only when the ask does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askId, pieces?.length]);

  async function vote(itemId: string) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await api.inboxVote(askId, itemId));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ask_closed") await load();
      else setError(copy.asked.failed);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <p role="status" className="px-4 py-6 text-[15px] leading-6 text-ink-700">
        {copy.asked.loading}
      </p>
    );
  }
  if (state === "missing" || !detail) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 md:px-10">
        <p className="text-[17px] leading-6 font-semibold text-ink">
          {copy.asked.missing}
        </p>
        <ButtonLink href="/lists?tab=asks" size="md" className="mt-3">
          {copy.asked.back}
        </ButtonLink>
      </div>
    );
  }
  if (detail.closed) {
    return (
      <div
        className="mx-auto w-full max-w-[760px] px-4 py-4 md:px-10 md:py-10"
        data-testid="ask-closed"
      >
        <h1 className="mb-1 text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
          {copy.lists.isAsking(detail.askerFirstName)}
        </h1>
        <p className="mb-1 text-[17px] leading-6 font-semibold text-ink">
          {copy.asked.closedTitle}
        </p>
        <p className="mb-4 text-[15px] leading-[22px] text-ink-700">
          {copy.asked.closedBody}
        </p>
        <ButtonLink href="/lists?tab=asks" variant="outline" size="md">
          {copy.asked.back}
        </ButtonLink>
      </div>
    );
  }

  const voted = detail.myVote
    ? detail.pieces.find((p) => p.itemId === detail.myVote)
    : undefined;
  return (
    <div className="rise mx-auto w-full max-w-[760px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <h1 className="mb-1 text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
        {copy.lists.isAsking(detail.askerFirstName)}
      </h1>
      {detail.question ? (
        <p
          className="mb-4 text-[15px] leading-[22px] text-ink-700"
          data-testid="ask-question-text"
        >
          {detail.question}
        </p>
      ) : (
        <div className="mb-4" />
      )}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-md bg-danger-bg px-4 py-3 text-[14px] leading-5 text-danger"
        >
          {error}
        </p>
      ) : null}
      <AskPieces
        view={detail}
        src={(id) => images[id] ?? null}
        onVote={(id) => void vote(id)}
        busy={busy}
        voteLabel={copy.asked.thisOne}
        pickLabel={copy.asked.yourPick}
      />
      {voted ? (
        <section
          className="rise mt-5 rounded-lg border border-line p-3.5"
          data-testid="asked-voted"
        >
          <p className="mb-1 text-[15px] leading-[21px] font-semibold text-ink">
            {copy.asked.sent(detail.askerFirstName)}
          </p>
          <p className="mb-3 text-[14px] leading-5 text-ink-700">
            {copy.asked.sub}
          </p>
          <Link
            href={paths.item(voted.itemId)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-[15px] leading-none font-semibold text-canvas"
          >
            {copy.asked.seeItOnMe}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
