import Link from "next/link";
import { copy } from "../lib/copy";

export function Header() {
  return (
    <header className="border-b border-line-soft bg-canvas">
      <nav
        aria-label={copy.nav.main}
        className="mx-auto flex h-14 w-full max-w-container items-center justify-between px-4 md:px-8"
      >
        <Link
          href="/"
          aria-label={copy.nav.home}
          className="inline-flex min-h-11 items-center text-[14px] font-semibold tracking-[0.01em] text-accent"
        >
          {copy.brand}
        </Link>
        <Link
          href="/you"
          className="inline-flex min-h-11 items-center text-[14px] font-medium text-ink-700"
        >
          {copy.nav.you}
        </Link>
      </nav>
    </header>
  );
}
