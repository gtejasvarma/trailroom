"use client";
// The one account sheet for the whole app, and what happens after sign-in (the prototype's
// resumeIntent): reveal opens the result, picknext goes to the post-signup labels (a brand new
// account) or the starters, list/buy go back to the piece with an interim toast. Dismissing the
// sheet never loses anything: the photo and try-on stay with the guest session.
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { ACCOUNT_CHANGED } from "../lib/use-job";
import {
  AccountSheet,
  type AccountContext,
  type AccountReason,
} from "./account-sheet";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

export interface AccountIntent extends AccountContext {
  /** The try-on to open after sign-in (reveal). */
  jobId?: string;
  /** The piece to return to after sign-in (list, buy). */
  itemId?: string;
  /** Called when the sheet is dismissed without signing in. */
  onDismiss?: () => void;
}

const OpenContext = createContext<
  (reason: AccountReason, intent?: AccountIntent) => void
>(() => {});
/** `openAccount("reveal", { jobId, poseSetId, pose, poseCount })` */
export const useAccount = () => useContext(OpenContext);

const INTENT_KEY = "trailroom.account-intent";
type Stored = { reason: AccountReason; jobId?: string; itemId?: string };

// The intent also lives in sessionStorage, so a remount or reload around the sign-in popup
// cannot drop where the person was going.
function keepIntent(reason: AccountReason, intent: AccountIntent) {
  try {
    const v: Stored = { reason, jobId: intent.jobId, itemId: intent.itemId };
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(v));
  } catch {
    // storage unavailable: the in-memory intent is used
  }
}
function takeIntent(): Stored | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const say = useToast();
  const { refresh } = useMe();
  const [state, setState] = useState<{
    reason: AccountReason;
    intent: AccountIntent;
  } | null>(null);
  // Keep the last values while the sheet closes so its content does not blank out mid-animation.
  const [shown, setShown] = useState<typeof state>(null);
  const [open, setOpen] = useState(false);

  const openAccount = useCallback(
    (reason: AccountReason, intent: AccountIntent = {}) => {
      const next = { reason, intent };
      keepIntent(reason, intent);
      setState(next);
      setShown(next);
      setOpen(true);
    },
    [],
  );

  const close = useCallback(() => {
    setOpen(false);
    const cur = state;
    setState(null);
    cur?.intent.onDismiss?.();
  }, [state]);

  const signedIn = useCallback(
    async (result: "linked" | "existing" | "unmoved") => {
      const stored = takeIntent();
      const cur =
        state ??
        (stored
          ? { reason: stored.reason, intent: stored as AccountIntent }
          : null);
      setOpen(false);
      setState(null);
      await refresh();
      window.dispatchEvent(new Event(ACCOUNT_CHANGED));
      if (result === "unmoved") {
        // Signed in to their own account, but the guest's try-on did not come across.
        say(copy.toasts.moveFailed);
        router.push(paths.catalogue);
        return;
      }
      if (!cur) return;
      const { reason, intent } = cur;
      if (reason === "reveal" && intent.jobId) {
        say(copy.toasts.signedIn);
        // Already on that screen: it re-renders as the result by itself.
        if (pathname !== paths.tryOn(intent.jobId))
          router.push(paths.tryOn(intent.jobId));
      } else if (reason === "picknext") {
        router.push(paths.welcome);
      } else if ((reason === "list" || reason === "buy") && intent.itemId) {
        say(copy.toasts.signedInSoon);
        router.push(paths.item(intent.itemId));
      } else {
        say(copy.toasts.signedIn);
      }
    },
    [state, refresh, say, router, pathname],
  );

  const value = useMemo(() => openAccount, [openAccount]);
  return (
    <OpenContext.Provider value={value}>
      {children}
      {shown ? (
        <AccountSheet
          open={open}
          reason={shown.reason}
          context={shown.intent}
          onClose={close}
          onSignedIn={(r) => void signedIn(r)}
        />
      ) : null}
    </OpenContext.Provider>
  );
}
