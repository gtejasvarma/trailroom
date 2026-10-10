"use client";
// The pieces of an ask as large cards: image, the AI caption beside any render, name and price,
// and "This one". After a vote (or for the asker) each card shows its share. Used by the public
// vote page and the in-app ask detail. Nothing is drawn on an image.
import { copy } from "../lib/copy";
import { shareLabel, shares } from "../lib/votes";
import type { AskView } from "../server/ask-view";
import { Button } from "./ui/button";

export interface AskPiecesProps {
  view: AskView;
  /** The image source for a piece (a plain URL, or a blob URL fetched with the person's token). */
  src: (itemId: string) => string | null;
  onVote: (itemId: string) => void;
  busy: boolean;
  /** Label of the vote button, and of the chosen one after voting. */
  voteLabel: string;
  pickLabel: string;
}

export function AskPieces({
  view,
  src,
  onVote,
  busy,
  voteLabel,
  pickLabel,
}: AskPiecesProps) {
  const counts = view.pieces.map((p) => view.counts?.[p.itemId] ?? 0);
  const pcts = shares(counts);
  const voted = view.myVote !== null;
  const showSplit = view.counts !== null;
  return (
    <ul
      aria-label={copy.vote.pieces}
      data-testid="ask-pieces"
      className="m-0 grid list-none gap-x-3 gap-y-5 p-0 md:gap-x-5"
      style={{
        gridTemplateColumns: `repeat(${Math.min(2, view.pieces.length)}, minmax(0, 1fr))`,
      }}
    >
      {view.pieces.map((p, i) => {
        const url = src(p.itemId);
        const mine = view.myVote === p.itemId;
        return (
          <li
            key={p.itemId}
            data-testid="ask-piece"
            data-item={p.itemId}
            data-rendered={p.rendered ? "true" : "false"}
            className="flex min-w-0 flex-col md:max-w-[300px]"
          >
            <span
              className={`block aspect-[3/4] overflow-hidden rounded-[14px] bg-surface ${
                url ? "" : "skeleton"
              }`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={
                    p.rendered
                      ? copy.vote.renderAlt(p.name, p.label)
                      : copy.vote.imageAlt(p.name, p.label)
                  }
                  data-render={p.rendered ? "" : undefined}
                  className="size-full object-cover"
                  style={{ objectPosition: "50% 30%" }}
                />
              ) : null}
            </span>
            {p.rendered ? (
              <p
                data-testid="ai-caption"
                className="mt-1.5 text-[12px] leading-4 text-ink-600"
              >
                {copy.result.aiCaption}
              </p>
            ) : null}
            <p className="mt-2.5 mb-2.5 text-[14px] leading-5 text-ink-700 md:text-center md:text-[15px] md:leading-[21px]">
              {copy.vote.pieceLine(p.name, copy.item.price(p.priceUsd))}
            </p>
            {!voted && !view.isAsker ? (
              <Button
                size="lg"
                disabled={busy}
                onClick={() => onVote(p.itemId)}
                data-testid="vote-button"
                className="w-full"
              >
                {voteLabel}
              </Button>
            ) : showSplit ? (
              <div data-testid="split-row" data-count={counts[i]}>
                <div className="mb-[7px] flex justify-between gap-2">
                  <span className="text-[14px] leading-5 text-ink-700">
                    {copy.vote.votes(counts[i]!)}
                    {mine ? ` · ${pickLabel}` : ""}
                  </span>
                  <span className="text-[14px] leading-5 font-semibold text-ink tabular-nums">
                    {voted ? `${pcts[i]}%` : shareLabel(counts[i]!, pcts[i]!)}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={copy.sent.barLabel(p.name, `${pcts[i]}%`)}
                  className="h-2 overflow-hidden rounded-full bg-line-soft"
                >
                  <div
                    className="h-full bg-ink transition-[width] duration-500 ease-brand"
                    style={{ width: `${pcts[i]}%` }}
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
