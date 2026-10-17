"use client";
import { useEffect, useState } from "react";

/** Loads and decodes an image so it can be shown without a flash. */
export function useDecoded(url: string | null): boolean {
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const done = () => {
      if (!cancelled) setReady(url);
    };
    if (typeof img.decode === "function") img.decode().then(done, done);
    else img.onload = img.onerror = done;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return ready === url && url !== null;
}
