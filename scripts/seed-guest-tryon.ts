// Test fixture, EMULATORS ONLY: makes a finished try-on for an existing guest session, the way a
// guest could before an account became required to start a render (a guest can still hold such a
// try-on for up to 48 hours). The product no longer lets a guest start one, so the e2e specs that
// cover a leftover try-on (the tile-only queue, the account sheet, the sign-in that opens it) seed
// it here. Usage: tsx scripts/seed-guest-tryon.ts <guestUid> <itemId>. Prints { jobId }.
import { resolveTarget } from "@trailroom/pipeline";

try {
  const t = resolveTarget(process.env);
  if (t.kind !== "emulator") throw new Error("emulators only");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
const [uid, itemId] = process.argv.slice(2);
if (!uid || !itemId) {
  console.error("usage: seed-guest-tryon.ts <guestUid> <itemId>");
  process.exit(2);
}
const { claimPoseSet, createJob, getDefaultPhotoId, poseSetId } =
  await import("@trailroom/db");
const { PROMPT_VERSION, renderConfigFromEnv } =
  await import("@trailroom/render");
const { runInline } = await import("@trailroom/pipeline");

const photoId = await getDefaultPhotoId(uid);
if (!photoId) throw new Error("that guest has no photo");
const cfg = renderConfigFromEnv();
const poses = cfg.poses as string[];
const { id: jobId } = await createJob({
  uid,
  itemId,
  photoId,
  poseSetId: poseSetId(uid, photoId, itemId),
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
await runInline(jobId);
console.log(JSON.stringify({ jobId }));
process.exit(0);
