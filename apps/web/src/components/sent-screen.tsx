"use client";
// Sent: where each piece stands. Vote bars with counts and percentages, refreshed while the page
// is open and on every visit. Only counts: nothing here says who voted. The link itself is not
// kept by the server, so it is offered again only on the device that made it.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getItem, type CatalogItem } from "@trailroom/catalog";
import { api } from "../lib/api";
import { forgetAskLink, recallAskLink } from "../lib/ask-links";
import { copy } from "../lib/copy";
import { leader, shareLabel, shares, totalVotes } from "../lib/votes";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { PieceThumbs } from "./piece-thumbs";
import { Button, ButtonLink } from "./ui/button";
import { useBuy } from "./use-buy";
import { useToast } from "./ui/toast";

const POLL_MS = 8000;

export function SentScreen({ askId }: { askId: string }) {
  const say = useToast();
  const buy = useBuy();
  const { loaded: meLoaded, isGuest } = useMe();
  const { loaded, asks, refresh } = useLists();
  const ask = asks.find((a) => a.askId === askId);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLink(recallAskLink(askId)), [askId]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  if (!meLoaded || (!isGuest && !loaded)) {
    return (
      <p role="status" className="px-4 py-6 text-[15px] leading-6 text-ink-700">
        {copy.sent.loading}
      </p>
    );
  }
  if (!ask) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 py-6 md:px-10">
        <p className="text-[17px] leading-6 font-semibold text-ink">
          {copy.sent.missing}
        </p>
        <ButtonLink href="/lists" size="md" className="mt-3">
          {copy.sent.missingAction}
        </ButtonLink>
      </div>
    );
  }

  const items = ask.itemIds
    .map((id) => getItem(id))
    .filter((i): i is CatalogItem => i !== undefined);
  const counts = items.map((i) => ask.counts[i.id] ?? 0);
  const pcts = shares(counts);
  const total = totalVotes(ask.itemIds, ask.counts);
  const ahead = leader(ask.itemIds, ask.counts);
  const winner = (ahead ? getItem(ahead) : undefined) ?? items[0];
  const live = ask.state === "live";
  const days = Math.max(
    0,
    Math.ceil((new Date(ask.expiresAt).getTime() - Date.now()) / 86_400_000),
  );

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      say(copy.toasts.linkCopied);
    } catch {
      say(copy.toasts.linkCopyFailed);
    }
  }

  async function switchOff() {
    setBusy(true);
    try {
      await api.revokeAsk(askId);
      forgetAskLink(askId);
      setLink(null);
      await refresh();
      say(copy.toasts.linkSwitchedOff);
    } catch {
      say(copy.toasts.listFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise mx-auto w-full max-w-[560px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
        {total > 0 ? copy.sent.titleVotes : copy.sent.title}
      </h1>
      <p className="mb-1 text-[13px] leading-[18px] text-ink-600">
        {ask.listName}
      </p>
      <p
        className="mb-[18px] text-[15px] leading-[22px] text-ink-700"
        data-testid="sent-sub"
      >
        {!live
          ? copy.sent.subClosed
          : total > 0
            ? copy.sent.subVotes
            : copy.sent.sub}
      </p>

      <ul className="m-0 mb-2 list-none p-0" data-testid="vote-rows">
        {items.map((item, i) => (
          <li
            key={item.id}
            data-testid="vote-row"
            data-item={item.id}
            data-count={counts[i]}
            className="mb-3.5 flex items-center gap-3"
          >
            <PieceThumbs itemIds={[item.id]} width={64} max={1} />
            <span className="block min-w-0 flex-1">
              <span className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] leading-[19px] text-ink">
                  {item.name}
                </span>
                <span
                  data-testid="vote-pct"
                  className="text-[14px] leading-[19px] font-semibold text-ink tabular-nums"
                >
                  {shareLabel(counts[i]!, pcts[i]!)}
                </span>
              </span>
              <span
                role="img"
                aria-label={copy.sent.barLabel(
                  item.name,
                  shareLabel(counts[i]!, pcts[i]!),
                )}
                className="block h-2 overflow-hidden rounded-full bg-line-soft"
              >
                <span
                  className={`block h-full transition-[width] duration-500 ease-brand ${
                    i === 0 ? "bg-ink" : "bg-ink-400"
                  }`}
                  style={{ width: `${pcts[i]}%` }}
                />
              </span>
              <span
                className="mt-1.5 block text-[12px] leading-4 text-ink-600"
                data-testid="vote-count"
              >
                {counts[i] === 0
                  ? copy.sent.rowNone
                  : copy.sent.rowVotes(counts[i]!)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {winner ? (
        <Button
          size="lg"
          onClick={() => buy(winner.id)}
          className="mt-2 w-full"
        >
          {copy.sent.buy(winner.name)}
        </Button>
      ) : null}

      <div className="mt-3 flex flex-col items-center gap-0.5">
        {live ? (
          <>
            <p className="text-[13px] leading-[18px] text-ink-600">
              {copy.sent.closes(days)}
            </p>
            {link ? (
              <>
                <Link
                  href={new URL(link).pathname}
                  data-testid="see-page"
                  className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent"
                >
                  {copy.sent.seePage}
                </Link>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent"
                >
                  {copy.sent.copy}
                </button>
              </>
            ) : (
              <>
                <p
                  className="mt-1 text-center text-[13px] leading-[18px] text-ink-600"
                  data-testid="no-link"
                >
                  {copy.sent.noLink}
                </p>
                <ButtonLink
                  href={`/lists/${ask.listId}/share`}
                  variant="outline"
                  size="md"
                  className="mt-1"
                >
                  {copy.sent.newLink}
                </ButtonLink>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void switchOff()}
              data-testid="switch-off"
              className="inline-flex min-h-11 items-center text-[14px] font-medium text-danger"
            >
              {copy.sent.switchOff}
            </button>
          </>
        ) : (
          <>
            <p
              className="text-[13px] leading-[18px] text-ink-600"
              data-testid="switched-off"
            >
              {copy.sent.switchedOff}
            </p>
            <ButtonLink
              href={`/lists/${ask.listId}/share`}
              variant="outline"
              size="md"
              className="mt-1"
            >
              {copy.sent.newLink}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
