"use client";
// The desktop account menu (top right): the person's initial opens Studio, How your photos are
// handled, and Sign out. A plain menu button: Escape or a click outside closes it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { copy } from "../lib/copy";
import { useMe } from "./me-provider";
import { PrivacySheet } from "./privacy-sheet";

const ITEM =
  "flex min-h-11 w-full items-center px-4 text-left text-[14px] leading-5 text-ink hover:bg-surface";

export function AccountMenu() {
  const router = useRouter();
  const { who, signOut } = useMe();
  const [open, setOpen] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={copy.you.avatarLabel(who?.name || copy.nav.you)}
        data-testid="account-initial"
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full border border-line text-[13px] font-semibold text-ink"
      >
        {who?.initial ?? copy.nav.you.slice(0, 1)}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={copy.nav.accountMenu}
          data-testid="account-menu"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[260px] overflow-hidden rounded-md border border-line bg-canvas py-1 shadow-4"
        >
          <Link
            href="/studio"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={ITEM}
          >
            {copy.nav.studio}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPrivacy(true);
            }}
            className={ITEM}
          >
            {copy.nav.howPhotos}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => router.push("/"));
            }}
            className={`${ITEM} border-t border-line-soft`}
          >
            {copy.nav.signOut}
          </button>
        </div>
      ) : null}
      {privacy ? <PrivacySheet open onClose={() => setPrivacy(false)} /> : null}
    </div>
  );
}
