"use client";
// "Build the outfit" (phone) / "Wear it with" (wide) on a result: a row of the pieces that make a
// valid outfit with this one, each opening the pair preview sheet (the prototype's `pair` sheet):
// the piece's label photo, name, price, description and stock, the two prices summed, and the
// action that starts the outfit render. Only valid, ready pairs are offered; a piece with none
// shows no row. No fit lines: this is what two pieces look like together, not a fitting.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  catalogUrl,
  outfitPairsFor,
  type CatalogItem,
} from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { startOutfitPath } from "../lib/flow";
import type { JobView } from "../lib/job";
import { alertStyle } from "../lib/ui";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

function PairSheet({
  base,
  pair,
  photoId,
  open,
  onClose,
}: {
  base: CatalogItem;
  pair: CatalogItem;
  photoId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photo = pair.photos[0]!;
  const total = copy.item.price(base.priceUsd + pair.priceUsd);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      router.push(await startOutfitPath([base.id, pair.id], photoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.outfit.startFailed);
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      kicker={copy.outfit.pairKicker}
      title={copy.outfit.pairTitle(base.name)}
      onClose={onClose}
    >
      <div className="mt-3.5 mb-4 flex gap-3" data-testid="pair-sheet-body">
        <span className="block aspect-[3/4] w-[116px] flex-none overflow-hidden rounded-[12px] bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogUrl(photo.file)}
            alt={copy.outfit.pairAlt(pair.name)}
            className="size-full object-cover"
            style={{ objectPosition: photo.focus }}
          />
        </span>
        <span className="block min-w-0 flex-1">
          <span className="block text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-ink-600 uppercase">
            {pair.label}
          </span>
          <span className="mt-0.5 block text-[17px] leading-[23px] text-ink">
            {pair.name}
          </span>
          <span className="block text-[16px] leading-[22px] font-medium text-ink tabular-nums">
            {copy.item.price(pair.priceUsd)}
          </span>
          <span className="mt-2 block text-[13px] leading-[19px] text-ink-700">
            {pair.description}
          </span>
          <span
            className={`mt-1.5 block text-[13px] leading-[18px] ${pair.stock.low ? "text-danger" : "text-ink-600"}`}
          >
            {pair.stock.line}
          </span>
        </span>
      </div>
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        disabled={busy}
        onClick={() => void start()}
        data-testid="pair-add"
        className="w-full"
      >
        {busy ? copy.outfit.pairAdding : copy.outfit.pairAdd(total)}
      </Button>
      <Button
        variant="quiet"
        size="md"
        onClick={onClose}
        className="mt-2.5 w-full !text-ink-600 !no-underline"
      >
        {copy.outfit.pairNot}
      </Button>
      <p className="mt-3 text-[12px] leading-[17px] text-ink-600">
        {copy.outfit.pairNote}
      </p>
    </Sheet>
  );
}

export function OutfitRow({ item, job }: { item: CatalogItem; job: JobView }) {
  const pairs = outfitPairsFor(item.id);
  const [chosen, setChosen] = useState<CatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);

  // "See what goes with it" (after "Yes, it's mine") lands here with ?pair=1: bring the row up.
  const wantsPair = useSearchParams().get("pair") === "1";
  useEffect(() => {
    if (!wantsPair) return;
    const el = row.current;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.querySelector<HTMLElement>("[data-testid=pair-thumb]")?.focus();
  }, [wantsPair]);

  if (pairs.length === 0) return null;
  return (
    <div
      ref={row}
      data-testid="outfit-row"
      className="mt-4 flex items-center gap-2.5 border-t border-line-soft pt-3.5 md:mt-6 md:gap-3 md:pt-5"
    >
      <span className="block flex-1">
        <span className="block text-[14px] leading-[19px] font-semibold text-ink">
          <span className="md:hidden">{copy.result.outfit}</span>
          <span className="hidden md:inline">{copy.result.outfitWide}</span>
        </span>
        <span className="block text-[12px] leading-4 text-ink-600 md:text-[13px] md:leading-[18px]">
          <span className="md:hidden">{copy.result.outfitSub}</span>
          <span className="hidden md:inline">{copy.result.outfitWideSub}</span>
        </span>
      </span>
      <span
        role="group"
        aria-label={copy.result.outfitRowLabel}
        className="flex flex-none gap-2"
      >
        {pairs.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid="pair-thumb"
            data-item={p.id}
            aria-label={copy.result.pairOpen(p.name)}
            onClick={() => {
              setChosen(p);
              setOpen(true);
            }}
            className="block size-[52px] overflow-hidden rounded-full border border-line p-0 md:size-[54px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catalogUrl(p.photos[0]!.file)}
              alt=""
              className="size-full object-cover"
              style={{ objectPosition: p.photos[0]!.focus }}
            />
          </button>
        ))}
      </span>
      {chosen ? (
        <PairSheet
          base={item}
          pair={chosen}
          photoId={job.photoId}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
