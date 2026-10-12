"use client";
// The upload screen. A routed screen with two entry paths: upload first (not tied to a piece, goes
// on to "Your photo is in") and from a piece (goes straight into the try-on). The phone shows the
// system picker as the primary control; from 768px it is a drop zone with Browse files.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getItem } from "@trailroom/catalog";
import { accountGateAfterUpload } from "../lib/account-gate";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import { h1, page } from "../lib/ui";
import { useAccount } from "./account-provider";
import { useMe } from "./me-provider";
import { PhotoAdd } from "./photo-add";
import { useStartTryOn } from "./use-start-try-on";

export function UploadScreen({ itemId }: { itemId?: string }) {
  const router = useRouter();
  const openAccount = useAccount();
  const begin = useStartTryOn();
  const { loaded, isGuest } = useMe();
  const [starting, setStarting] = useState(false);
  const item = itemId ? getItem(itemId) : undefined;

  return (
    <div className={`${page} max-w-[520px]`}>
      <div className="md:rounded-xl md:border md:border-line md:p-8">
        <h1 className={h1}>
          {item ? copy.photo.titlePiece : copy.photo.titleUpload}
        </h1>
        <p className="mt-1 mb-5 text-[15px] leading-[22px] text-ink-700">
          {item
            ? loaded && isGuest
              ? copy.photo.subPieceGuest(item.name)
              : copy.photo.subPiece(item.name)
            : copy.photo.subUpload}
        </p>
        <PhotoAdd
          busyText={starting ? copy.photo.starting : null}
          onAdded={async (photo) => {
            if (item) {
              setStarting(true);
              try {
                // A guest gets the account sheet here, where the try-on used to start; the
                // photo is kept, and not now leaves them at the piece.
                const path = await begin(item.id, {
                  photoId: photo.photoId,
                  photoThumbUrl: `/api/photos/${photo.photoId}/thumb`,
                  onDismiss: () => router.push(paths.item(item.id)),
                });
                if (path) router.push(path);
                else setStarting(false);
              } catch (e) {
                setStarting(false);
                throw new Error(messageOf(e));
              }
              return;
            }
            const gated = await accountGateAfterUpload(() =>
              openAccount("picknext", {
                photoThumbUrl: `/api/photos/${photo.photoId}/thumb`,
                // Not now: the photo stays with the guest session, and Discover is next.
                onDismiss: () => router.push(paths.catalogue),
              }),
            );
            if (!gated) router.push(paths.starters);
          }}
        />
      </div>
    </div>
  );
}
