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
  /** Adds the piece to the list, or removes it if it is already there. */
  toggle: (listId: string, itemId: string) => Promise<ListResult>;
  create: (name: string, itemId?: string) => Promise<ListResult>;
  rename: (listId: string, name: string) => Promise<ListResult>;
  removePiece: (listId: string, itemId: string) => Promise<ListResult>;
  remove: (listId: string) => Promise<boolean>;
  /** Opens the list sheet for a piece (or with no piece, to make a list). Signed-in people only. */
  openSheet: (itemId: string | null) => void;
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

const codeOf = (e: unknown) => (e instanceof ApiError ? e.code : "unknown");

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const { loaded: meLoaded, isGuest } = useMe();
  const pathname = usePathname();
  const say = useToast();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lists, setLists] = useState<ListBody[]>([]);
  const [asks, setAsks] = useState<AskSummary[]>([]);
  const [inbox, setInbox] = useState<InboxSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [sheet, setSheet] = useState<{ itemId: string | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const signedIn = meLoaded && !isGuest;

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setLists([]);
      setAsks([]);
      setInbox([]);
      setUnread(0);
      setFailed(false);
      setLoaded(meLoaded);
      return;
    }
    try {
      const [l, a, i] = await Promise.all([
        api.lists(),
        api.asks(),
        api.inbox(),
      ]);
      if (!alive.current) return;
      setLists(l.lists);
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
    setLists((prev) => prev.map((l) => (l.id === list.id ? list : l)));

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

  const create = useCallback(
    async (name: string, itemId?: string): Promise<ListResult> => {
      try {
        const { list } = await api.createList(name, itemId);
        setLists((prev) => [list, ...prev]);
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

  const openSheet = useCallback((itemId: string | null) => {
    setSheet({ itemId });
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
          itemId={sheet.itemId}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </Context.Provider>
  );
}
