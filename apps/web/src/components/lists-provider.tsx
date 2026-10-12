"use client";
// The signed-in person's lists, asks and inbox, read through the API (a client reads nothing from
// Firestore for these). One place for every list action, so the heart on a card, the list sheet,
// the Lists tab and the list page always agree. Guests have none of it.
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
import { ApiError, api } from "../lib/api";
import { peekUser } from "../lib/firebase";
import { copy } from "../lib/copy";
import type { AskSummary } from "../server/asks";
import type { InboxSummary } from "../server/inbox";
import type { ListBody } from "../server/lists";
import { ListSheet } from "./list-sheet";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

export type ListResult =
  { ok: true; list: ListBody } | { ok: false; code: string };

interface ListsState {
  /** False until the first read for a signed-in person has finished. */
  loaded: boolean;
  failed: boolean;
  lists: ListBody[];
  asks: AskSummary[];
  inbox: InboxSummary[];
  /** Asks of you that have not been opened since they arrived. */
  unread: number;
  /** The piece is in at least one of the person's lists. */
  isSaved: (itemId: string) => boolean;
  refresh: () => Promise<void>;
  /**
   * One-tap save into Favourites (made on first use), with the heart filling at once. Resolves
   * false when the server refused, after putting the heart back.
   */
  setFavourite: (itemId: string, on: boolean) => Promise<ListResult>;
  /** Where the piece is saved: nowhere, in Favourites alone, or in at least one other list. */
  savedState: (itemId: string) => "none" | "favourites" | "other";
  /** Adds the piece to the list, or removes it if it is already there. */
  toggle: (listId: string, itemId: string) => Promise<ListResult>;
  create: (name: string, itemId?: string) => Promise<ListResult>;
  rename: (listId: string, name: string) => Promise<ListResult>;
  removePiece: (listId: string, itemId: string) => Promise<ListResult>;
  remove: (listId: string) => Promise<boolean>;
  /** Opens the list sheet for a piece (or with no piece, to make a list). Signed-in people only. */
  openSheet: (itemId: string | string[] | null) => void;
  /** The latest ask made from a list, if any. */
  askFor: (listId: string) => AskSummary | undefined;
}

const noop = async () => {};
const Context = createContext<ListsState>({
  loaded: false,
  failed: false,
  lists: [],
  asks: [],
  inbox: [],
  unread: 0,
  isSaved: () => false,
  setFavourite: async () => ({ ok: false, code: "unknown" }),
  savedState: () => "none",
  refresh: noop,
  toggle: async () => ({ ok: false, code: "unknown" }),
  create: async () => ({ ok: false, code: "unknown" }),
  rename: async () => ({ ok: false, code: "unknown" }),
  removePiece: async () => ({ ok: false, code: "unknown" }),
  remove: async () => false,
  openSheet: () => {},
  askFor: () => undefined,
});
export const useLists = () => useContext(Context);

const emptyFavourites = (): ListBody => ({
  id: "favourites",
  name: copy.lists.favourites,
  kind: "favourites",
  itemIds: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

/** Favourites first, the rest as given. */
const favFirst = (lists: ListBody[]) => [
  ...lists.filter((l) => l.kind === "favourites"),
  ...lists.filter((l) => l.kind !== "favourites"),
];

const codeOf = (e: unknown) => (e instanceof ApiError ? e.code : "unknown");

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const { loaded: meLoaded, isGuest } = useMe();
  const pathname = usePathname();
  const say = useToast();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stored, setLists] = useState<ListBody[]>([]);
  // Favourites is always there: until the first save it is the empty placeholder.
  const lists = useMemo(
    () =>
      meLoaded && !stored.some((l) => l.kind === "favourites")
        ? favFirst([emptyFavourites(), ...stored])
        : stored,
    [meLoaded, stored],
  );
  const [asks, setAsks] = useState<AskSummary[]>([]);
  const [inbox, setInbox] = useState<InboxSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [sheet, setSheet] = useState<{ itemIds: string[] } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const signedIn = meLoaded && !isGuest;

  // Bumped by every Favourites change: a read that started before one must not write its older
  // lists over the newer local ones.
  const favEpoch = useRef(0);

  const refresh = useCallback(async () => {
    const clear = () => {
      setLists([]);
      setAsks([]);
      setInbox([]);
      setUnread(0);
      setFailed(false);
      setLoaded(meLoaded);
    };
    if (!meLoaded) return clear();
    // A guest with a session may have Favourites (and nothing else); browsing alone never makes one.
    if (!signedIn) {
      if (!(await peekUser())) return clear();
      const epoch = favEpoch.current;
      try {
        const l = await api.lists();
        if (!alive.current) return;
        if (epoch === favEpoch.current) setLists(favFirst(l.lists));
        setAsks([]);
        setInbox([]);
        setUnread(0);
        setFailed(false);
      } catch {
        if (alive.current) setFailed(true);
      }
      if (alive.current) setLoaded(true);
      return;
    }
    const epoch = favEpoch.current;
    try {
      const [l, a, i] = await Promise.all([
        api.lists(),
        api.asks(),
        api.inbox(),
      ]);
      if (!alive.current) return;
      if (epoch === favEpoch.current) setLists(favFirst(l.lists));
      setAsks(a.asks);
      setInbox(i.asks);
      setUnread(i.unread);
      setFailed(false);
    } catch {
      if (alive.current) setFailed(true);
    }
    if (alive.current) setLoaded(true);
  }, [signedIn, meLoaded]);

  // Read on sign-in, and again whenever the route changes (votes and opened asks move on their own).
  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const replace = (list: ListBody) =>
    setLists((prev) => {
      const same = (l: ListBody) =>
        list.kind === "favourites" ? l.kind === "favourites" : l.id === list.id;
      return favFirst(
        prev.some(same)
          ? prev.map((l) => (same(l) ? list : l))
          : [list, ...prev],
      );
    });

  const toggle = useCallback(
    async (listId: string, itemId: string): Promise<ListResult> => {
      const cur = lists.find((l) => l.id === listId);
      const had = cur?.itemIds.includes(itemId) ?? false;
      try {
        const { list } = await api.changeList(
          listId,
          had ? { remove: itemId } : { add: itemId },
        );
        replace(list);
        return { ok: true, list };
      } catch (e) {
        return { ok: false, code: codeOf(e) };
      }
    },
    [lists],
  );

  const setFavourite = useCallback(
    async (itemId: string, on: boolean): Promise<ListResult> => {
      const apply = (add: boolean) =>
        setLists((prev) => {
          const has = prev.some((l) => l.kind === "favourites");
          const base: ListBody[] = has
            ? prev
            : [
                {
                  id: "favourites",
                  name: copy.lists.favourites,
                  kind: "favourites",
                  itemIds: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                ...prev,
              ];
          return base.map((l) =>
            l.kind !== "favourites"
              ? l
              : {
                  ...l,
                  itemIds: add
                    ? l.itemIds.includes(itemId)
                      ? l.itemIds
                      : [...l.itemIds, itemId]
                    : l.itemIds.filter((i) => i !== itemId),
                },
          );
        });
      favEpoch.current += 1;
      apply(on);
      try {
        const { list } = await api.changeList(
          "favourites",
          on ? { add: itemId } : { remove: itemId },
        );
        favEpoch.current += 1;
        setLists((prev) =>
          favFirst(
            prev.some((l) => l.kind === "favourites")
              ? prev.map((l) => (l.kind === "favourites" ? list : l))
              : [list, ...prev],
          ),
        );
        return { ok: true, list };
      } catch (e) {
        favEpoch.current += 1;
        apply(!on);
        return { ok: false, code: codeOf(e) };
      }
    },
    [],
  );

  const create = useCallback(
    async (name: string, itemId?: string): Promise<ListResult> => {
      try {
        const { list } = await api.createList(name, itemId);
        setLists((prev) => favFirst([list, ...prev]));
        return { ok: true, list };
      } catch (e) {
        return { ok: false, code: codeOf(e) };
      }
    },
    [],
  );

  const rename = useCallback(
    async (listId: string, name: string): Promise<ListResult> => {
      try {
        const { list } = await api.changeList(listId, { name });
        replace(list);
        return { ok: true, list };
      } catch (e) {
        return { ok: false, code: codeOf(e) };
      }
    },
    [],
  );

  const removePiece = useCallback(
    async (listId: string, itemId: string): Promise<ListResult> => {
      try {
        const { list } = await api.changeList(listId, { remove: itemId });
        replace(list);
        return { ok: true, list };
      } catch (e) {
        return { ok: false, code: codeOf(e) };
      }
    },
    [],
  );

  const remove = useCallback(
    async (listId: string) => {
      try {
        await api.deleteList(listId);
        setLists((prev) => prev.filter((l) => l.id !== listId));
        setAsks((prev) => prev.filter((a) => a.listId !== listId));
        return true;
      } catch {
        say(copy.toasts.listFailed);
        return false;
      }
    },
    [say],
  );

  const openSheet = useCallback((itemId: string | string[] | null) => {
    setSheet({
      itemIds: itemId === null ? [] : Array.isArray(itemId) ? itemId : [itemId],
    });
    setSheetOpen(true);
  }, []);

  const savedIds = useMemo(
    () => new Set(lists.flatMap((l) => l.itemIds)),
    [lists],
  );
  const isSaved = useCallback(
    (itemId: string) => savedIds.has(itemId),
    [savedIds],
  );
  const savedState = useCallback(
    (itemId: string): "none" | "favourites" | "other" => {
      const inOther = lists.some(
        (l) => l.kind !== "favourites" && l.itemIds.includes(itemId),
      );
      if (inOther) return "other";
      return lists.some(
        (l) => l.kind === "favourites" && l.itemIds.includes(itemId),
      )
        ? "favourites"
        : "none";
    },
    [lists],
  );
  const askFor = useCallback(
    (listId: string) => asks.find((a) => a.listId === listId),
    [asks],
  );

  const value = useMemo<ListsState>(
    () => ({
      loaded,
      failed,
      lists,
      asks,
      inbox,
      unread,
      isSaved,
      setFavourite,
      savedState,
      refresh,
      toggle,
      create,
      rename,
      removePiece,
      remove,
      openSheet,
      askFor,
    }),
    [
      loaded,
      failed,
      lists,
      asks,
      inbox,
      unread,
      isSaved,
      setFavourite,
      savedState,
      refresh,
      toggle,
      create,
      rename,
      removePiece,
      remove,
      openSheet,
      askFor,
    ],
  );

  return (
    <Context.Provider value={value}>
      {children}
      {sheet ? (
        <ListSheet
          open={sheetOpen}
          itemIds={sheet.itemIds}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </Context.Provider>
  );
}
