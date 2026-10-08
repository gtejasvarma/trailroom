"use client";
// The upload screen. A routed screen with two entry paths: upload first (not tied to a piece, goes
// on to "Your photo is in") and from a piece (goes straight into the try-on). The phone shows the
// system picker as the primary control; from 768px it is a drop zone with Browse files.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getItem } from "@trailroom/catalog";
import { accountGateAfterUpload } from "../lib/account-gate";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { h1, page } from "../lib/ui";
import { PhotoAdd } from "./photo-add";

export function UploadScreen({ itemId }: { itemId?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const item = itemId ? getItem(itemId) : undefined;

  return (
    <div className={`${page} max-w-[520px]`}>
      <div className="md:rounded-xl md:border md:border-line md:p-8">
        <h1 className={h1}>
          {item ? copy.photo.titlePiece : copy.photo.titleUpload}
        </h1>
        <p className="mt-1 mb-5 text-[15px] leading-[22px] text-ink-700">
          {item ? copy.photo.subPiece(item.name) : copy.photo.subUpload}
        </p>
        <PhotoAdd
          busyText={starting ? copy.photo.starting : null}
          onAdded={async (photo) => {
            if (item) {
              setStarting(true);
              try {
                router.push(await startTryOnPath(item.id, photo.photoId));
              } catch (e) {
                setStarting(false);
                throw new Error(messageOf(e));
              }
              return;
            }
            await accountGateAfterUpload();
            router.push(paths.starters);
          }}
        />
      </div>
    </div>
  );
}
