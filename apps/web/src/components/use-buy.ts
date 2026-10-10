"use client";
// "Buy" from anywhere: a guest gets the account sheet with the `buy` reason first (the buy sheet
// opens after sign-in); a signed-in person gets the buy sheet at once.
import { useCallback } from "react";
import { useAccount } from "./account-provider";
import { useOpenBuySheet } from "./buy-provider";
import { useMe } from "./me-provider";

export function useBuy(): (itemId: string) => void {
  const openAccount = useAccount();
  const openSheet = useOpenBuySheet();
  const { isGuest } = useMe();
  return useCallback(
    (itemId: string) => {
      if (isGuest) openAccount("buy", { itemId });
      else openSheet(itemId);
    },
    [isGuest, openAccount, openSheet],
  );
}
