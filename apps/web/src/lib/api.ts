"use client";
// Every call to /api/* carries a fresh Firebase ID token. Errors are { error, message }.
import type { MeBody } from "../server/me";
import type { TryOnSummary } from "../server/try-ons";
import { CONSENT_VERSION } from "./consent";
import { ensureUser } from "./firebase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function authedHeaders(init?: HeadersInit): Promise<Headers> {
  const user = await ensureUser();
  const headers = new Headers(init);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return headers;
}

export async function apiRaw(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: await authedHeaders(init.headers),
    cache: "no-store",
  });
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiRaw(path, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof body.error === "string" ? body.error : "unknown",
      typeof body.message === "string" ? body.message : "",
      body,
    );
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface PhotoSummary {
  id: string;
  label: string;
  isDefault: boolean;
  thumbUrl: string;
}

export interface UploadedPhoto {
  photoId: string;
  isDefault: boolean;
  label: string;
  width: number;
  height: number;
}

export const api = {
  me: () => apiFetch<MeBody>("/api/me"),
  tryOns: () => apiFetch<{ tryOns: TryOnSummary[] }>("/api/try-ons"),
  /** The consent version rides along with every upload; the server records it, then stores. */
  uploadPhoto: (file: Blob, filename = "photo.jpg") => {
    const form = new FormData();
    form.set("photo", file, filename);
    form.set("consent", CONSENT_VERSION);
    return apiFetch<UploadedPhoto>("/api/photo", {
      method: "POST",
      body: form,
    });
  },
  photos: () =>
    apiFetch<{ photos: PhotoSummary[]; defaultPhotoId: string | null }>(
      "/api/photos",
    ),
  makeDefault: (photoId: string) =>
    apiFetch<{ defaultPhotoId: string }>(`/api/photos/${photoId}/default`, {
      method: "POST",
    }),
  removePhoto: (photoId: string) =>
    apiFetch<{ defaultPhotoId: string | null }>(`/api/photos/${photoId}`, {
      method: "DELETE",
    }),
  /** Everything: every photo, try-on and the consent record. */
  deleteEverything: () => apiFetch<unknown>("/api/photo", { method: "DELETE" }),
  tryOn: (itemId: string, photoId?: string) =>
    apiFetch<{ jobId: string; poseSetId: string; reused: boolean }>(
      "/api/try-on",
      json({ itemId, photoId }),
    ),
  merge: (guestToken: string) =>
    apiFetch<unknown>("/api/account/merge", json({ guestToken })),
  attach: () => apiFetch<{ isGuest: false }>("/api/account/attach", json({})),
};
