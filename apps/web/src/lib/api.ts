"use client";
// Every call to /api/* carries a fresh Firebase ID token. Errors are { error, message }.
import type { MeBody } from "../server/me";
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

export const api = {
  me: () => apiFetch<MeBody>("/api/me"),
  consent: (version: string) =>
    apiFetch<unknown>(
      "/api/consent",
      json({ version, ageAttested18: true, accepted: true }),
    ),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.set("photo", file);
    return apiFetch<unknown>("/api/photo", { method: "POST", body: form });
  },
  deletePhoto: () => apiFetch<unknown>("/api/photo", { method: "DELETE" }),
  tryOn: (itemId: string) =>
    apiFetch<{ jobId: string; poseSetId: string; reused: boolean }>(
      "/api/try-on",
      json({ itemId }),
    ),
  attach: () => apiFetch<{ isGuest: false }>("/api/account/attach", json({})),
};
