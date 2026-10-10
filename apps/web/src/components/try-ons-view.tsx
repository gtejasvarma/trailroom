"use client";
// Your try-ons: the person's kept try-ons (Front render, piece name), each opening its result, each
// with a Remove that discards it at once (the tile leaves, a toast says so, no confirm). An
// invitation with a live piece when there are none; a guest is told what an account keeps. On a
// phone You shows the compact strip; on wide screens this page adds Compare (pick up to four).
import Link from "next/link";
import { getItem, startWithThese } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { useRenderImage } from "../lib/use-render-image";
import type { OutfitSummary } from "../server/outfits";
import type { TryOnSummary } from "../server/try-ons";
import { useAccount } from "./account-provider";
import { useCompare } from "./compare-provider";
import { useMe } from "./me-provider";
import { Button, ButtonLink } from "./ui/button";
import { Chip } from "./ui/chip";

type Variant = "strip" | "page";

function RemoveButton({ t, name }: { t: TryOnSummary; name: string }) {
  const { removeTryOn } = useMe();
  return (
    <button
      type="button"
      onClick={() => void removeTryOn(t.poseSetId, name)}
      aria-label={copy.tryOns.removeLabel(name)}
      data-testid="remove-tryon"
      className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-full md:top-1 md:right-1"
    >
      <span
        aria-hidden="true"
        className="grid size-[26px] place-items-center rounded-full bg-ink/70 text-[12px] text-canvas"
      >
        ✕
      </span>
    </button>
  );
}

function SelectButton({ t, name }: { t: TryOnSummary; name: string }) {
  const compare = useCompare();
  const at = compare.tray.indexOf(t.poseSetId);
  const on = at >= 0;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={
        on ? copy.tryOns.unselectLabel(name) : copy.tryOns.selectLabel(name)
      }
      data-testid="select-tryon"
      onClick={() => compare.toggle(t.poseSetId)}
      className="absolute bottom-0 left-0 grid size-11 place-items-center rounded-full"
    >
      <span
        aria-hidden="true"
        className={`grid size-[26px] place-items-center rounded-full border-[1.5px] border-canvas text-[12px] font-semibold text-canvas ${
          on ? "bg-accent" : "bg-ink/50"
        }`}
      >
        {on ? at + 1 : ""}
      </span>
    </button>
  );
}

function TryOnCard({ t, variant }: { t: TryOnSummary; variant: Variant }) {
  const item = getItem(t.itemId);
  const compare = useCompare();
  const front = t.poses.includes("front") ? "front" : t.poses[0]!;
  const { url } = useRenderImage(t.poseSetId, front);
  if (!item) return null;
  const strip = variant === "strip";
  return (
    <article data-testid="tryon-card" data-item={item.id}>
      <div className="relative">
        <Link
          href={paths.tryOn(t.jobId)}
          aria-label={copy.tryOns.openLabel(item.name)}
          className={`relative block overflow-hidden bg-surface ${
            strip
              ? "aspect-[3/4] rounded-[10px]"
              : "aspect-[3/4] rounded-md md:aspect-[4/5] md:rounded-[12px]"
          }`}
        >
          <span className={`block size-full ${url ? "" : "skeleton"}`}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={copy.tryOns.cardAlt(item.name)}
                data-render
                className="reveal size-full object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            ) : null}
          </span>
          {strip ? (
            <span className="absolute right-[5px] bottom-[5px] rounded-full bg-ink/60 px-[7px] py-0.5 text-[9px] leading-3 font-semibold text-canvas">
              {t.poses.length}
            </span>
          ) : (
            <>
              <Chip className="absolute top-2 left-2" upper>
                {copy.card.onYou}
              </Chip>
              <Chip className="absolute right-2 bottom-2">
                {copy.tryOns.poses(t.poses.length)}
              </Chip>
            </>
          )}
        </Link>
        {strip ? null : compare.enabled ? (
          <SelectButton t={t} name={item.name} />
        ) : null}
        <RemoveButton t={t} name={item.name} />
      </div>
      <p
        className={`mt-1.5 text-ink-600 ${strip ? "text-[11px] leading-[14px]" : "text-[12px] leading-4"}`}
      >
        {copy.result.aiCaption}
      </p>
      {strip ? (
        <p className="truncate text-[12px] leading-4 text-ink-800">
          {item.name}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 text-ink-800">
              {item.name}
            </p>
            <p className="flex-none text-[14px] leading-5 font-medium text-ink tabular-nums">
              {copy.item.price(item.priceUsd)}
            </p>
          </div>
          <p className="text-[12px] leading-4 text-ink-600">{item.label}</p>
        </>
      )}
    </article>
  );
}

function OutfitCard({ o, variant }: { o: OutfitSummary; variant: Variant }) {
  const { removeOutfit } = useMe();
  const a = getItem(o.itemIds[0]);
  const b = getItem(o.itemIds[1]);
  const { url } = useRenderImage(o.poseSetId, "front");
  if (!a || !b) return null;
  const strip = variant === "strip";
  return (
    <article data-testid="outfit-card" data-items={o.itemIds.join(",")}>
      <div className="relative">
        <Link
          href={paths.tryOn(o.jobId)}
          aria-label={copy.outfit.openLabel(a.name, b.name)}
          className={`relative block overflow-hidden bg-surface ${
            strip
              ? "aspect-[3/4] rounded-[10px]"
              : "aspect-[3/4] rounded-md md:aspect-[4/5] md:rounded-[12px]"
          }`}
        >
          <span className={`block size-full ${url ? "" : "skeleton"}`}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={copy.outfit.cardAlt(a.name, b.name)}
                data-render
                className="reveal size-full object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            ) : null}
          </span>
          <Chip
            upper
            data-testid="outfit-tag"
            className="absolute top-2 left-2"
          >
            {copy.outfit.tag}
          </Chip>
        </Link>
        <button
          type="button"
          onClick={() => void removeOutfit(o.poseSetId, a.name, b.name)}
          aria-label={copy.outfit.removeLabel(a.name, b.name)}
          data-testid="remove-outfit"
          className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-full md:top-1 md:right-1"
        >
          <span
            aria-hidden="true"
            className="grid size-[26px] place-items-center rounded-full bg-ink/70 text-[12px] text-canvas"
          >
            ✕
          </span>
        </button>
      </div>
      <p
        className={`mt-1.5 text-ink-600 ${strip ? "text-[11px] leading-[14px]" : "text-[12px] leading-4"}`}
      >
        {copy.result.aiCaption}
      </p>
      {strip ? (
        <p className="truncate text-[12px] leading-4 text-ink-800">
          {copy.outfit.names(a.name, b.name)}
        </p>
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 text-[14px] leading-5 text-ink-800">
            {copy.outfit.names(a.name, b.name)}
          </p>
          <p className="flex-none text-[14px] leading-5 font-medium text-ink tabular-nums">
            {copy.item.price(a.priceUsd + b.priceUsd)}
          </p>
        </div>
      )}
    </article>
  );
}

export function TryOnsEmpty() {
  const start = startWithThese()[0];
  return (
    <div
      className="rounded-lg border border-line p-[18px]"
      data-testid="tryons-empty"
    >
      <p className="text-[17px] leading-6 font-semibold text-ink">
        {copy.tryOns.emptyTitle}
      </p>
      <p className="mt-1 text-[15px] leading-[22px] text-ink-700">
        {copy.tryOns.emptyBody}
      </p>
      {start ? (
        <ButtonLink href={`/item/${start.id}`} size="md" className="mt-3">
          {copy.tryOns.emptyAction(start.name)}
        </ButtonLink>
      ) : null}
    </div>
  );
}

export function TryOnsGrid({ variant = "page" }: { variant?: Variant }) {
  const { loaded, isGuest, tryOns, outfits } = useMe();
  const openAccount = useAccount();
  if (!loaded) {
    return (
      <p role="status" className="text-[15px] leading-6 text-ink-700">
        {copy.tryOns.loading}
      </p>
    );
  }
  if (isGuest) {
    return (
      <div
        className="rounded-lg border border-line p-[18px]"
        data-testid="tryons-guest"
      >
        <p className="text-[15px] leading-[22px] text-ink-700">
          {copy.tryOns.guestNote}
        </p>
        <Button
          variant="outline"
          size="md"
          className="mt-3"
          onClick={() => openAccount("signin")}
        >
          {copy.nav.signIn}
        </Button>
      </div>
    );
  }
  if (tryOns.length === 0 && outfits.length === 0) return <TryOnsEmpty />;
  // Try-ons and outfits in one grid, newest first.
  const kept = [
    ...tryOns.map((t) => ({ kind: "tryon" as const, t, at: t.createdAt })),
    ...outfits.map((o) => ({ kind: "outfit" as const, o, at: o.createdAt })),
  ].sort((x, y) => y.at.localeCompare(x.at));
  return (
    <ul
      aria-label={copy.tryOns.gridLabel}
      data-testid="tryons-grid"
      className={
        variant === "strip"
          ? "m-0 grid list-none grid-cols-3 gap-2 p-0"
          : "m-0 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-x-5 md:gap-y-8"
      }
    >
      {kept.map((k) =>
        k.kind === "tryon" ? (
          <li key={k.t.poseSetId}>
            <TryOnCard t={k.t} variant={variant} />
          </li>
        ) : (
          <li key={k.o.poseSetId}>
            <OutfitCard o={k.o} variant={variant} />
          </li>
        ),
      )}
    </ul>
  );
}

export function TryOnsView() {
  const { loaded, isGuest, tryOns } = useMe();
  const compare = useCompare();
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-10 md:py-7">
      <div className="mb-5 flex flex-wrap items-end gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
            {copy.tryOns.title}
          </h1>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-700">
            {loaded && !isGuest && tryOns.length > 0
              ? copy.tryOns.subCount(tryOns.length)
              : copy.tryOns.sub}
          </p>
        </div>
        {compare.enabled && tryOns.length >= 2 ? (
          <Button
            variant="outline"
            size="md"
            onClick={compare.openAll}
            data-testid="compare-all"
            className="flex-none"
          >
            {copy.tryOns.compareAll}
          </Button>
        ) : null}
      </div>
      <TryOnsGrid />
    </div>
  );
}
