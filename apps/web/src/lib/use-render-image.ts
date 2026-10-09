"use client";
import { useEffect, useState } from "react";
import { apiRaw } from "./api";

/** Fetches a published render with the ID token and returns a blob URL (revoked on unmount). */
export function useRenderImage(
  poseSetId: string | null,
  pose: string | null,
  enabled = true,
  size: "tile" | "full" = "full",
): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{
    key: string;
    url: string | null;
    failed: boolean;
  }>({ key: "", url: null, failed: false });
  const key =
    poseSetId && pose && enabled
      ? `${poseSetId}/${pose}${size === "tile" ? "?size=tile" : ""}`
      : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiRaw(`/api/renders/${key}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ key, url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, url: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key]);

  if (!key || state.key !== key) return { url: null, failed: false };
  return { url: state.url, failed: state.failed };
}

/** Several poses of one set at once (a card's frames). Urls are in `poses` order; null while loading. */
export function useRenderImages(
  poseSetId: string | null,
  poses: string[],
  size: "tile" | "full" = "full",
): (string | null)[] {
  const joined = poses.join(",");
  const [state, setState] = useState<{
    key: string;
    urls: (string | null)[];
  }>({ key: "", urls: [] });
  const key = poseSetId && joined ? `${poseSetId}|${joined}|${size}` : "";

  useEffect(() => {
    if (!key || !poseSetId) return;
    let cancelled = false;
    const made: string[] = [];
    Promise.all(
      joined.split(",").map(async (pose) => {
        try {
          const res = await apiRaw(
            `/api/renders/${poseSetId}/${pose}${size === "tile" ? "?size=tile" : ""}`,
          );
          if (!res.ok) return null;
          const url = URL.createObjectURL(await res.blob());
          made.push(url);
          return url;
        } catch {
          return null;
        }
      }),
    ).then((urls) => {
      if (cancelled) made.forEach((u) => URL.revokeObjectURL(u));
      else setState({ key, urls });
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [key, poseSetId, joined, size]);

  return state.key === key ? state.urls : [];
}
