"use client";
import { isRenderReady, itemsByLabel, type Label } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { PieceTile } from "./piece-tile";
import { FollowButton } from "./ui/brand-row";

export function LabelView({ label }: { label: Label }) {
  const items = itemsByLabel(label.slug);
  const ready = items.filter(isRenderReady).length;
  const stat = "block text-[12px] leading-4 text-ink-600";
  const num =
    "block text-[19px] leading-[25px] font-medium text-ink tabular-nums";
  return (
    <div className="rise mx-auto w-full max-w-[1600px] pb-12 md:px-10 md:pt-10">
      <div className="p-4 md:max-w-[520px] md:px-0">
        <p className="mb-[3px] text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-ink-600 uppercase">
          {label.meta}
        </p>
        <h1 className="mb-3 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
          {label.name}
        </h1>
        <div className="mb-4 flex gap-[22px]">
          <span>
            <span className={num}>{items.length}</span>
            <span className={stat}>{copy.label.pieces(items.length)}</span>
          </span>
          <span>
            <span className={num}>{ready}</span>
            <span className={stat}>{copy.label.tryOnReady}</span>
          </span>
        </div>
        <FollowButton label={label} size="lg" className="md:max-w-[240px]" />
      </div>
      {items.length === 0 ? (
        <p className="px-4 text-[15px] leading-6 text-ink-700 md:px-0">
          {copy.label.empty}
        </p>
      ) : (
        <ul
          aria-label={copy.label.gridLabel(label.name)}
          data-testid="label-grid"
          className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-3.5 p-0 px-4 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-x-5 md:gap-y-7 md:px-0"
        >
          {items.map((item) => (
            <li key={item.id}>
              <PieceTile item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
