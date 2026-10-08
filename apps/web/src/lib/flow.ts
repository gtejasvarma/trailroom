"use client";
// Where "Try it on" goes. Readiness is checked first (it is catalogue data, so no upload is
// ever requested for a piece we would refuse), then consent, then the photo, then the render.
import { getItem, isRenderReady } from "@trailroom/catalog";
import { ApiError, api } from "./api";
import { copy } from "./copy";

export const paths = {
  catalogue: "/",
  item: (id: string) => `/item/${id}`,
  consent: (id: string) => `/item/${id}/consent`,
  photo: (id: string) => `/item/${id}/photo`,
  unavailable: (id: string) => `/item/${id}/unavailable`,
  signup: (id: string) => `/item/${id}/signup`,
  limit: (id: string) => `/item/${id}/limit`,
  tryOn: (jobId: string) => `/try-on/${jobId}`,
};

/** Starts (or reuses) the try-on and returns where to go. Throws a plain Error for the UI. */
export async function startTryOnPath(itemId: string): Promise<string> {
  try {
    const r = await api.tryOn(itemId);
    return paths.tryOn(r.jobId);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "not_ready") return paths.unavailable(itemId);
      if (e.code === "signup_required") return paths.signup(itemId);
      if (e.code === "daily_limit") return paths.limit(itemId);
      if (e.code === "consent_required") return paths.consent(itemId);
      if (e.code === "photo_required") return paths.photo(itemId);
    }
    throw new Error(messageOf(e));
  }
}

export async function routeForTryOn(itemId: string): Promise<string> {
  const item = getItem(itemId);
  if (!item) return paths.catalogue;
  if (!isRenderReady(item)) return paths.unavailable(itemId);
  let me;
  try {
    me = await api.me();
  } catch (e) {
    throw new Error(messageOf(e));
  }
  if (!me.consented) return paths.consent(itemId);
  if (!me.hasPhoto) return paths.photo(itemId);
  return startTryOnPath(itemId);
}

export function messageOf(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message;
  if (e instanceof TypeError) return copy.errors.network;
  return copy.errors.generic;
}
