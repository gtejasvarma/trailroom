// The hero's proof pair: one real render of a catalogue piece on the fictional test person, so
// both sides of the home page slider show the same piece. Calls the real image model through the
// chokepoint with a hard ceiling of $0.15 (one render is about $0.04).
//   npx tsx scripts/hero-proof.ts [itemId] [pose]   (pose: front, three-quarter, walking, seated)
// The person is fixtures/people/s01 (AI-generated, fictional: fixtures/manifest.json), so no real
// person's photo leaves here. The render lands in runs/hero-proof/ (git-ignored) for review.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import sharp from "sharp";
import { getItem } from "../packages/catalog/src/index";
import {
  buildPrompt,
  GENERIC_WEARING,
  POSES,
  type Pose,
  renderImage,
  SpendMeter,
  type Category,
} from "../packages/render/src/index";

const ROOT = resolve(import.meta.dirname, "..");
const envFile = [".env.deploy", ".env"]
  .map((f) => join(ROOT, f))
  .find((f) => existsSync(f));
const key = envFile
  ? parseEnv(readFileSync(envFile, "utf8")).GEMINI_API_KEY
  : undefined;
if (!key)
  throw new Error("GEMINI_API_KEY is missing from .env.deploy and .env");
process.env.GEMINI_API_KEY = key;
delete process.env.RENDER_PROVIDER;

const item = getItem(process.argv[2] ?? "blouse");
const pose = (process.argv[3] ?? "front") as Pose;
if (!(pose in POSES)) throw new Error(`unknown pose ${pose}`);
if (!item?.category)
  throw new Error("unknown piece, or one with no prompt category");
const personFile = [
  "fixtures/people/Gemini_Generated_Image_z3d9y6z3d9y6z3d9.png",
  "fixtures/people/s01.jpg",
]
  .map((f) => join(ROOT, f))
  .find((f) => existsSync(f));
if (!personFile)
  throw new Error("the s01 test person is missing from fixtures/people");

const jpeg = (file: string, edge: number) =>
  sharp(file)
    .rotate()
    .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();

const meter = new SpendMeter(0.15);
const started = Date.now();
const res = await renderImage({
  model: "nano-banana-2.1",
  prompt: buildPrompt({
    pose,
    category: item.category as Category,
    wearing: GENERIC_WEARING,
    target: item.promptDescription,
  }),
  images: [
    {
      mimeType: "image/jpeg",
      data: await jpeg(
        join(ROOT, "packages/catalog/assets/prototype", item.renderImage),
        1536,
      ),
    },
    { mimeType: "image/jpeg", data: await jpeg(personFile, 1536) },
  ],
  aspectRatio: "3:4",
  meter,
  meta: { pose, jobId: "hero-proof", attempt: 1 },
});
const secs = ((Date.now() - started) / 1000).toFixed(1);
if (!res.ok) {
  console.log(
    `FAILED (${res.reason}) in ${secs}s: ${res.detail.slice(0, 300)}`,
  );
  process.exit(2);
}
const out = join(ROOT, "runs", "hero-proof");
mkdirSync(out, { recursive: true });
const name = pose === "front" ? `${item.id}-on-s01.png` : `${item.id}-on-s01-${pose}.png`;
writeFileSync(join(out, name), res.image.data);
console.log(
  `OK in ${secs}s, cost $${res.costUsd.toFixed(4)}: runs/hero-proof/${name}`,
);
