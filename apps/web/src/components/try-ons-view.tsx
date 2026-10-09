"use client";
// Your try-ons: the person's kept try-ons as a plain grid (Front render, piece name), each one
// opening its result; an invitation with a live piece when there are none. A guest is told what
// an account keeps. The same grid sits in You on a phone.
import Link from "next/link";
import { getItem, startWithThese } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { useRenderImage } from "../lib/use-render-image";
import type { TryOnSummary } from "../server/try-ons";
import { useAccount } from "./account-provider";
import { useMe } from "./me-provider";
import { Button, ButtonLink } from "./ui/button";
import { Chip } from "./ui/chip";

function TryOnCard({ t }: { t: TryOnSummary }) {
  const item = getItem(t.itemId);
  const front = t.poses.includes("front") ? "front" : t.poses[0]!;
  const { url } = useRenderImage(t.poseSetId, front);
  if (!item) return null;
  return (
    <article data-testid="tryon-card" data-item={item.id}>
      <Link
        href={paths.tryOn(t.jobId)}
        aria-label={copy.tryOns.openLabel(item.name)}
        className="relative block aspect-[3/4] overflow-hidden rounded-md bg-canvas"
      >
        <span className={`block size-full ${url ? "" : "skeleton"}`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={copy.tryOns.cardAlt(item.name)}
              data-render
              className="reveal size-full object-cover"
            />
          ) : null}
        </span>
        <Chip className="absolute top-2 left-2" upper>
          {copy.card.onYou}
        </Chip>
        <Chip className="absolute top-2 right-2">
          {copy.tryOns.poses(t.poses.length)}
        </Chip>
      </Link>
      <p className="mt-2 text-[12px] leading-4 text-ink-600">
        {copy.result.aiCaption}
      </p>
      <p className="text-[15px] leading-5 text-ink">{item.name}</p>
      <p className="text-[12px] leading-4 text-ink-600">{item.label}</p>
    </article>
  );
}

export function TryOnsGrid() {
  const { loaded, isGuest, tryOns } = useMe();
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
  if (tryOns.length === 0) {
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
  return (
    <ul
      aria-label={copy.tryOns.gridLabel}
      data-testid="tryons-grid"
      className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-x-5 md:gap-y-8"
    >
      {tryOns.map((t) => (
        <li key={t.poseSetId}>
          <TryOnCard t={t} />
        </li>
      ))}
    </ul>
  );
}

export function TryOnsView() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-10 md:py-10">
      <h1 className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
        {copy.tryOns.title}
      </h1>
      <p className="mt-1 mb-5 text-[15px] leading-[22px] text-ink-700">
        {copy.tryOns.sub}
      </p>
      <TryOnsGrid />
    </div>
  );
}
