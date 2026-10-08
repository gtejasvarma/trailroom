"use client";
// Where "Try it on" goes. Readiness is checked first (it is catalogue data, so no upload is
// ever requested for a piece we would refuse), then the photo, then the render.
import { getItem, isRenderReady } from "@trailroom/catalog";
import { ApiError, api } from "./api";
import { copy } from "./copy";

export const paths = {
  catalogue: "/",
  /** Upload first: not tied to a piece. */
  upload: "/upload",
  /** "Your photo is in": the starters screen after an upload-first upload. */
  starters: "/upload/done",
  item: (id: string) => `/item/${id}`,
  /** Upload for one piece; on success it goes straight into the try-on. */
  photo: (id: string) => `/item/${id}/photo`,
  /** "Which photo?" for one piece. */
  library: (id: string) => `/item/${id}/photos`,
  unavailable: (id: string) => `/item/${id}/unavailable`,
  signup: (id: string) => `/item/${id}/signup`,
  limit: (id: string) => `/item/${id}/limit`,
  tryOn: (jobId: string) => `/try-on/${jobId}`,
};

/** Starts (or reuses) the try-on and returns where to go. Throws a plain Error for the UI. */
export async function startTryOnPath(
  itemId: string,
  photoId?: string,
): Promise<string> {
  try {
    const r = await api.tryOn(itemId, photoId);
    return paths.tryOn(r.jobId);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "not_ready") return paths.unavailable(itemId);
      if (e.code === "signup_required") return paths.signup(itemId);
      if (e.code === "daily_limit") return paths.limit(itemId);
      if (e.code === "consent_required" || e.code === "photo_required")
        return paths.photo(itemId);
    }
    throw new Error(messageOf(e));
  }
}

export type TryOnRoute =
  | { kind: "go"; path: string }
  /** The person has photos: show "Which photo?" with their default. */
  | { kind: "choose" };

export async function routeForTryOn(itemId: string): Promise<TryOnRoute> {
  const item = getItem(itemId);
  if (!item) return { kind: "go", path: paths.catalogue };
  if (!isRenderReady(item))
    return { kind: "go", path: paths.unavailable(itemId) };
  let me;
  try {
    me = await api.me();
  } catch (e) {
    throw new Error(messageOf(e));
  }
  if (me.photoCount === 0) return { kind: "go", path: paths.photo(itemId) };
  return { kind: "choose" };
}

export function messageOf(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message;
  if (e instanceof TypeError) return copy.errors.network;
  return copy.errors.generic;
}
