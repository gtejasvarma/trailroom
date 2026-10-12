"use client";
// Saving from anywhere. Two paths:
//  - `useSaveToList`: the explicit choice ("Add to a list"). A guest gets the account sheet with
//    the prototype's `list` reason (and the list sheet opens once they have signed in); a
//    signed-in person gets the list sheet at once.
//  - `useFavourite`: the heart. One tap saves to Favourites, for guests too.
import { useCallback, useRef } from "react";
import { copy } from "../lib/copy";
import { useAccount } from "./account-provider";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

export function useSaveToList(): (itemId: string | string[] | null) => void {
  const openAccount = useAccount();
  const { openSheet } = useLists();
  const { isGuest } = useMe();
  // Read at the moment of the call, not when a toast was made: "Change" can be tapped after the
  // page has learned who the person is.
  const guest = useRef(isGuest);
  guest.current = isGuest;
  return useCallback(
    (itemId: string | string[] | null) => {
      const first = Array.isArray(itemId) ? itemId[0] : itemId;
      if (guest.current) openAccount("list", { itemId: first ?? undefined });
      else openSheet(itemId);
    },
    [openAccount, openSheet],
  );
}

export function useFavourite(itemId: string): {
  saved: boolean;
  toggle: () => void;
} {
  const say = useToast();
  const changeLists = useSaveToList();
  const { savedState, setFavourite } = useLists();
  const state = savedState(itemId);

  const explain = (code: string) =>
    code === "list_full" ? copy.toasts.favouritesFull : copy.toasts.listFailed;

  const save = useCallback(async () => {
    say(copy.toasts.savedFavourites, {
      label: copy.toasts.changeLists,
      onClick: () => changeLists(itemId),
    });
    const r = await setFavourite(itemId, true);
    if (!r.ok) say(explain(r.code));
  }, [say, changeLists, setFavourite, itemId]);

  const unsave = useCallback(async () => {
    say(copy.toasts.removedFavourites, {
      label: copy.toasts.undo,
      onClick: () => void setFavourite(itemId, true),
    });
    const r = await setFavourite(itemId, false);
    if (!r.ok) say(explain(r.code));
  }, [say, setFavourite, itemId]);

  const toggle = useCallback(() => {
    if (state === "none") void save();
    else if (state === "favourites") void unsave();
    else changeLists(itemId);
  }, [state, save, unsave, changeLists, itemId]);

  return { saved: state !== "none", toggle };
}
