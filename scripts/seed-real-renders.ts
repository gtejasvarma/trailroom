// Test fixture, EMULATORS ONLY: replaces the fake renderer's coloured test pattern in one finished
// pose set with real images (the pink wrap top on the fictional test person, from runs/hero-proof/),
// so review screenshots of the mirror show a real result. Test-only; nothing here is in the product.
// Usage: tsx scripts/seed-real-renders.ts <uid> <poseSetId>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTarget } from "@trailroom/pipeline";

try {
  const t = resolveTarget(process.env);
  if (t.kind !== "emulator") throw new Error("emulators only");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
const [uid, poseSetId] = process.argv.slice(2);
if (!uid || !poseSetId) {
  console.error("usage: seed-real-renders.ts <uid> <poseSetId>");
  process.exit(2);
}
const { publishRender } = await import("@trailroom/db");
const DIR = join(import.meta.dirname, "..", "runs", "hero-proof");
const FILES: Record<string, string> = {
  front: "blouse-on-s01.png",
  "three-quarter": "blouse-on-s01-three-quarter.png",
  walking: "blouse-on-s01-walking.png",
  seated: "blouse-on-s01-seated.png",
};
for (const [pose, file] of Object.entries(FILES))
  await publishRender(uid, poseSetId, pose, readFileSync(join(DIR, file)));
console.log(JSON.stringify({ seeded: Object.keys(FILES) }));
process.exit(0);
