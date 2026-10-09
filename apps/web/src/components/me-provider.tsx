"use client";
// What the shell and Discover need to know about the visitor: whether a photo is on file, and
// which labels they follow. It reads /api/me only when a session already exists, so browsing
// never creates a Guest Session; following does (the API call signs in anonymously first).
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getLabel } from "@trailroom/catalog";
import { onAuthStateChanged } from "firebase/auth";
import { api, apiFetch } from "../lib/api";
import { signOutNow } from "../lib/account";
import { copy } from "../lib/copy";
import { getFirebaseAuth, peekUser } from "../lib/firebase";
import type { TryOnSummary } from "../server/try-ons";
import { useToast } from "./ui/toast";

interface MeState {
  /** False until we know whether a session (and so a photo) exists. */
  loaded: boolean;
  photoCount: number;
  isGuest: boolean;
  follows: ReadonlySet<string>;
  toggleFollow: (slug: string) => Promise<void>;
  /** Who is signed in (null for a guest or a new visitor). */
  who: { name: string; initial: string } | null;
  /** The job that is rendering right now, if any (from the server, so it survives a reload). */
  activeJobId: string | null;
  /** The person's finished try-ons, newest first. Always empty for a guest. */
  tryOns: TryOnSummary[];
  /** Re-reads the server's view of the person (after sign-in, sign-out, a finished job). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const MeContext = createContext<MeState>({
  loaded: false,
  photoCount: 0,
  isGuest: true,
  follows: new Set(),
  toggleFollow: async () => {},
  who: null,
  activeJobId: null,
  tryOns: [],
  refresh: async () => {},
  signOut: async () => {},
});
export const useMe = () => useContext(MeContext);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const say = useToast();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const [follows, setFollows] = useState<ReadonlySet<string>>(new Set());
  const [who, setWho] = useState<MeState["who"]>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [tryOns, setTryOns] = useState<TryOnSummary[]>([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Bumped whenever a follow is toggled. A refresh that read the server before or during a toggle
  // must not write its (older) follows over the newer local ones: a first Follow creates the
  // guest session, which itself triggers a refresh that races the follow request.
  const followEpoch = useRef(0);
  const followsInFlight = useRef(0);
  const followsSettled = (epoch: number) =>
    followsInFlight.current === 0 && followEpoch.current === epoch;

  const refresh = useCallback(async () => {
    const epoch = followEpoch.current;
    try {
      const user = await peekUser();
      if (!alive.current) return;
      if (!user) {
        setPhotoCount(0);
        setIsGuest(true);
        if (followsSettled(epoch)) setFollows(new Set());
        setWho(null);
        setActiveJobId(null);
        setTryOns([]);
      } else {
        const me = await api.me();
        const mine = me.isGuest ? [] : (await api.tryOns()).tryOns;
        if (!alive.current) return;
        setPhotoCount(me.photoCount);
        setIsGuest(me.isGuest);
        if (followsSettled(epoch)) setFollows(new Set(me.follows));
        const name = user.displayName ?? user.email ?? "";
        setWho(
          me.isGuest
            ? null
            : { name, initial: (name.trim().charAt(0) || "Y").toUpperCase() },
        );
        setActiveJobId(
          me.activePoseSets.find((s) => s.status === "rendering")?.jobId ??
            null,
        );
        setTryOns(mine);
      }
    } catch {
      // Browsing works without it: treat as a new visitor.
    }
    if (alive.current) setLoaded(true);
  }, []);

  // Re-read on every route change: a photo added in the flow must retire the proof slider.
  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  // Sign-in and sign-out change who the server sees: re-read at once.
  useEffect(() => {
    let first = true;
    return onAuthStateChanged(getFirebaseAuth(), () => {
      if (first) {
        first = false;
        return;
      }
      void refresh();
    });
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutNow();
    await refresh();
  }, [refresh]);

  const toggleFollow = useCallback(
    async (slug: string) => {
      const name = getLabel(slug)?.name ?? slug;
      const was = follows.has(slug);
      const apply = (on: boolean) =>
        setFollows((prev) => {
          const next = new Set(prev);
          if (on) next.add(slug);
          else next.delete(slug);
          return next;
        });
      followEpoch.current += 1;
      followsInFlight.current += 1;
      apply(!was); // optimistic
      try {
        await apiFetch(`/api/follows/${slug}`, {
          method: was ? "DELETE" : "POST",
        });
        say(was ? copy.toasts.unfollowed(name) : copy.toasts.following(name));
      } catch {
        apply(was); // roll back
        say(copy.toasts.followFailed);
      } finally {
        followEpoch.current += 1;
        followsInFlight.current -= 1;
      }
    },
    [follows, say],
  );

  const value = useMemo(
    () => ({
      loaded,
      photoCount,
      isGuest,
      follows,
      toggleFollow,
      who,
      activeJobId,
      tryOns,
      refresh,
      signOut,
    }),
    [
      loaded,
      photoCount,
      isGuest,
      follows,
      toggleFollow,
      who,
      activeJobId,
      tryOns,
      refresh,
      signOut,
    ],
  );
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}
