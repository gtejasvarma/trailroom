"use client";
import { useEffect, useState } from "react";
import { apiRaw } from "./api";

/** Fetches a published render with the ID token and returns a blob URL (revoked on unmount). */
export function useRenderImage(
  poseSetId: string | null,
  pose: string | null,
  enabled = true,
): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{
    key: string;
    url: string | null;
    failed: boolean;
  }>({ key: "", url: null, failed: false });
  const key = poseSetId && pose && enabled ? `${poseSetId}/${pose}` : "";

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
