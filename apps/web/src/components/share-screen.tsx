"use client";
// The share screen. Before the link exists it says, in one plain sentence, what making it does
// (the explicit act that shows these pieces to anyone with the link). Then: the link, Copy link,
// and Share where the browser has the Web Share API (that is how Messages and WhatsApp are reached
// on a phone; there are no pretend app buttons). The link is shown here only: the server keeps
// just its hash.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getItem, type CatalogItem } from "@trailroom/catalog";
import { ApiError, api } from "../lib/api";
import { rememberAskLink } from "../lib/ask-links";
import { copy } from "../lib/copy";
import { alertStyle } from "../lib/ui";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { ShareThumb } from "./share-thumb";
import { Button, ButtonLink } from "./ui/button";
import { useToast } from "./ui/toast";

const MAX_ASK_ITEMS = 4;
const QUESTION_MAX = 120;

export function ShareScreen({ listId }: { listId: string }) {
  const say = useToast();
  const { loaded: meLoaded, isGuest, tryOns } = useMe();
  const { loaded, lists, refresh } = useLists();
  const list = lists.find((l) => l.id === listId);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ askId: string; url: string } | null>(
    null,
  );
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  if (!meLoaded || (!isGuest && !loaded)) {
    return (
      <p role="status" className="px-4 py-6 text-[15px] leading-6 text-ink-700">
        {copy.lists.loading}
      </p>
    );
  }
  if (!list || list.itemIds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 py-6 md:px-10">
        <p className="text-[17px] leading-6 font-semibold text-ink">
          {copy.listPage.missing}
        </p>
        <ButtonLink href="/lists" size="md" className="mt-3">
          {copy.listPage.missingAction}
        </ButtonLink>
      </div>
    );
  }

  const ids = chosen ?? list.itemIds.slice(0, MAX_ASK_ITEMS);
  const items = ids
    .map((id) => getItem(id))
    .filter((i): i is CatalogItem => i !== undefined);
  const tooMany = list.itemIds.length > MAX_ASK_ITEMS;
  const tooLong = question.length > QUESTION_MAX;

  async function create() {
    if (!list || busy || tooLong || ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createAsk(list.id, ids, question.trim() || undefined);
      rememberAskLink(r.askId, r.url);
      setCreated(r);
      void refresh();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "ask_limit"
          ? copy.share.limit
          : copy.share.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      say(copy.toasts.linkCopied);
    } catch {
      say(copy.toasts.linkCopyFailed);
    }
  }

  async function shareLink() {
    if (!created || !list) return;
    try {
      await navigator.share({
        title: copy.share.shareTitle(list.name),
        text: copy.share.shareText(list.name),
        url: created.url,
      });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  }

  const path = created ? new URL(created.url).pathname : "";
  return (
    <div className="rise mx-auto w-full max-w-[560px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
        {created
          ? copy.share.readyTitle
          : items.length === 1
            ? copy.share.titleOne
            : copy.share.title}
      </h1>
      <p className="mb-4 text-[15px] leading-[22px] text-ink-700">
        {list.name}
      </p>

      <div className="rounded-[20px] border border-line bg-surface p-3.5">
        <ul
          aria-label={copy.share.previewLabel}
          className="m-0 mb-3.5 grid list-none gap-2 p-0"
          style={{
            gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item) => (
            <li key={item.id}>
              <ShareThumb
                item={item}
                tryOn={
                  isGuest ? undefined : tryOns.find((t) => t.itemId === item.id)
                }
              />
            </li>
          ))}
        </ul>

        {created ? (
          <>
            <label
              className="mb-1 block text-[12px] leading-4 text-ink-700"
              htmlFor="ask-link"
            >
              {copy.share.linkLabel}
            </label>
            <input
              id="ask-link"
              readOnly
              value={created.url}
              onFocus={(e) => e.currentTarget.select()}
              data-testid="ask-link"
              className="mb-3 h-12 w-full rounded-[12px] border border-line bg-canvas px-3 text-[14px] text-ink"
            />
            <div className="flex gap-2.5">
              <Button
                size="lg"
                onClick={() => void copyLink()}
                className="flex-1"
                data-testid="copy-link"
              >
                {copy.share.copy}
              </Button>
              {canShare ? (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void shareLink()}
                  className="flex-1"
                  data-testid="share-link"
                >
                  {copy.share.share}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {tooMany ? (
              <fieldset className="mb-3.5 border-0 p-0">
                <legend className="mb-1.5 text-[13px] leading-[18px] text-ink-700">
                  {copy.share.pickUpTo}
                </legend>
                {list.itemIds.map((id) => {
                  const it = getItem(id);
                  if (!it) return null;
                  const on = ids.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex min-h-11 items-center gap-2 text-[14px] text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && ids.length >= MAX_ASK_ITEMS}
                        onChange={() =>
                          setChosen(
                            on ? ids.filter((x) => x !== id) : [...ids, id],
                          )
                        }
                        className="size-5"
                      />
                      {it.name}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
            <p
              className="mb-3 text-[14px] leading-5 text-ink"
              data-testid="share-sentence"
            >
              {copy.share.sentence}
            </p>
            <label
              className="mb-1 block text-[12px] leading-4 text-ink-700"
              htmlFor="ask-question"
            >
              {copy.share.questionLabel}
            </label>
            <input
              id="ask-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={copy.share.questionPlaceholder}
              data-testid="ask-question"
              className="mb-3 h-12 w-full rounded-[12px] border border-line bg-canvas px-3 text-[15px] text-ink placeholder:text-ink-600"
            />
            {tooLong ? (
              <p role="alert" className={`mb-3 ${alertStyle}`}>
                {copy.share.questionLimit}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className={`mb-3 ${alertStyle}`}>
                {error}
              </p>
            ) : null}
            <Button
              size="lg"
              disabled={busy || tooLong || ids.length === 0}
              onClick={() => void create()}
              className="w-full"
              data-testid="create-link"
            >
              {busy ? copy.share.creating : copy.share.create}
            </Button>
          </>
        )}
      </div>

      {created ? (
        <>
          <p className="mt-4 text-center text-[14px] leading-5 text-ink-700">
            {copy.share.afterNote}
          </p>
          <div className="mt-3 flex flex-col items-center">
            <Link
              href={`/asks/${created.askId}`}
              data-testid="see-votes"
              className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent"
            >
              {copy.share.seeVotes}
            </Link>
            <Link
              href={path}
              data-testid="see-page"
              className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent"
            >
              {copy.share.seePage}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
