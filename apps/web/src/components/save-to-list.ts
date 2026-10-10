"use client";
// "Save to a list" from anywhere: a guest gets the account sheet with the prototype's `list`
// reason (and the list sheet opens for the piece once they have signed in); a signed-in person gets
// the list sheet at once.
import { useCallback } from "react";
import { useAccount } from "./account-provider";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";

export function useSaveToList(): (itemId: string | string[] | null) => void {
  const openAccount = useAccount();
  const { openSheet } = useLists();
  const { isGuest } = useMe();
  return useCallback(
    (itemId: string | string[] | null) => {
      const first = Array.isArray(itemId) ? itemId[0] : itemId;
      if (isGuest) openAccount("list", { itemId: first ?? undefined });
      else openSheet(itemId);
    },
    [isGuest, openAccount, openSheet],
  );
}
