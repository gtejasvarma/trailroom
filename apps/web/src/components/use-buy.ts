"use client";
// "Buy" from anywhere: a guest gets the account sheet with the `buy` reason first (the buy sheet
// opens after sign-in); a signed-in person gets the buy sheet at once.
import { useCallback } from "react";
import { useAccount } from "./account-provider";
import { useOpenBuySheet } from "./buy-provider";
import { useMe } from "./me-provider";

export function useBuy(): (itemId: string | string[]) => void {
  const openAccount = useAccount();
  const openSheet = useOpenBuySheet();
  const { isGuest } = useMe();
  return useCallback(
    (itemId: string | string[]) => {
      if (isGuest)
        openAccount("buy", {
          itemId: Array.isArray(itemId) ? itemId[0] : itemId,
        });
      else openSheet(itemId);
    },
    [isGuest, openAccount, openSheet],
  );
}
