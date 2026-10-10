"use client";
// The pieces You (phone) and Studio (wide) share: the header block with its three counts, the
// Following list, the privacy row and the account actions.
import { useState } from "react";
import { LABELS, catalogUrl, labelAvatar } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { youCounts } from "../lib/you-counts";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { PrivacySheet } from "./privacy-sheet";
import { FollowButton } from "./ui/brand-row";

/** The small uppercase heading above each block on a phone. */
export function SectionLabel({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mb-2.5 text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-ink-600 uppercase"
    >
      {children}
    </h2>
  );
}

/** Who is signed in, with try-ons kept, this week and lists, from real data. */
export function YouHeader() {
  const { who, tryOns } = useMe();
  const { lists } = useLists();
  const c = youCounts(tryOns, lists.length);
  const stats: [string, number, string][] = [
    ["stat-tryons", c.tryOnsKept, copy.you.statTryOns],
    ["stat-week", c.thisWeek, copy.you.statWeek],
    ["stat-lists", c.lists, copy.you.statLists],
  ];
  return (
    <div data-testid="you-header">
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 flex-none place-items-center rounded-full border border-line text-[15px] font-semibold text-ink md:size-12 md:text-[17px]"
        >
          {who?.initial ?? "Y"}
        </span>
        <p
          data-testid="you-account"
          className="min-w-0 truncate text-[15px] leading-5 text-ink-700"
        >
          {who?.name ? copy.you.signedInAs(who.name) : copy.you.account}
        </p>
      </div>
      <div className="mb-5 flex gap-2.5 md:mb-7 md:gap-3.5">
        {stats.map(([id, n, label]) => (
          <div
            key={id}
            data-testid={id}
            className="flex-1 rounded-[14px] border border-line p-3 md:px-5 md:py-[18px]"
          >
            <p className="mb-0.5 text-[22px] leading-7 font-medium text-ink tabular-nums md:text-[30px] md:leading-9 md:tracking-[-0.025em]">
              {n}
            </p>
            <p className="text-[12px] leading-4 text-ink-600 md:text-[14px] md:leading-[19px] md:text-ink-700">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FollowingList() {
  const { follows } = useMe();
  return (
    <ul
      aria-label={copy.you.followingTitle}
      data-testid="following-list"
      className="m-0 list-none p-0"
    >
      {LABELS.map((l) => {
        const avatar = labelAvatar(l.slug);
        const on = follows.has(l.slug);
        return (
          <li
            key={l.slug}
            data-testid="following-row"
            data-label={l.slug}
            className="flex items-center gap-3 border-b border-line-soft py-2.5"
          >
            <span className="block size-[38px] flex-none overflow-hidden rounded-full border border-line bg-surface">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={catalogUrl(avatar)}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-[19px] font-semibold text-ink">
                {l.name}
              </span>
              <span className="block text-[12px] leading-4 text-ink-600">
                {on ? copy.you.followingMeta : copy.you.notFollowing}
              </span>
            </span>
            <FollowButton label={l} size="md" />
          </li>
        );
      })}
    </ul>
  );
}

/** "How your photos are handled": a row that opens the Details sheet. */
export function PrivacyRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="privacy-row"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left md:p-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-5 font-semibold text-ink md:text-[16px] md:leading-[22px]">
            {copy.you.privacyRow}
          </span>
          <span className="block text-[12px] leading-4 text-ink-600 md:text-[13px] md:leading-[18px]">
            {copy.you.privacyMeta}
          </span>
        </span>
        <span aria-hidden="true" className="flex-none text-[15px] text-ink-500">
          →
        </span>
      </button>
      {open ? <PrivacySheet open onClose={() => setOpen(false)} /> : null}
    </>
  );
}
