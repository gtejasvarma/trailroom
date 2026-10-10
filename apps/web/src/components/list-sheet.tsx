"use client";
// The list sheet (the prototype's "Save to a list"): the person's lists as selectable rows with a
// tick when the piece is in them (a tap toggles), a field to name a new list, "Create list and
// add", and Done. Opened from the heart on a card, "Add to a list" on a product and the result,
// and "New list" on the Lists tab (no piece: it only makes the list).
import { useState } from "react";
import { catalogUrl, getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { alertStyle } from "../lib/ui";
import type { ListBody } from "../server/lists";
import { useLists } from "./lists-provider";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";

const NAME_MAX = 60;

function Thumb({ list }: { list: ListBody }) {
  const first = list.itemIds[0] ? getItem(list.itemIds[0]) : undefined;
  const photo = first?.photos[0];
  return (
    <span className="block aspect-[3/4] w-11 flex-none overflow-hidden rounded-[8px] bg-surface">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={catalogUrl(photo.file)}
          alt=""
          className="size-full object-cover"
          style={{ objectPosition: photo.focus }}
        />
      ) : null}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-6 flex-none place-items-center rounded-full text-[12px] font-semibold text-canvas ${
        on ? "bg-accent" : "border-[1.5px] border-ink-400"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}

export function ListSheet({
  open,
  itemIds,
  onClose,
}: {
  open: boolean;
  /** The pieces to save: one from a heart or a result, several from Compare, none to only make a list. */
  itemIds: string[];
  onClose: () => void;
}) {
  const itemId = itemIds[0] ?? null;
  const say = useToast();
  const { lists, toggle, create } = useLists();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const explain = (code: string) =>
    code === "list_limit"
      ? copy.sheet.limit
      : code === "list_full"
        ? copy.sheet.full
        : copy.sheet.failed;

  async function pick(list: ListBody) {
    if (!itemId || busy) return;
    setBusy(true);
    setError(null);
    // Every piece is in it: take them out. Otherwise add the ones that are missing.
    const had = itemIds.every((id) => list.itemIds.includes(id));
    const todo = itemIds.filter((id) => list.itemIds.includes(id) === had);
    let r: Awaited<ReturnType<typeof toggle>> = { ok: true, list };
    for (const id of todo) {
      r = await toggle(list.id, id);
      if (!r.ok) break;
    }
    setBusy(false);
    if (!r.ok) return setError(explain(r.code));
    say(
      had ? copy.toasts.removedFrom(list.name) : copy.toasts.addedTo(list.name),
      had
        ? undefined
        : { label: copy.toasts.openList, href: `/lists/${list.id}` },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (trimmed.length > NAME_MAX) return setError(copy.sheet.nameTooLong);
    setBusy(true);
    setError(null);
    let r = await create(trimmed, itemId ?? undefined);
    for (const id of itemIds.slice(1)) {
      if (!r.ok) break;
      r = await toggle(r.list.id, id);
    }
    setBusy(false);
    if (!r.ok) return setError(explain(r.code));
    setName("");
    say(copy.toasts.createdList(r.list.name), {
      label: copy.toasts.openList,
      href: `/lists/${r.list.id}`,
    });
    if (!itemId) onClose();
  }

  const choosing = itemId !== null && lists.length > 0;
  return (
    <Sheet
      open={open}
      title={itemId ? copy.sheet.title : copy.lists.create}
      onClose={onClose}
    >
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      {choosing ? (
        <ul
          aria-label={copy.sheet.choices}
          data-testid="list-choices"
          className="m-0 mb-3.5 flex max-h-[38vh] list-none flex-col gap-2 overflow-y-auto p-0"
        >
          {lists.map((l) => {
            const inIt =
              itemIds.length > 0 &&
              itemIds.every((id) => l.itemIds.includes(id));
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => void pick(l)}
                  aria-pressed={inIt}
                  data-testid="list-choice"
                  data-in={inIt ? "true" : "false"}
                  className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left ${
                    inIt ? "border-2 border-accent" : "border border-line"
                  }`}
                >
                  <Thumb list={l} />
                  <span className="block min-w-0 flex-1">
                    <span className="block truncate text-[15px] leading-5 font-semibold text-ink">
                      {l.name}
                    </span>
                    <span className="block text-[12px] leading-4 text-ink-600">
                      {copy.sheet.pieces(l.itemIds.length)}
                    </span>
                  </span>
                  <Tick on={inIt} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX + 20}
          placeholder={copy.sheet.namePlaceholder}
          aria-label={copy.sheet.nameLabel}
          data-testid="new-list-name"
          className="mb-2.5 h-12 w-full rounded-[12px] border border-line bg-canvas px-4 text-[15px] text-ink placeholder:text-ink-600"
        />
        <Button
          type="submit"
          variant="outline"
          size="md"
          disabled={busy || name.trim().length === 0}
          className="min-h-12 w-full"
        >
          {itemId ? copy.sheet.createAndAdd : copy.sheet.create}
        </Button>
      </form>
      {itemId ? (
        <Button size="lg" onClick={onClose} className="mt-2.5 w-full">
          {copy.sheet.done}
        </Button>
      ) : null}
    </Sheet>
  );
}
