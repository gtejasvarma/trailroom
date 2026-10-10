"use client";
// The responsive shell. Below 768px: a top bar (wordmark, back on pushed screens) and a bottom
// tab bar. From 768px: a top navigation and a centred content grid. One codebase, one tree.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { copy } from "../lib/copy";
import { useAccount } from "./account-provider";
import { JobChips } from "./job-chips";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { BackIcon, HeartIcon } from "./ui/icons";

type Section = "discover" | "lists" | "you";

const TABS: { key: Section; href: string; label: string; shape: string }[] = [
  {
    key: "discover",
    href: "/",
    label: copy.nav.discover,
    shape: "rounded-[4px]",
  },
  {
    key: "lists",
    href: "/lists",
    label: copy.nav.lists,
    shape: "rounded-[4px_9999px_4px_9999px]",
  },
  { key: "you", href: "/you", label: copy.nav.you, shape: "rounded-full" },
];

function sectionOf(pathname: string): Section | null {
  if (
    pathname === "/lists" ||
    pathname.startsWith("/lists/") ||
    pathname.startsWith("/asks/") ||
    pathname.startsWith("/asked/")
  )
    return "lists";
  if (pathname === "/you" || pathname.startsWith("/you/")) return "you";
  if (
    pathname === "/" ||
    pathname.startsWith("/upload") ||
    pathname.startsWith("/item/") ||
    pathname.startsWith("/label/")
  )
    return "discover";
  return null;
}

/** Roots have no back button; everything pushed from them does. */
const isRoot = (p: string) => p === "/" || p === "/lists" || p === "/you";

/** Focused flow screens (photo, queue, result) run without the tab bar. */
function hasTabBar(p: string): boolean {
  if (p.startsWith("/try-on/")) return false;
  return !/^\/item\/[^/]+\/(photo|photos|signup|limit)$/.test(p);
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={copy.nav.home}
      className={`inline-flex min-h-11 items-center gap-2 ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid size-[22px] place-items-center rounded-[6px] bg-ink text-[12px] font-bold tracking-[-0.02em] text-canvas md:size-[26px] md:rounded-[7px] md:text-[13px]"
      >
        {copy.brand.slice(0, 1)}
      </span>
      <span className="text-[15px] font-semibold tracking-[0.06em] text-ink uppercase md:text-[16px] md:tracking-[0.14em]">
        {copy.brand}
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const openAccount = useAccount();
  const { isGuest, loaded, who, signOut } = useMe();
  const { unread } = useLists();
  const dot = (
    <span
      data-testid="lists-dot"
      aria-hidden="true"
      className="block size-2 rounded-full bg-danger"
    />
  );
  const section = sectionOf(pathname);
  const tabBar = hasTabBar(pathname);
  const signedIn = loaded && !isGuest;

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const navLink = (
    href: string,
    label: string,
    active: boolean,
    extra: React.ReactNode = null,
  ) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-[68px] items-center px-4 text-[14px] transition-colors duration-150 ease-brand hover:text-ink ${
        active ? "font-semibold text-ink" : "font-medium text-ink-600"
      }`}
    >
      {label}
      {extra ? <span className="ml-1.5">{extra}</span> : null}
      <span
        aria-hidden="true"
        className={`absolute inset-x-4 bottom-0 h-0.5 ${active ? "bg-ink" : "bg-transparent"}`}
      />
    </Link>
  );

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-10 focus:rounded-md focus:bg-canvas focus:px-4 focus:py-3"
      >
        {copy.nav.skip}
      </a>

      {/* Phone top bar */}
      <header className="border-b border-line-soft bg-canvas md:hidden">
        <div className="mx-auto flex h-[54px] w-full items-center px-2">
          <div className="flex w-14 items-center">
            {!isRoot(pathname) ? (
              <button
                type="button"
                onClick={back}
                aria-label={copy.nav.back}
                className="grid size-11 place-items-center text-ink"
              >
                <BackIcon />
              </button>
            ) : null}
          </div>
          <div className="flex flex-1 justify-center">
            <Wordmark />
          </div>
          <div className="flex w-14 justify-end">
            <Link
              href="/lists"
              aria-label={copy.nav.listsShortcut}
              className="relative grid size-11 place-items-center text-ink"
            >
              <HeartIcon />
              {unread > 0 ? (
                <span className="absolute top-2.5 right-2.5">{dot}</span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop top navigation */}
      <header className="hidden border-b border-line bg-canvas md:block">
        <nav
          aria-label={copy.nav.main}
          className="mx-auto flex h-[68px] w-full max-w-[1600px] items-center gap-4 px-8"
        >
          <Wordmark />
          <div className="flex flex-1 justify-center gap-1">
            {navLink("/", copy.nav.discover, section === "discover")}
            {navLink(
              "/you/try-ons",
              copy.nav.yourTryOns,
              pathname === "/you/try-ons",
            )}
            {navLink(
              "/lists",
              copy.nav.lists,
              section === "lists",
              unread > 0 ? dot : null,
            )}
          </div>
          {signedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/you"
                aria-label={copy.you.signedInAs(who?.name || copy.nav.you)}
                data-testid="account-initial"
                className="grid size-9 place-items-center rounded-full border border-line text-[13px] font-semibold text-ink"
              >
                {who?.initial ?? copy.nav.you.slice(0, 1)}
              </Link>
              <button
                type="button"
                onClick={() => void signOut().then(() => router.push("/"))}
                className="min-h-9 text-[13px] font-medium text-ink-600 hover:text-ink"
              >
                {copy.nav.signOut}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAccount("signin")}
              className="min-h-9 rounded-full bg-ink px-[18px] text-[13px] leading-none font-semibold text-canvas"
            >
              {copy.nav.signIn}
            </button>
          )}
        </nav>
      </header>

      <JobChips />

      <main id="main" className={tabBar ? "pb-20 md:pb-0" : ""}>
        {children}
      </main>

      {tabBar ? (
        <nav
          aria-label={copy.nav.tabs}
          className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-line-soft bg-canvas md:hidden"
        >
          {TABS.map((t) => {
            const active = section === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-[5px] ${
                  active ? "text-ink" : "text-ink-600"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`block size-[18px] border-[1.5px] border-current ${t.shape} ${
                    active ? "bg-current" : "bg-transparent"
                  }`}
                />
                <span
                  className={`text-[11px] leading-[14px] ${active ? "font-semibold" : "font-normal"}`}
                >
                  {t.label}
                </span>
                {t.key === "lists" && unread > 0 ? (
                  <span className="absolute top-2.5 left-1/2 ml-3">{dot}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
