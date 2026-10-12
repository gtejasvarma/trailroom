"use client";
// Where every "start this try-on" goes. An account is required to start a render (the server
// refuses a guest), so a guest gets the account sheet with the "tryon" reason instead, carrying
// the piece and the photo; the account provider starts the try-on once they have signed in.
import { useCallback } from "react";
import { peekUser } from "../lib/firebase";
import { startTryOnPath } from "../lib/flow";
import { useAccount } from "./account-provider";

export interface BeginOptions {
  photoId?: string;
  /** Their photo, shown beside the title of the sheet. */
  photoThumbUrl?: string;
  /** The sheet was dismissed: nothing was rendered. */
  onDismiss?: () => void;
}

/**
 * Resolves to where to go (the queue, or a failure screen), or null when the account sheet was
 * raised and the caller should stay where it is. Throws a plain Error for the UI.
 */
export function useStartTryOn(): (
  itemId: string,
  options?: BeginOptions,
) => Promise<string | null> {
  const openAccount = useAccount();
  return useCallback(
    async (itemId, { photoId, photoThumbUrl, onDismiss } = {}) => {
      const user = await peekUser();
      if (!user || user.isAnonymous) {
        openAccount("tryon", { itemId, photoId, photoThumbUrl, onDismiss });
        return null;
      }
      return startTryOnPath(itemId, photoId);
    },
    [openAccount],
  );
}
