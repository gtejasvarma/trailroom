"use client";
// The Lists tab: "My lists" and "Asks" (the prototype's segmented control). Lists are the
// signed-in person's; a guest is told what a list is and the New list control asks them to sign
// in. Asks are the ones friends sent that they opened; the unread dot says one is waiting.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getItem, startWithThese } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { leader, shares, totalVotes } from "../lib/votes";
import type { AskSummary } from "../server/asks";
import type { InboxSummary } from "../server/inbox";
import type { ListBody } from "../server/lists";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { PieceThumbs } from "./piece-thumbs";
import { useSaveToList } from "./save-to-list";
import { Button } from "./ui/button";

const card =
  "flex w-full items-center gap-3 rounded-lg border bg-canvas p-3 text-left";

function VoteLine({ ask }: { ask: AskSummary }) {
  const counts = ask.itemIds.map((id) => ask.counts[id] ?? 0);
  const total = totalVotes(ask.itemIds, ask.counts);
  const ahead = leader(ask.itemIds, ask.counts);
  const pct = total === 0 ? 0 : Math.max(...shares(counts));
  return (
    <>
      <span
        aria-hidden="true"
        className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line-soft"
      >
        <span className="block h-full bg-ink" style={{ width: `${pct}%` }} />
      </span>
      <span
        data-testid="vote-line"
        className="mt-[5px] block text-[12px] leading-4 text-ink-600"
      >
        {total === 0
          ? copy.lists.noVotes
          : copy.lists.voteLine(
              total,
              ahead ? (getItem(ahead)?.name ?? "") : "",
            )}
      </span>
    </>
  );
}

function ListCard({ list, ask }: { list: ListBody; ask?: AskSummary }) {
  const live = ask?.state === "live" ? ask : undefined;
  return (
    <Link
      href={`/lists/${list.id}`}
      data-testid="list-card"
      data-list={list.id}
      aria-label={copy.lists.openLabel(list.name)}
      className={`${card} border-line`}
    >
      <PieceThumbs itemIds={list.itemIds} />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5 font-semibold text-ink">
          {list.name}
        </span>
        <span
          className={`block text-[13px] leading-[18px] ${
            list.itemIds.length ? "text-accent-dark" : "text-ink-600"
          }`}
        >
          {copy.lists.pieces(list.itemIds.length)}
          {live
            ? ` · ${copy.lists.sharedWith}`
            : list.itemIds.length
              ? ` · ${copy.lists.readyToAsk}`
              : ""}
        </span>
        {live ? <VoteLine ask={live} /> : null}
      </span>
      <span aria-hidden="true" className="flex-none text-[16px] text-ink-500">
        →
      </span>
    </Link>
  );
}

function AskCard({ entry }: { entry: InboxSummary }) {
  const voted = entry.votedItemId ? getItem(entry.votedItemId) : undefined;
  const status = entry.closed
    ? copy.lists.closed
    : voted
      ? copy.lists.youPicked(voted.name)
      : copy.lists.waiting;
  return (
    <Link
      href={`/asked/${entry.askId}`}
      data-testid="ask-card"
      data-unread={entry.unread ? "true" : "false"}
      aria-label={copy.lists.askLabel(entry.askerFirstName)}
      className={`${card} ${entry.unread ? "border-ink" : "border-line"}`}
    >
      <PieceThumbs itemIds={entry.itemIds} width={40} />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5 font-semibold text-ink">
          {copy.lists.isAsking(entry.askerFirstName)}
        </span>
        <span className="block truncate text-[13px] leading-[18px] text-ink-600">
          {entry.question ?? status}
        </span>
        {entry.question ? (
          <span className="block text-[12px] leading-4 text-ink-600">
            {status}
          </span>
        ) : null}
      </span>
      {entry.unread ? (
        <span
          data-testid="unread-dot"
          aria-hidden="true"
          className="size-[9px] flex-none rounded-full bg-danger"
        />
      ) : null}
    </Link>
  );
}

export function ListsView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "asks" ? "asks" : "mine";
  const { loaded: meLoaded, isGuest } = useMe();
  const { loaded, failed, lists, inbox, unread, askFor, refresh } = useLists();
  const save = useSaveToList();
  const start = startWithThese()[0];

  const pick = (next: "mine" | "asks") =>
    router.replace(next === "asks" ? "/lists?tab=asks" : "/lists", {
      scroll: false,
    });
  const seg = (active: boolean) =>
    `flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[14px] leading-none font-semibold ${
      active ? "bg-canvas text-ink shadow-1" : "text-ink-700"
    }`;

  const waiting = !meLoaded || (!isGuest && !loaded);

  return (
    <div className="rise mx-auto w-full max-w-[760px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <h1 className="mb-3 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
        {copy.lists.title}
      </h1>
      <div
        role="tablist"
        aria-label={copy.lists.tabsLabel}
        className="mb-4 flex gap-1.5 rounded-[12px] bg-surface p-[3px]"
      >
        <button
          type="button"
          role="tab"
          id="tab-mine"
          aria-selected={tab === "mine"}
          aria-controls="panel-lists"
          onClick={() => pick("mine")}
          className={seg(tab === "mine")}
        >
          {copy.lists.tabMine}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-asks"
          aria-selected={tab === "asks"}
          aria-controls="panel-lists"
          onClick={() => pick("asks")}
          className={seg(tab === "asks")}
        >
          {copy.lists.tabAsks}
          {unread > 0 ? (
            <span
              data-testid="asks-badge"
              role="img"
              aria-label={copy.lists.unread(unread)}
              className="grid size-[18px] place-items-center rounded-full bg-danger text-[10px] font-bold text-canvas"
            >
              {unread}
            </span>
          ) : null}
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-lists"
        aria-labelledby={tab === "mine" ? "tab-mine" : "tab-asks"}
      >
        {waiting ? (
          <p role="status" className="text-[15px] leading-6 text-ink-700">
            {copy.lists.loading}
          </p>
        ) : failed ? (
          <div className="rounded-lg border border-line p-[18px]">
            <p className="text-[15px] leading-[22px] text-ink-700">
              {copy.lists.loadFailed}
            </p>
            <Button
              variant="outline"
              size="md"
              className="mt-3"
              onClick={() => void refresh()}
            >
              {copy.lists.retry}
            </Button>
          </div>
        ) : tab === "mine" ? (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[13px] leading-[18px] text-ink-600">
                {copy.lists.count(isGuest ? 0 : lists.length)}
              </p>
              <button
                type="button"
                onClick={() => save(null)}
                className="min-h-11 text-[14px] font-semibold text-accent"
              >
                {copy.lists.create}
              </button>
            </div>
            {isGuest || lists.length === 0 ? (
              <div
                className="rounded-lg border border-line p-[18px]"
                data-testid="lists-empty"
              >
                <p className="text-[15px] leading-[22px] text-ink-700">
                  {copy.lists.intro}
                </p>
                {isGuest ? (
                  <p className="mt-2 text-[14px] leading-5 text-ink-600">
                    {copy.lists.guestNote}
                  </p>
                ) : null}
                {!isGuest && start ? (
                  <Button
                    size="md"
                    className="mt-4"
                    onClick={() => save(start.id)}
                  >
                    {copy.lists.emptyAction(start.name)}
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul
                aria-label={copy.lists.gridLabel}
                className="m-0 flex list-none flex-col gap-3 p-0"
              >
                {lists.map((l) => (
                  <li key={l.id}>
                    <ListCard list={l} ask={askFor(l.id)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-[13px] leading-[18px] text-ink-600">
              {copy.lists.asksIntro}
            </p>
            {isGuest || inbox.length === 0 ? (
              <div
                className="rounded-lg border border-line p-[18px]"
                data-testid="asks-empty"
              >
                <p className="text-[15px] leading-[22px] text-ink-700">
                  {copy.lists.asksEmpty}
                </p>
              </div>
            ) : (
              <ul
                aria-label={copy.lists.asksGrid}
                className="m-0 flex list-none flex-col gap-3 p-0"
              >
                {inbox.map((a) => (
                  <li key={a.askId}>
                    <AskCard entry={a} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
