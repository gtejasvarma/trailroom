// Test-only helpers for the API emulator tests. Never imported by product code.
import sharp from "sharp";
import {
  claimPoseSet,
  createJob,
  getDefaultPhotoId,
  getJob,
  poseSetId as makePoseSetId,
} from "@trailroom/db";
import { PROMPT_VERSION, renderConfigFromEnv } from "@trailroom/render";
import { clearFirestore } from "../../../../packages/db/src/emu-helpers";
import { clearBucket } from "../../../../packages/pipeline/src/testkit";
import { CONSENT_VERSION } from "../lib/consent";
import { POST as photoPOST } from "../app/api/photo/route";
import { startRender } from "./orchestrator";

const host = () => process.env.FIREBASE_AUTH_EMULATOR_HOST!;

async function signUp(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(
    `http://${host()}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true, ...body }),
    },
  );
  const j = (await res.json()) as { idToken?: string };
  if (!j.idToken) throw new Error(`auth emulator sign-up failed`);
  return j.idToken;
}

export const anonymousToken = () => signUp({});
let n = 0;
export const emailToken = () =>
  signUp({
    email: `user${Date.now()}-${n++}@example.com`,
    password: "correct-horse-battery",
  });

export function uidOf(token: string): string {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString())
    .user_id;
}

export function req(
  method: string,
  path: string,
  opts: {
    token?: string;
    json?: unknown;
    body?: BodyInit;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body = opts.body;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  return new Request(`http://localhost${path}`, { method, headers, body });
}

export function photoForm(
  buf: Buffer,
  filename = "me.jpg",
  type = "image/jpeg",
  withConsent = true,
): FormData {
  const form = new FormData();
  form.set("photo", new Blob([new Uint8Array(buf)], { type }), filename);
  if (withConsent) form.set("consent", CONSENT_VERSION);
  return form;
}

export async function reset(): Promise<void> {
  await clearFirestore();
  await clearBucket();
}

/** A smooth gradient JPEG of the given pixel size. */
export async function image(
  w: number,
  h: number,
  format: "jpeg" | "png" | "webp" | "gif" | "tiff" = "jpeg",
): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      raw[o] = (x * 255) / w;
      raw[o + 1] = (y * 255) / h;
      raw[o + 2] = 90;
    }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    [format]()
    .toBuffer();
}

/** Uploads a photo and returns its id. */
export async function uploadOk(token: string, w = 800, h = 1000) {
  const res = await photoPOST(
    req("POST", "/api/photo", {
      token,
      body: photoForm(await image(w, h)),
    }),
  );
  if (res.status !== 200) throw new Error(`upload failed ${res.status}`);
  return (await res.json()).photoId as string;
}

export async function waitForJob(
  jobId: string,
  getJob: (id: string) => Promise<{ status: string } | null>,
): Promise<string> {
  for (let i = 0; i < 300; i++) {
    const j = await getJob(jobId);
    if (j && ["complete", "complete_partial", "failed"].includes(j.status))
      return j.status;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("job did not finish");
}

/**
 * A finished try-on held by a guest, made the way a guest could before an account became required
 * to start a render (POST /api/try-on now refuses a guest). Guests keep such try-ons for up to 48
 * hours, and the rules that protect them (tiles only, account_required for full size, the merge on
 * sign-in, the purge) are still tested against it. The guest must have uploaded a photo.
 */
export async function leftoverGuestTryOn(
  token: string,
  itemId = "blouse",
): Promise<{ jobId: string; poseSetId: string }> {
  const uid = uidOf(token);
  const photoId = await getDefaultPhotoId(uid);
  if (!photoId) throw new Error("the guest has no photo");
  const cfg = renderConfigFromEnv();
  const poses = cfg.poses as string[];
  const psId = makePoseSetId(uid, photoId, itemId);
  const { id: jobId } = await createJob({
    uid,
    itemId,
    photoId,
    poseSetId: psId,
    poseOrder: poses,
    poses: Object.fromEntries(
      poses.map((p) => [p, { status: "pending", attempt: 0, reasons: [] }]),
    ),
    qaSkipped: [],
    model: cfg.model,
    promptVersion: PROMPT_VERSION,
    isGuest: true,
  });
  await claimPoseSet({ uid, itemId, photoId, jobId, isGuest: true });
  await startRender(jobId);
  await waitForJob(jobId, getJob);
  return { jobId, poseSetId: psId };
}
