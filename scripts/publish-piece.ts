// Publishes a piece to a label, or changes a published piece's price, with no back office. It
// writes the piece to Firestore (publishedPieces), its images to Cloud Storage under catalog/, and
// records the event that the follow loop reads (new-arrival and price-change emails, the buffer).
//
//   npm run emulators:exec -- "npx tsx scripts/publish-piece.ts --spec path/to/piece.json"
//   npm run emulators:exec -- "npx tsx scripts/publish-piece.ts --set-price <piece-id> --price 120"
//
// It REFUSES to run against a real project unless --allow-real-project <project id> names that
// project: production operations are run by the owner, by hand. The spec is a JSON piece (see
// packages/catalog/src/published.ts for the fields) whose photos name local image files:
//   "photos": [{ "path": "front.jpg", "label": "Front", "focus": "50% 26%" }]
// Paths are relative to the spec file. The copy is checked against the catalogue's copy rules (no
// fit or size language) and the piece is refused, with every problem listed, if it does not pass.
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveTarget } from "@trailroom/pipeline";

const { values } = parseArgs({
  options: {
    spec: { type: "string" },
    "set-price": { type: "string" },
    price: { type: "string" },
    "allow-real-project": { type: "string" },
  },
  strict: true,
});

let target;
try {
  target = resolveTarget(process.env, values["allow-real-project"]);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
// Only now is Firebase touched.
const { changePiecePrice, publishPiece } = await import("@trailroom/pipeline");
console.log(`target: ${target.kind} ${target.projectId}`);

const EXT = /^\.(jpg|jpeg|png|webp)$/i;

if (values["set-price"]) {
  const price = Number(values.price);
  const r = await changePiecePrice(values["set-price"], price);
  if (!r.ok) {
    console.error(`not changed: ${r.problem}`);
    process.exit(1);
  }
  console.log(
    `price of ${values["set-price"]} changed from ${r.oldPriceUsd} to ${price} (event ${r.eventId})`,
  );
  process.exit(0);
}

if (!values.spec) {
  console.error("give --spec <piece.json>, or --set-price <id> --price <usd>");
  process.exit(2);
}
const specPath = resolve(values.spec);
const raw = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown> & {
  id?: string;
  photos?: { path?: string; label?: string; focus?: string }[];
};
const photos = Array.isArray(raw.photos) ? raw.photos : [];
const images: { file: string; data: Buffer }[] = [];
const stored = photos.map((p, i) => {
  const ext = extname(String(p.path ?? "")).toLowerCase();
  if (!p.path || !EXT.test(ext)) return { ...p, file: "" };
  const file = `${String(raw.id)}-${i + 1}${ext === ".jpeg" ? ".jpg" : ext}`;
  images.push({ file, data: readFileSync(resolve(dirname(specPath), p.path)) });
  return { file, label: p.label, focus: p.focus };
});
const result = await publishPiece({ ...raw, photos: stored }, images);
if (!result.ok) {
  console.error("not published:\n" + result.problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(
  `published ${result.item.id} (${result.item.name}) to ${result.item.label}; event ${result.eventId}`,
);
process.exit(0);
