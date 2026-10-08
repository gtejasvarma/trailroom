// One real Pose Set through the pipeline, against the real image model, with a hard $ ceiling.
// Firestore and Storage are the emulators; only the model call leaves the machine.
//   npm run emulators:exec -- "npx tsx scripts/live-smoke.ts [itemId] [photo path]"
// Spends real money (about $0.16 at Nano Banana 2.1). Renders land in runs/live-smoke/ (git-ignored).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import {
  FirestoreDailyLedger,
  firestore,
  getJob,
  getRender,
  utcDay,
} from "@trailroom/db";
import { renderConfigFromEnv } from "@trailroom/render";
import { acceptConsent } from "../apps/web/src/server/consent";
import { awaitInlineRuns } from "../apps/web/src/server/orchestrator";
import { processPhoto } from "../apps/web/src/server/photo";
import { startTryOn } from "../apps/web/src/server/tryon";
import { CONSENT_VERSION } from "../apps/web/src/lib/consent";

const ROOT = resolve(import.meta.dirname, "..");
const CEILING_USD = "0.25";

if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST
) {
  console.error("live-smoke only runs against the emulators.");
  process.exit(1);
}
if (process.env.RENDER_PROVIDER === "fake") {
  console.error(
    "RENDER_PROVIDER=fake is set; this script is for the real model.",
  );
  process.exit(1);
}
const key = parseEnv(readFileSync(join(ROOT, ".env"), "utf8")).GEMINI_API_KEY;
if (!key) {
  console.error("GEMINI_API_KEY is missing from .env");
  process.exit(1);
}
process.env.GEMINI_API_KEY = key;
process.env.DAILY_CAP_USD = CEILING_USD;
process.env.ORCHESTRATOR = "inline";

const itemId = process.argv[2] ?? "g-denim-jacket";
// s01 is an AI-generated, fictional person (fixtures/manifest.json), so no real person's photo
// is sent anywhere by this check.
const photoPath = process.argv[3] ?? join(ROOT, "fixtures/people/s01.jpg");
const user = { uid: `live-smoke-${Date.now()}`, isGuest: true };
const config = renderConfigFromEnv();
console.log(
  `model ${config.model}, poses ${config.poses.join(", ")}, ceiling $${CEILING_USD}, item ${itemId}`,
);

const consent = await acceptConsent(user, {
  version: CONSENT_VERSION,
  ageAttested18: true,
  accepted: true,
});
if (!consent.ok) throw new Error(`consent: ${JSON.stringify(consent)}`);
const photo = await processPhoto(user, readFileSync(photoPath));
if (!photo.ok) throw new Error(`photo: ${JSON.stringify(photo)}`);
console.log(`photo stored at ${photo.body.width}x${photo.body.height}`);

const started = Date.now();
const start = await startTryOn(user, { itemId });
if (!start.ok) throw new Error(`try-on: ${JSON.stringify(start)}`);
await awaitInlineRuns();
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const job = await getJob(start.body.jobId);
if (!job) throw new Error("job vanished");
console.log(`\njob ${job.status} in ${seconds}s`, job.failure ?? "");
for (const pose of job.poseOrder) {
  const p = job.poses[pose]!;
  console.log(
    `  ${pose.padEnd(14)} ${p.status.padEnd(8)} attempt ${p.attempt} ${p.reasons.join(",")}`,
  );
}
console.log(`  checks not run: ${job.qaSkipped.join(", ")}`);

const out = join(ROOT, "runs", "live-smoke");
mkdirSync(out, { recursive: true });
let saved = 0;
for (const pose of job.poseOrder) {
  const render = await getRender(user.uid, job.poseSetId, pose);
  if (!render) continue;
  writeFileSync(join(out, `${itemId}__${pose}.jpg`), render.data);
  saved++;
}
console.log(`${saved} renders saved to runs/live-smoke/`);

const day = await new FirestoreDailyLedger(Number(CEILING_USD)).getDay(
  utcDay(new Date()),
);
const logs = await firestore().collection("spendLog").get();
console.log(
  `\nspend: committed $${((day?.committedMicros ?? 0) / 1e6).toFixed(4)}, ` +
    `pending $${((day?.pendingMicros ?? 0) / 1e6).toFixed(4)}, ${logs.size} model calls`,
);
for (const doc of logs.docs) {
  const l = doc.data();
  console.log(
    `  ${String(l.pose).padEnd(14)} attempt ${l.attempt} est $${(l.estimateMicros / 1e6).toFixed(4)} ` +
      `actual $${((l.actualMicros ?? 0) / 1e6).toFixed(4)} ${l.state}`,
  );
}
process.exit(job.status === "failed" ? 2 : 0);
