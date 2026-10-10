"use client";
// The compare tray, docked at the bottom on wide screens: thumbnails of what is picked, a hint,
// Clear and Compare. It follows the person between screens and leaves when Compare opens.
import { usePathname } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { useRenderImage } from "../lib/use-render-image";
import type { TryOnSummary } from "../server/try-ons";
import { useCompare } from "./compare-provider";
import { useMe } from "./me-provider";
import { Button } from "./ui/button";

function TrayThumb({ t, onDrop }: { t: TryOnSummary; onDrop: () => void }) {
  const item = getItem(t.itemId);
  const { url } = useRenderImage(
    t.poseSetId,
    t.poses.includes("front") ? "front" : t.poses[0]!,
    true,
    "tile",
  );
  if (!item) return null;
  return (
    <li
      data-testid="tray-item"
      data-item={item.id}
      className="group relative h-12 w-[38px] flex-none overflow-hidden rounded-[6px] bg-surface"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={copy.compare.tray.thumbAlt(item.name)}
          className="size-full object-cover"
          style={{ objectPosition: "50% 30%" }}
        />
      ) : null}
      <button
        type="button"
        onClick={onDrop}
        aria-label={copy.compare.tray.drop(item.name)}
        className="absolute inset-0 grid place-items-center bg-ink/40 text-[11px] text-canvas opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </li>
  );
}

export function CompareTray() {
  const pathname = usePathname();
  const compare = useCompare();
  const { tryOns } = useMe();
  if (!compare.enabled || compare.tray.length === 0 || pathname === "/compare")
    return null;
  const picked = compare.tray
    .map((id) => tryOns.find((t) => t.poseSetId === id))
    .filter((t): t is TryOnSummary => Boolean(t));
  const n = picked.length;
  return (
    <>
      <div aria-hidden="true" className="h-[76px]" />
      <section
        aria-label={copy.compare.tray.label}
        data-testid="compare-tray"
        className="rise fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas"
      >
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-4 px-10 py-3">
          <span
            data-testid="tray-count"
            className="flex-none text-[13px] font-semibold text-ink"
          >
            {copy.compare.tray.selected(n)}
          </span>
          <ul className="m-0 flex list-none gap-2 p-0">
            {picked.map((t) => (
              <TrayThumb
                key={t.poseSetId}
                t={t}
                onDrop={() => compare.toggle(t.poseSetId)}
              />
            ))}
          </ul>
          <span
            data-testid="tray-hint"
            className="min-w-0 flex-1 text-[13px] text-ink-600"
          >
            {n < 2 ? copy.compare.tray.hintOne : copy.compare.tray.hintMany}
          </span>
          <button
            type="button"
            onClick={compare.clear}
            className="min-h-10 flex-none px-3.5 text-[13px] font-medium text-ink-600"
          >
            {copy.compare.tray.clear}
          </button>
          <Button
            size="md"
            disabled={n < 2}
            onClick={compare.open}
            data-testid="tray-compare"
            className="flex-none"
          >
            {copy.compare.tray.go(n)}
          </Button>
        </div>
      </section>
    </>
  );
}
