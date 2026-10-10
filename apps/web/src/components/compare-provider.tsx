"use client";
// The compare tray's state: which try-ons (pose-set ids) are picked, up to four, kept while the
// person moves between screens. Wide screens only; a guest has nothing to compare. The C key opens
// Compare when two or more are picked and focus is not in a field.
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MAX_COMPARE,
  compareHref,
  mostRecent,
  shouldOpenCompare,
  toggleTray,
} from "../lib/compare-ids";
import { copy } from "../lib/copy";
import { useWide } from "../lib/use-wide";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

interface CompareState {
  /** Compare is offered: signed in, on a wide screen. */
  enabled: boolean;
  tray: string[];
  has: (poseSetId: string) => boolean;
  toggle: (poseSetId: string) => void;
  clear: () => void;
  /** Replaces the tray (Compare keeps it equal to what the URL shows). */
  set: (poseSetIds: string[]) => void;
  /** Opens Compare with the tray (two or more). */
  open: () => void;
  /** "Compare all": the four most recent try-ons. */
  openAll: () => void;
}

const Context = createContext<CompareState>({
  enabled: false,
  tray: [],
  has: () => false,
  toggle: () => {},
  clear: () => {},
  set: () => {},
  open: () => {},
  openAll: () => {},
});
export const useCompare = () => useContext(Context);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const say = useToast();
  const wide = useWide();
  const { loaded, isGuest, tryOns } = useMe();
  const [picked, setPicked] = useState<string[]>([]);
  const enabled = wide === true && loaded && !isGuest;
  // Only try-ons that still exist stay in the tray (one was removed, or the person signed out).
  const tray = useMemo(
    () =>
      enabled
        ? picked.filter((id) => tryOns.some((t) => t.poseSetId === id))
        : [],
    [enabled, picked, tryOns],
  );

  const toggle = useCallback(
    (id: string) => {
      setPicked((prev) => {
        const next = toggleTray(prev, id);
        if (next === prev && !prev.includes(id)) say(copy.toasts.compareFull);
        return next;
      });
    },
    [say],
  );
  const clear = useCallback(() => setPicked([]), []);
  const set = useCallback(
    (ids: string[]) => setPicked(ids.slice(0, MAX_COMPARE)),
    [],
  );
  const open = useCallback(() => {
    if (tray.length >= 2) router.push(compareHref(tray));
  }, [tray, router]);
  const openAll = useCallback(() => {
    const ids = mostRecent(tryOns.map((t) => t.poseSetId));
    if (ids.length === 0) return;
    setPicked(ids);
    router.push(compareHref(ids));
  }, [tryOns, router]);

  useEffect(() => {
    if (!enabled || pathname === "/compare") return;
    const onKey = (e: KeyboardEvent) => {
      const dialogOpen = document.querySelector("dialog[open]") !== null;
      if (!shouldOpenCompare(e, tray.length, dialogOpen)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, pathname, tray.length, open]);

  const value = useMemo<CompareState>(
    () => ({
      enabled,
      tray,
      has: (id) => tray.includes(id),
      toggle,
      clear,
      set,
      open,
      openAll,
    }),
    [enabled, tray, toggle, clear, set, open, openAll],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export { MAX_COMPARE };
