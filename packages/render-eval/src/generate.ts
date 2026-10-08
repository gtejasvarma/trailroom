// M1 Day 2: generate Pose Sets for open coding (BUILD_PLAN §2.4).
//
//   npm run eval:generate -- --dry-run            # validate fixtures, print plan + cost, no API calls
//   npm run eval:generate -- --run naive-v1-01    # generate (resumable: re-running skips done images)
//
// Output: runs/<run>/sheet/ is one flat folder in tools/label.html's naming scheme
// (identity__item__pose), plus run.json (config) and calls.jsonl (one line per model call).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  appendFileSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import {
  estimateCostUsd,
  MODELS,
  renderImage,
  SpendCeilingError,
  SpendMeter,
  type ModelKey,
} from "../../render/src/index";
import {
  buildPrompt,
  CATEGORIES,
  POSES,
  PROMPT_VERSION,
  type Category,
  type Pose,
  type Wearing,
} from "./prompt";

const ROOT = resolve(import.meta.dirname, "../../..");
const FIXTURES = join(ROOT, "fixtures");

interface Person {
  id: string;
  file: string;
  consentDate: string | null;
  sourceUrl?: string | null;
  generatedBy?: string | null; // synthetic person: which tool made the photo
  wearing: Wearing;
}
interface Garment {
  id: string;
  file: string;
  category: Category;
  description: string; // fills [TARGET_GARMENT_DESCRIPTION]
}
interface Job {
  person: Person;
  garment: Garment;
  pose: Pose;
  out: string; // path without extension
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};
const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    run: { type: "string" },
    // Comma-separated subsets, for small test runs: --people s01 --poses front
    people: { type: "string" },
    garments: { type: "string" },
    poses: { type: "string" },
    model: { type: "string", default: "nano-banana-2" },
    ceiling: { type: "string", default: "20" },
    concurrency: { type: "string", default: "4" },
    "dry-run": { type: "boolean", default: false },
  },
});

const model = args.model as ModelKey;
if (!(model in MODELS))
  fail(`unknown --model ${model}; one of ${Object.keys(MODELS).join(", ")}`);
const ceilingUsd = Number(args.ceiling);
const concurrency = Math.max(1, Number(args.concurrency));

const manifest = JSON.parse(
  readFileSync(join(FIXTURES, "manifest.json"), "utf8"),
) as { people: Person[]; garments: Garment[] };

// Provenance gates generation: every person needs a consent date, a recorded source URL (the
// relaxed rule in ADR 0002), or a record of the tool that generated them (synthetic people).
// No provenance, no renders of that person.
const problems: string[] = [];
for (const p of manifest.people) {
  if (!p.consentDate && !p.sourceUrl && !p.generatedBy)
    problems.push(
      `${p.id}: no consentDate, sourceUrl or generatedBy (see fixtures/CONSENT.md, ADR 0002)`,
    );
  if (!p.wearing?.top) problems.push(`${p.id}: wearing.top is required`);
  if (!existsSync(join(FIXTURES, p.file)))
    problems.push(`${p.id}: missing ${p.file}`);
}
for (const g of manifest.garments) {
  if (!existsSync(join(FIXTURES, g.file)))
    problems.push(`${g.id}: missing ${g.file}`);
}
for (const x of [...manifest.people, ...manifest.garments]) {
  if (!MIME[extname(x.file).toLowerCase()])
    problems.push(
      `${x.id}: ${extname(x.file)} isn't a Gemini input type; convert to .jpg ` +
        `(sips -s format jpeg in.avif --out out.jpg)`,
    );
  if (x.id.includes("__"))
    problems.push(`${x.id}: ids cannot contain "__" (labeler separator)`);
}
for (const g of manifest.garments) {
  if (!CATEGORIES.includes(g.category))
    problems.push(`${g.id}: category must be one of ${CATEGORIES.join(", ")}`);
  if (!g.description) problems.push(`${g.id}: description is required`);
}
if (problems.length) fail(`fixtures not ready:\n  ${problems.join("\n  ")}`);

const runId = args.run ?? `${PROMPT_VERSION}-${model}`;
const runDir = join(ROOT, "runs", runId);
const sheetDir = join(runDir, "sheet");

function subset<T>(all: T[], key: (x: T) => string, arg?: string): T[] {
  if (!arg) return all;
  const want = arg.split(",").map((s) => s.trim());
  const unknown = want.filter((w) => !all.some((x) => key(x) === w));
  if (unknown.length) fail(`unknown ids: ${unknown.join(", ")}`);
  return all.filter((x) => want.includes(key(x)));
}
const people = subset(manifest.people, (p) => p.id, args.people);
const garments = subset(manifest.garments, (g) => g.id, args.garments);
const poses = subset(Object.keys(POSES) as Pose[], (p) => p, args.poses);

const jobs: Job[] = [];
for (const person of people)
  for (const garment of garments)
    for (const pose of poses)
      jobs.push({
        person,
        garment,
        pose,
        out: join(sheetDir, `${person.id}__${garment.id}__${pose}`),
      });

const done = (j: Job) =>
  existsSync(sheetDir) &&
  readdirSync(sheetDir).some((f) =>
    f.startsWith(`${j.person.id}__${j.garment.id}__${j.pose}.`),
  );
const todo = jobs.filter((j) => !done(j));
const estUsd = todo.length * estimateCostUsd(model, 2);

console.log(
  `run ${runId}: ${people.length} people × ${garments.length} garments × ` +
    `${poses.length} poses = ${jobs.length} images ` +
    `(${jobs.length - todo.length} already done, ${todo.length} to go)`,
);
console.log(
  `model ${model} (${MODELS[model].id}), est. ≤ $${estUsd.toFixed(2)}, ceiling $${ceilingUsd.toFixed(2)}`,
);
if (estUsd > ceilingUsd)
  console.log(
    `note: estimate exceeds the ceiling; the run will stop when it is reached`,
  );
if (args["dry-run"]) process.exit(0);

// The repo's .env wins over the shell: a stale GEMINI_API_KEY exported in ~/.zshrc silently
// overrode it once (process.loadEnvFile never overwrites existing variables).
try {
  Object.assign(
    process.env,
    parseEnv(readFileSync(join(ROOT, ".env"), "utf8")),
  );
} catch {
  // no .env; GEMINI_API_KEY may already be in the environment
}
if (!process.env.GEMINI_API_KEY)
  fail("GEMINI_API_KEY is not set; add it to .env at the repo root");

mkdirSync(sheetDir, { recursive: true });
writeFileSync(
  join(runDir, "run.json"),
  JSON.stringify(
    {
      runId,
      model,
      modelId: MODELS[model].id,
      imageSize: "1K",
      aspectRatio: "3:4",
      strategy: "independent",
      promptVersion: PROMPT_VERSION,
      imageOrder: ["garment", "person"],
      poses: POSES,
      people: people.map((p) => p.id),
      garments: garments.map((g) => g.id),
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

// Pin references for the labeler: base photo per person, product image per garment.
for (const p of people)
  copyFileSync(
    join(FIXTURES, p.file),
    join(sheetDir, `${p.id}__base__base${extname(p.file)}`),
  );
for (const g of garments)
  copyFileSync(
    join(FIXTURES, g.file),
    join(sheetDir, `product__${g.id}__product${extname(g.file)}`),
  );

function load(file: string) {
  const ext = extname(file).toLowerCase();
  const mimeType = MIME[ext] ?? fail(`unsupported image type ${ext}`);
  return { mimeType, data: readFileSync(join(FIXTURES, file)) };
}

const meter = new SpendMeter(ceilingUsd);
const counts = { ok: 0, blocked: 0, no_image: 0, error: 0 };
let stopped = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5; // e.g. rate limits or a bad key: stop, then re-run to resume

async function runJob(j: Job) {
  const started = Date.now();
  const prompt = buildPrompt({
    pose: j.pose,
    category: j.garment.category,
    wearing: j.person.wearing,
    target: j.garment.description,
  });
  const res = await renderImage({
    model,
    prompt,
    // Order matters: the prompt calls the garment "Image 1" and the person "Image 2".
    images: [load(j.garment.file), load(j.person.file)],
    aspectRatio: "3:4",
    meter,
  });
  let file: string | null = null;
  if (res.ok) {
    file = j.out + (EXT[res.image.mimeType] ?? ".png");
    writeFileSync(file, res.image.data);
    counts.ok++;
  } else {
    counts[res.reason]++;
  }
  consecutiveErrors =
    !res.ok && res.reason === "error" ? consecutiveErrors + 1 : 0;
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !stopped) {
    stopped = true;
    console.error(`stopping: ${MAX_CONSECUTIVE_ERRORS} errors in a row`);
  }
  appendFileSync(
    join(runDir, "calls.jsonl"),
    JSON.stringify({
      ts: new Date().toISOString(),
      person: j.person.id,
      garment: j.garment.id,
      pose: j.pose,
      model: MODELS[model].id,
      promptVersion: PROMPT_VERSION,
      prompt,
      ok: res.ok,
      reason: res.ok ? null : res.reason,
      detail: res.ok ? null : res.detail,
      promptTokens: res.promptTokens,
      costUsd: Number(res.costUsd.toFixed(5)),
      latencyMs: Date.now() - started,
      file: file ? file.slice(runDir.length + 1) : null,
    }) + "\n",
  );
  const tag = res.ok ? "ok" : res.reason;
  console.log(
    `[${tag}] ${j.person.id} ${j.garment.id} ${j.pose}  ($${meter.spentUsd.toFixed(2)})` +
      (res.ok ? "" : `  ${res.detail}`),
  );
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (!stopped && queue.length) {
      const j = queue.shift()!;
      try {
        await runJob(j);
      } catch (err) {
        if (err instanceof SpendCeilingError) {
          stopped = true;
          console.error(`stopping: ${err.message}`);
        } else throw err;
      }
    }
  }),
);

console.log(
  `\ndone: ${counts.ok} ok, ${counts.blocked} blocked, ${counts.no_image} no image, ` +
    `${counts.error} errors, spent $${meter.spentUsd.toFixed(2)}` +
    (stopped ? " (stopped early; re-run to resume)" : ""),
);
console.log(`label: open tools/label.html → Open folder… → ${sheetDir}`);
