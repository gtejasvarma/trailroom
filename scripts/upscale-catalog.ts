// Re-renders the catalogue's small pose-set photographs (265 x 358) at the image model's 1K size
// (896 x 1200), because no larger original exists. Calls the real image model through the
// chokepoint with a hard ceiling of $1.50 (one image is about $0.04).
//   npx tsx scripts/upscale-catalog.ts dress-2-front.webp [more files...]
// Reads the untouched small originals from runs/upscale/original/ and writes the results to
// runs/upscale/out/ (both git-ignored) for review by eye; nothing in the catalogue is replaced
// until someone copies a result in. These are the invented labels' photographs, not people's
// photos, and the try-on prompt (edit-v1) is not involved.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import sharp from "sharp";
import { renderImage, SpendMeter } from "../packages/render/src/index";

const ROOT = resolve(import.meta.dirname, "..");
const envFile = [".env.deploy", ".env"]
  .map((f) => join(ROOT, f))
  .find((f) => existsSync(f));
const key = envFile
  ? parseEnv(readFileSync(envFile, "utf8")).GEMINI_API_KEY
  : undefined;
if (!key) throw new Error("GEMINI_API_KEY is missing from .env.deploy and .env");
process.env.GEMINI_API_KEY = key;
delete process.env.RENDER_PROVIDER;

const PROMPT = `Image 1 is a small, low-resolution fashion photograph. Reproduce this exact
photograph at high resolution. It is a restoration, not a new photograph.

Keep everything identical: the same person with the same face, facial features, expression, skin
tone, hair, body shape and proportions; the same pose and hand positions; the same garment with
the same colour, pattern, cut, seams, buttons and trims; the same background, objects, lighting,
camera angle and framing. Do not add, remove, move or restyle anything, and do not crop.

Only increase sharpness and fine detail: natural skin texture, individual strands of hair, fabric
weave and print detail, crisp edges. No painterly or plastic smoothing.

Output one photorealistic image with the same aspect ratio and framing as Image 1.`;

const files = process.argv.slice(2);
if (files.length === 0) throw new Error("name the files to upscale");
const src = join(ROOT, "runs", "upscale", "original");
const out = join(ROOT, "runs", "upscale", "out");
mkdirSync(out, { recursive: true });
const meter = new SpendMeter(1.5);
let failed = 0;
for (const file of files) {
  const started = Date.now();
  const res = await renderImage({
    model: "nano-banana-2.1",
    prompt: PROMPT,
    images: [
      {
        mimeType: "image/png",
        data: await sharp(join(src, file)).png().toBuffer(),
      },
    ],
    aspectRatio: "3:4",
    meter,
    meta: { pose: "front", jobId: `upscale-${file}`, attempt: 1 },
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (!res.ok) {
    failed++;
    console.log(`${file}: FAILED (${res.reason}) ${res.detail.slice(0, 200)}`);
    continue;
  }
  const name = file.replace(/\.webp$/, ".png");
  writeFileSync(join(out, name), res.image.data);
  console.log(`${file}: ok in ${secs}s, $${res.costUsd.toFixed(4)}`);
}
console.log(`spent $${meter.spentUsd.toFixed(4)}`);
process.exit(failed > 0 ? 2 : 0);
