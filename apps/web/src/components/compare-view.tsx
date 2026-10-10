"use client";
// Compare, as the desktop prototype: up to four of the person's tried pieces side by side, every
// column on the same pose, with a pose switcher that moves them all together. A piece whose set
// lacks the chosen pose says so plainly; it never shows a different one. The selection lives in the
// URL (/compare?ids=...), so it can be linked and survives a reload. Wide screens, signed in.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getItem, type CatalogItem } from "@trailroom/catalog";
import { api } from "../lib/api";
import { compareHref, parseCompareIds, poseFor } from "../lib/compare-ids";
import { copy } from "../lib/copy";
import { useRenderImage } from "../lib/use-render-image";
import { useWide } from "../lib/use-wide";
import { body, btnLink, h1, page } from "../lib/ui";
import type { TryOnSummary } from "../server/try-ons";
import { useAccount } from "./account-provider";
import { useCompare } from "./compare-provider";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { useSaveToList } from "./save-to-list";
import { Button } from "./ui/button";
import { useBuy } from "./use-buy";

const POSE_ORDER = ["front", "three-quarter", "walking", "seated"] as const;

function Column({
  t,
  item,
  pose,
  onDrop,
}: {
  t: TryOnSummary;
  item: CatalogItem;
  pose: string;
  onDrop: () => void;
}) {
  const buy = useBuy();
  const saveToList = useSaveToList();
  const shown = poseFor(t.poses, pose);
  const { url } = useRenderImage(t.poseSetId, shown, shown !== null);
  const price = copy.item.price(item.priceUsd);
  return (
    <li
      data-testid="compare-column"
      data-item={item.id}
      data-pose={shown ?? ""}
      className="rise min-w-0 flex-[1_1_230px]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] border border-line-soft bg-canvas">
        {shown === null ? (
          <p
            data-testid="not-rendered"
            className="grid size-full place-items-center px-6 text-center text-[14px] leading-5 text-ink-600"
          >
            {copy.compare.notRendered}
          </p>
        ) : (
          <span className={`block size-full ${url ? "" : "skeleton"}`}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={copy.compare.alt(
                  item.name,
                  item.label,
                  copy.poses[shown] ?? shown,
                )}
                data-render
                className="reveal size-full object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            ) : null}
          </span>
        )}
        <button
          type="button"
          onClick={onDrop}
          aria-label={copy.compare.removeColumn(item.name)}
          data-testid="remove-column"
          className="absolute top-1 right-1 grid size-11 place-items-center rounded-full"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-ink/70 text-[13px] text-canvas"
          >
            ✕
          </span>
        </button>
      </div>
      <p
        data-testid="ai-caption"
        className="mt-2 text-[12px] leading-4 text-ink-600"
      >
        {copy.result.aiCaption}
      </p>
      <p className="mt-3 mb-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.09em] text-ink-600 uppercase">
        {item.label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[16px] leading-[22px] text-ink">
          {item.name}
        </span>
        <span className="flex-none text-[16px] leading-[22px] font-medium text-ink tabular-nums">
          {price}
        </span>
      </div>
      <p
        className={`mt-0.5 text-[13px] leading-[18px] ${item.stock.low ? "text-danger" : "text-ink-600"}`}
      >
        {item.stock.line}
      </p>
      <Button
        size="md"
        onClick={() => buy(item.id)}
        data-testid="compare-buy"
        className="mt-3.5 min-h-[46px] w-full"
      >
        {copy.card.buy(price)}
      </Button>
      <Button
        variant="outline"
        size="md"
        onClick={() => saveToList(item.id)}
        data-testid="compare-add-to-list"
        className="mt-2 w-full"
      >
        {copy.compare.addToList}
      </Button>
    </li>
  );
}

function Message({
  title,
  text,
  href,
  action,
}: {
  title?: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className={page} data-testid="compare-message">
      {title ? <h1 className={h1}>{title}</h1> : null}
      <p className={`mt-2 ${body}`} role="status">
        {text}
      </p>
      <Link href={href} className={btnLink}>
        {action}
      </Link>
    </div>
  );
}

export function CompareView({ idsRaw }: { idsRaw: string }) {
  const router = useRouter();
  const wide = useWide();
  const openAccount = useAccount();
  const { loaded, isGuest } = useMe();
  const { openSheet } = useLists();
  const compare = useCompare();
  const ids = useMemo(() => parseCompareIds(idsRaw), [idsRaw]);
  const key = ids.join(",");
  const [pieces, setPieces] = useState<TryOnSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pose, setPose] = useState<string>("front");
  const signedIn = loaded && !isGuest;

  useEffect(() => {
    if (!signedIn || wide !== true || ids.length === 0) return;
    let cancelled = false;
    setFailed(false);
    api
      .compare(ids)
      .then((r) => {
        if (!cancelled) setPieces(r.pieces);
      })
      .catch(() => {
        if (cancelled) return;
        setPieces(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, signedIn, wide]);

  // What is compared is what is in the tray, so going back from Compare keeps the selection.
  useEffect(() => {
    if (pieces && pieces.length > 0)
      compare.set(pieces.map((p) => p.poseSetId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  if (wide === null || !loaded) {
    return (
      <div className={page}>
        <p role="status" className={body}>
          {copy.compare.loading}
        </p>
      </div>
    );
  }
  if (!wide) {
    return (
      <Message
        title={copy.compare.phoneTitle}
        text={copy.compare.phoneBody}
        href="/you/try-ons"
        action={copy.compare.phoneBack}
      />
    );
  }
  if (isGuest) {
    return (
      <div className={page} data-testid="compare-message">
        <p role="status" className={body}>
          {copy.compare.guest}
        </p>
        <Button
          size="md"
          className="mt-3"
          onClick={() => openAccount("signin")}
        >
          {copy.nav.signIn}
        </Button>
      </div>
    );
  }
  if (ids.length === 0) {
    return (
      <Message
        text={copy.compare.empty}
        href="/you/try-ons"
        action={copy.compare.missingAction}
      />
    );
  }
  if (failed) {
    return (
      <Message
        text={copy.compare.missing}
        href="/you/try-ons"
        action={copy.compare.missingAction}
      />
    );
  }
  if (!pieces) {
    return (
      <div className={page}>
        <p role="status" className={body}>
          {copy.compare.loading}
        </p>
      </div>
    );
  }

  const columns = pieces
    .map((t) => ({ t, item: getItem(t.itemId) }))
    .filter((c): c is { t: TryOnSummary; item: CatalogItem } =>
      Boolean(c.item),
    );

  const drop = (t: TryOnSummary) => {
    const rest = ids.filter((id) => id !== t.poseSetId);
    setPieces(
      (prev) => prev?.filter((p) => p.poseSetId !== t.poseSetId) ?? prev,
    );
    compare.set(rest);
    router.replace(rest.length > 0 ? compareHref(rest) : "/you/try-ons");
  };

  return (
    <div
      data-testid="compare"
      className="mx-auto w-full max-w-[1600px] px-10 pt-6 pb-14"
    >
      <div className="mb-5 flex flex-wrap items-end gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="mb-1 text-[30px] leading-9 font-medium tracking-[-0.025em] text-ink">
            {copy.compare.title}
          </h1>
          <p className="text-[15px] leading-[21px] text-ink-700">
            {copy.compare.sub}
          </p>
        </div>
        <div
          role="group"
          aria-label={copy.compare.posesLabel}
          className="flex flex-none items-center gap-2"
        >
          {POSE_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pose === p}
              data-testid="pose-switch"
              data-pose={p}
              onClick={() => setPose(p)}
              className={`min-h-[34px] rounded-[8px] border px-[13px] text-[13px] leading-none font-medium ${
                pose === p
                  ? "border-accent-dark bg-accent-tint text-accent-dark"
                  : "border-line bg-canvas text-ink-700"
              }`}
            >
              {copy.poses[p]}
            </button>
          ))}
        </div>
      </div>
      <ul
        aria-label={copy.compare.columnsLabel}
        className="m-0 flex list-none flex-wrap items-start gap-5 p-0"
      >
        {columns.map(({ t, item }) => (
          <Column
            key={t.poseSetId}
            t={t}
            item={item}
            pose={pose}
            onDrop={() => drop(t)}
          />
        ))}
        {columns.length < 4 ? (
          <li className="min-w-0 flex-[1_1_230px]">
            <Link
              href="/you/try-ons"
              className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-line text-ink-600"
            >
              <span aria-hidden="true" className="text-[22px] leading-none">
                +
              </span>
              <span className="text-[14px] font-medium">
                {copy.compare.addAnother}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
      <div className="mt-7 flex flex-wrap items-center gap-3.5 border-t border-line-soft pt-5">
        <p className="min-w-0 flex-1 text-[14px] leading-5 text-ink-700">
          {copy.compare.listLine}
        </p>
        <Button
          variant="outline"
          size="md"
          data-testid="add-all-to-list"
          onClick={() => openSheet(columns.map((c) => c.item.id))}
          className="flex-none"
        >
          {copy.compare.addAll}
        </Button>
      </div>
    </div>
  );
}
