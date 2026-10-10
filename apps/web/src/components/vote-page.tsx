"use client";
// The public vote page. Open to anyone with the link: no password, no account. A friend sees who
// is asking, the question, each piece as a large card and "This one"; after voting, the split and
// two ways into the app (which is behind the password gate for now). If the person happens to be
// signed in, their token rides along so the ask lands in their Asks tab; nobody is signed in by
// this page and nothing is created for a visitor.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { copy } from "../lib/copy";
import { peekUser } from "../lib/firebase";
import type { AskView } from "../server/ask-view";
import { AskPieces } from "./ask-pieces";
import { Button } from "./ui/button";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span
        aria-hidden="true"
        className="grid size-[22px] place-items-center rounded-[6px] bg-ink text-[12px] font-bold text-canvas"
      >
        {copy.brand.slice(0, 1)}
      </span>
      <span className="text-[14px] font-semibold tracking-[0.06em] text-ink uppercase">
        {copy.brand}
      </span>
    </span>
  );
}

async function headers(): Promise<Headers> {
  const h = new Headers();
  try {
    const user = await peekUser();
    // A guest session is not an identity here: only a real account is attached.
    if (user && !user.isAnonymous)
      h.set("Authorization", `Bearer ${await user.getIdToken()}`);
  } catch {
    // No account: vote as a visitor.
  }
  return h;
}

export function VotePage({ token }: { token: string }) {
  const [view, setView] = useState<AskView | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "closed" | "ready">(
    "loading",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/ask/${token}`, {
        headers: await headers(),
        cache: "no-store",
        credentials: "same-origin",
      });
      if (res.status === 404 || res.status === 410) return setState("closed");
      if (!res.ok) return setState("failed");
      setView((await res.json()) as AskView);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function vote(itemId: string) {
    setBusy(true);
    setError(null);
    try {
      const h = await headers();
      h.set("Content-Type", "application/json");
      const res = await fetch(`/api/ask/${token}/vote`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ itemId }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 410) return setState("closed");
      if (res.status === 429) return setError(copy.vote.tooMany);
      if (res.status === 409) return setError(copy.vote.full);
      if (!res.ok) return setError(copy.vote.failed);
      setView((await res.json()) as AskView);
    } catch {
      setError(copy.vote.failed);
    } finally {
      setBusy(false);
    }
  }

  const voted = view?.myVote
    ? view.pieces.find((p) => p.itemId === view.myVote)
    : undefined;
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-5 pb-10 md:px-8 md:pt-9">
      <Brand />
      {state === "loading" ? (
        <p role="status" className="mt-6 text-[15px] leading-6 text-ink-700">
          {copy.vote.loading}
        </p>
      ) : null}
      {state === "failed" ? (
        <div className="mt-6">
          <p className="mb-3 text-[15px] leading-[22px] text-ink-700">
            {copy.vote.loadFailed}
          </p>
          <Button variant="outline" size="md" onClick={() => void load()}>
            {copy.vote.retry}
          </Button>
        </div>
      ) : null}
      {state === "closed" ? (
        <div className="mt-6" data-testid="closed">
          <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
            {copy.vote.closedTitle}
          </h1>
          <p className="text-[15px] leading-[22px] text-ink-700">
            {copy.vote.closedBody}
          </p>
        </div>
      ) : null}
      {state === "ready" && view ? (
        <>
          <h1
            data-testid="vote-title"
            className="mt-3 mb-1 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9"
          >
            {view.listName}
          </h1>
          <p
            className="mb-1 text-[15px] leading-[22px] text-ink-700"
            data-testid="vote-sub"
          >
            {copy.vote.isAsking(view.askerFirstName)}
          </p>
          {view.question ? (
            <p
              className="mb-1 text-[17px] leading-6 font-medium text-ink"
              data-testid="vote-question"
            >
              {view.question}
            </p>
          ) : null}
          <div className="mb-4" />
          {view.isAsker ? (
            <p
              className="mb-4 rounded-md bg-surface px-4 py-3 text-[14px] leading-5 text-ink-700"
              data-testid="own-note"
            >
              {copy.vote.own}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-md bg-danger-bg px-4 py-3 text-[14px] leading-5 text-danger"
            >
              {error}
            </p>
          ) : null}
          <AskPieces
            view={view}
            src={(id) =>
              view.pieces.find((p) => p.itemId === id)?.imageUrl ?? null
            }
            onVote={(id) => void vote(id)}
            busy={busy}
            voteLabel={copy.vote.thisOne}
            pickLabel={copy.vote.yourPick}
          />
          {voted ? (
            <section
              data-testid="after-vote"
              className="rise mt-7 border-t border-line-soft pt-6"
            >
              <p
                data-testid="thanks"
                className="mb-1 text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-accent uppercase"
              >
                {copy.vote.thanks(view.askerFirstName)}
              </p>
              <h2 className="mb-2 text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink md:text-[24px] md:leading-[30px]">
                {copy.vote.nowTitle(voted.name)}
              </h2>
              <p className="mb-4 text-[15px] leading-[22px] text-ink-700">
                {copy.vote.nowBody}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/item/${voted.itemId}/photo`}
                  prefetch={false}
                  data-testid="see-it-on-me"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[16px] leading-none font-semibold text-canvas"
                >
                  {copy.vote.seeItOnMe}
                </Link>
                <Link
                  href="/"
                  prefetch={false}
                  data-testid="just-browse"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-canvas px-5 text-[15px] leading-none font-medium text-ink"
                >
                  {copy.vote.browse}
                </Link>
              </div>
              <p className="mt-3 text-[12px] leading-[17px] text-ink-600">
                {copy.vote.nowNote}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
