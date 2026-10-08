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
  useState,
} from "react";
import { getLabel } from "@trailroom/catalog";
import { api, apiFetch } from "../lib/api";
import { copy } from "../lib/copy";
import { peekUser } from "../lib/firebase";
import { useToast } from "./ui/toast";

interface MeState {
  /** False until we know whether a session (and so a photo) exists. */
  loaded: boolean;
  photoCount: number;
  isGuest: boolean;
  follows: ReadonlySet<string>;
  toggleFollow: (slug: string) => Promise<void>;
}

const MeContext = createContext<MeState>({
  loaded: false,
  photoCount: 0,
  isGuest: true,
  follows: new Set(),
  toggleFollow: async () => {},
});
export const useMe = () => useContext(MeContext);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const say = useToast();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const [follows, setFollows] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await peekUser()) {
          const me = await api.me();
          if (cancelled) return;
          setPhotoCount(me.photoCount);
          setIsGuest(me.isGuest);
          setFollows(new Set(me.follows));
        }
      } catch {
        // Browsing works without it: treat as a new visitor.
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // Re-read on every route change: a photo added in the flow must retire the proof slider.
  }, [pathname]);

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
      apply(!was); // optimistic
      try {
        await apiFetch(`/api/follows/${slug}`, {
          method: was ? "DELETE" : "POST",
        });
        say(was ? copy.toasts.unfollowed(name) : copy.toasts.following(name));
      } catch {
        apply(was); // roll back
        say(copy.toasts.followFailed);
      }
    },
    [follows, say],
  );

  const value = useMemo(
    () => ({ loaded, photoCount, isGuest, follows, toggleFollow }),
    [loaded, photoCount, isGuest, follows, toggleFollow],
  );
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}
