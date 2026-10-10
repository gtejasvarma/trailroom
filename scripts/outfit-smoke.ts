// Three outfits through the pipeline, against the real image model, with a hard $ ceiling.
// Firestore and Storage are the emulators; only the model call leaves the machine.
//   npm run emulators:exec -- "npx tsx scripts/outfit-smoke.ts"
// Spends real money: three renders at Nano Banana 2.1 is about $0.13 (one retry each would be
// about $0.26 at most); the hard cap is DAILY_CAP_USD=0.50, enforced by the spend ledger.
// Renders land in runs/outfit-smoke/ (git-ignored). The person is fixtures/people/s01.jpg, an
// AI-generated, fictional person (fixtures/manifest.json), so no real person's photo leaves here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

const ROOT = resolve(import.meta.dirname, "..");
const CEILING_USD = "0.50";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`outfit-smoke: three real outfit renders (outerwear over a dress, outerwear over a
top, and a second outerwear-over-top: the catalogue has no ready bottom, so "a top with a
bottom" cannot be exercised yet).

  npm run emulators:exec -- "npx tsx scripts/outfit-smoke.ts"

Needs the Firebase emulators (FIRESTORE_EMULATOR_HOST, FIREBASE_STORAGE_EMULATOR_HOST,
FIREBASE_AUTH_EMULATOR_HOST) and a GEMINI_API_KEY in .env.deploy (if present) or .env, which the
script reads when it runs. Refuses to run with RENDER_PROVIDER=fake.

Hard ceiling: DAILY_CAP_USD=${CEILING_USD}. Expected spend about $0.13; about $0.26 if every
render is retried. Images go to runs/outfit-smoke/. For each call it prints the outcome, the QA
verdict and reasons, the reserved estimate, the actual cost and the seconds taken.`);
  process.exit(0);
}

if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
) {
  console.error(
    "outfit-smoke only runs against the emulators (run it through `npm run emulators:exec`).",
  );
  process.exit(1);
}
if (process.env.RENDER_PROVIDER === "fake") {
  console.error(
    "RENDER_PROVIDER=fake is set; this script is for the real model.",
  );
  process.exit(1);
}
const envFile = [".env.deploy", ".env"]
  .map((f) => join(ROOT, f))
  .find((f) => existsSync(f));
const key = envFile
  ? parseEnv(readFileSync(envFile, "utf8")).GEMINI_API_KEY
  : undefined;
if (!key) {
  console.error("GEMINI_API_KEY is missing from .env.deploy and .env");
  process.exit(1);
}
process.env.GEMINI_API_KEY = key;
process.env.DAILY_CAP_USD = CEILING_USD;
process.env.ORCHESTRATOR = "inline";

const {
  FirestoreDailyLedger,
  firestore,
  getJob,
  getRender,
  recordConsent,
  utcDay,
} = await import("@trailroom/db");
const { OUTFIT_PROMPT_VERSION, renderConfigFromEnv } =
  await import("@trailroom/render");
const { awaitInlineRuns } = await import("../apps/web/src/server/orchestrator");
const { processPhoto } = await import("../apps/web/src/server/photo");
const { startOutfit } = await import("../apps/web/src/server/outfits");
const { CONSENT_VERSION } = await import("../apps/web/src/lib/consent");

const CASES: { layering: string; ids: [string, string] }[] = [
  { layering: "outerwear-over-dress", ids: ["coat", "slip"] },
  { layering: "outerwear-over-top", ids: ["coat", "blouse"] },
  // No ready bottom in the catalogue, so the third case is a second outerwear-over-top.
  { layering: "outerwear-over-top-2", ids: ["coat", "vest"] },
];

const config = renderConfigFromEnv();
console.log(
  `model ${config.model}, prompt ${OUTFIT_PROMPT_VERSION}, ceiling $${CEILING_USD}, ${CASES.length} outfits`,
);
console.log(
  "note: the catalogue has no ready bottom, so 'top with a bottom' is not run; the third case is a second outerwear-over-top.",
);

const user = { uid: `outfit-smoke-${Date.now()}`, isGuest: false };
await recordConsent(user.uid, CONSENT_VERSION);
const photo = await processPhoto(
  user,
  readFileSync(join(ROOT, "fixtures/people/s01.jpg")),
);
if (!photo.ok) throw new Error(`photo: ${JSON.stringify(photo)}`);

const out = join(ROOT, "runs", "outfit-smoke");
mkdirSync(out, { recursive: true });
const usd = (micros: number | null | undefined) =>
  `$${((micros ?? 0) / 1e6).toFixed(4)}`;

let failed = 0;
for (const c of CASES) {
  const name = `${c.layering}__${[...c.ids].sort().join("+")}`;
  const started = Date.now();
  const start = await startOutfit(user, { itemIds: c.ids });
  if (!start.ok) {
    console.log(`\n${name}: refused ${JSON.stringify(start)}`);
    failed++;
    continue;
  }
  await awaitInlineRuns();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const job = await getJob(start.body.jobId);
  if (!job) throw new Error("job vanished");
  console.log(`\n${name}: ${job.status} in ${seconds}s`, job.failure ?? "");
  const front = job.poses.front;
  for (const [n, a] of Object.entries(front?.attempts ?? {})) {
    console.log(
      `  attempt ${n}: outcome ${a.outcome ?? "none"}, QA ${a.qa?.verdict ?? "none"}${
        a.qa?.reasons.length ? ` (${a.qa.reasons.join(", ")})` : ""
      }`,
    );
  }
  const logs = await firestore()
    .collection("spendLog")
    .where("jobId", "==", start.body.jobId)
    .get();
  for (const doc of logs.docs) {
    const l = doc.data();
    console.log(
      `  call ${l.attempt}: estimate ${usd(l.estimateMicros)}, actual ${usd(l.actualMicros)} (${l.state})`,
    );
  }
  const render = await getRender(user.uid, job.poseSetId, "front");
  if (render) {
    writeFileSync(join(out, `${name}.jpg`), render.data);
    console.log(`  saved runs/outfit-smoke/${name}.jpg`);
  } else {
    console.log("  no image published");
    failed++;
  }
}

const day = await new FirestoreDailyLedger(Number(CEILING_USD)).getDay(
  utcDay(new Date()),
);
console.log(
  `\nspend today: committed ${usd(day?.committedMicros)}, pending ${usd(day?.pendingMicros)}, ceiling $${CEILING_USD}`,
);
process.exit(failed > 0 ? 2 : 0);
