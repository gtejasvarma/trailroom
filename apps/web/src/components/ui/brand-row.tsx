"use client";
import Link from "next/link";
import { catalogUrl, labelAvatar, type Label } from "@trailroom/catalog";
import { copy } from "../../lib/copy";
import { useMe } from "../me-provider";

/** Follow / Following, with the optimistic toggle. */
export function FollowButton({
  label,
  size = "sm",
  className = "",
}: {
  label: Label;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { follows, toggleFollow } = useMe();
  const on = follows.has(label.slug);
  const sizes = {
    sm: "min-h-8 px-3.5 text-[13px]",
    md: "min-h-9 px-4 text-[14px]",
    lg: "min-h-12 w-full text-[16px] font-semibold",
  }[size];
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={
        on
          ? copy.card.followingLabel(label.name)
          : copy.card.followLabel(label.name)
      }
      onClick={() => void toggleFollow(label.slug)}
      className={`flex-none rounded-full font-medium leading-none transition-colors duration-150 ease-brand ${sizes} ${
        on
          ? "border border-line bg-canvas text-ink"
          : "border border-ink bg-ink text-canvas"
      } ${className}`}
    >
      {on ? copy.card.following : copy.card.follow}
    </button>
  );
}

/** Avatar, label name, a second line, and Follow. The avatar is the label's first photograph. */
export function BrandRow({
  label,
  line,
  avatarSize = 34,
}: {
  label: Label;
  /** "New in", "From a label you follow", or "Independent · Paris". */
  line: string;
  avatarSize?: number;
}) {
  const avatar = labelAvatar(label.slug);
  return (
    <div className="flex items-center gap-2.5">
      <Link
        href={`/label/${label.slug}`}
        aria-label={copy.card.openLabel(label.name)}
        className="block flex-none overflow-hidden rounded-full border border-line bg-canvas"
        style={{ width: avatarSize, height: avatarSize }}
        tabIndex={-1}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={catalogUrl(avatar)}
            alt=""
            className="size-full object-cover"
          />
        ) : null}
      </Link>
      <Link href={`/label/${label.slug}`} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14px] leading-[18px] font-semibold text-ink">
          {label.name}
        </span>
        <span className="block truncate text-[12px] leading-4 text-ink-600">
          {line}
        </span>
      </Link>
      <FollowButton label={label} />
    </div>
  );
}
