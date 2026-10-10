"use client";
// One list: its pieces (the person's own Front render where they have a finished try-on, else
// the label's photo), rename, remove a piece, delete the list, and the ask button.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getItem, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { alertStyle } from "../lib/ui";
import { ListPiece } from "./list-piece";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { Button, ButtonLink } from "./ui/button";
import { useToast } from "./ui/toast";

export function ListPage({ listId }: { listId: string }) {
  const router = useRouter();
  const say = useToast();
  const { loaded: meLoaded, isGuest, tryOns } = useMe();
  const { loaded, lists, askFor, rename, removePiece, remove } = useLists();
  const list = lists.find((l) => l.id === listId);
  const ask = askFor(listId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!meLoaded || (!isGuest && !loaded)) {
    return (
      <p role="status" className="px-4 py-6 text-[15px] leading-6 text-ink-700">
        {copy.lists.loading}
      </p>
    );
  }
  if (!list) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 md:px-10">
        <p className="text-[17px] leading-6 font-semibold text-ink">
          {copy.listPage.missing}
        </p>
        <ButtonLink href="/lists" size="md" className="mt-3">
          {copy.listPage.missingAction}
        </ButtonLink>
      </div>
    );
  }

  const items = list.itemIds
    .map((id) => getItem(id))
    .filter((i): i is CatalogItem => i !== undefined);
  const n = items.length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !list) return;
    const r = await rename(list.id, trimmed);
    if (!r.ok) return setError(copy.toasts.listFailed);
    setError(null);
    setRenaming(false);
    say(copy.toasts.listRenamed(r.list.name));
  }

  async function drop(item: CatalogItem) {
    if (!list) return;
    const r = await removePiece(list.id, item.id);
    if (!r.ok) return setError(copy.toasts.listFailed);
    setError(null);
    say(copy.toasts.pieceRemoved(item.name));
  }

  async function destroy() {
    if (!list) return;
    const listName = list.name;
    if (await remove(list.id)) {
      say(copy.toasts.listDeleted(listName));
      router.replace("/lists");
    }
  }

  return (
    <div className="rise mx-auto w-full max-w-[1100px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <Link
        href="/lists"
        className="mb-2 hidden min-h-9 items-center text-[13px] text-ink-600 hover:text-ink md:inline-flex"
      >
        {copy.listPage.backToLists}
      </Link>
      {renaming ? (
        <form onSubmit={save} className="mb-3 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label={copy.listPage.renameLabel}
            data-testid="rename-input"
            className="h-12 min-w-0 flex-1 rounded-[12px] border border-line bg-canvas px-4 text-[17px] text-ink"
          />
          <Button type="submit" size="md" disabled={name.trim().length === 0}>
            {copy.listPage.save}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => setRenaming(false)}
          >
            {copy.listPage.cancel}
          </Button>
        </form>
      ) : (
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1
              data-testid="list-title"
              className="text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9"
            >
              {list.name}
            </h1>
            <p className="text-[13px] leading-[18px] text-ink-600">
              {copy.lists.pieces(n)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setName(list.name);
              setRenaming(true);
            }}
            className="min-h-11 flex-none text-[14px] font-semibold text-accent"
          >
            {copy.listPage.rename}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}

      {n === 0 ? (
        <div
          className="mb-5 rounded-lg border border-line p-[18px]"
          data-testid="list-empty"
        >
          <p className="text-[15px] leading-[22px] text-ink-700">
            {copy.listPage.empty}
          </p>
          <ButtonLink href="/" variant="outline" size="md" className="mt-3">
            {copy.listPage.browse}
          </ButtonLink>
        </div>
      ) : (
        <ul
          aria-label={copy.listPage.gridLabel}
          className="m-0 mb-5 grid list-none grid-cols-2 gap-x-3 gap-y-4 p-0 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-x-5 md:gap-y-6"
        >
          {items.map((item) => (
            <li key={item.id}>
              <ListPiece
                item={item}
                tryOn={
                  isGuest ? undefined : tryOns.find((t) => t.itemId === item.id)
                }
                remove={() => void drop(item)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mx-auto max-w-[480px]">
        {n === 0 ? (
          <Button size="lg" disabled className="w-full">
            {copy.listPage.askNone}
          </Button>
        ) : (
          <ButtonLink
            href={`/lists/${list.id}/share`}
            size="lg"
            data-testid="ask-button"
            className="w-full"
          >
            {n === 1 ? copy.listPage.askOne : copy.listPage.askMany}
          </ButtonLink>
        )}
        <p className="mt-3 text-center text-[12px] leading-[17px] text-ink-600">
          {copy.listPage.askNote}
        </p>
        {ask && ask.state === "live" ? (
          <p className="mt-2 text-center">
            <Link
              href={`/asks/${ask.askId}`}
              data-testid="see-votes"
              className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent"
            >
              {copy.listPage.seeVotes}
            </Link>
          </p>
        ) : null}

        <div className="mt-6 border-t border-line-soft pt-4">
          {confirming ? (
            <div role="group" aria-label={copy.listPage.delete}>
              <p className="mb-3 text-[14px] leading-5 text-ink-700">
                {copy.listPage.deleteQuestion(list.name)}
              </p>
              <div className="flex gap-2.5">
                <Button
                  size="md"
                  onClick={() => void destroy()}
                  className="flex-1"
                  data-testid="confirm-delete"
                >
                  {copy.listPage.deleteConfirm}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setConfirming(false)}
                  className="flex-1"
                >
                  {copy.listPage.keep}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              data-testid="delete-list"
              className="min-h-11 text-[14px] font-medium text-danger"
            >
              {copy.listPage.delete}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
