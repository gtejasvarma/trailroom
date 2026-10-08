// Server-only: the catalogue image files that live in this package, as the source of truth for
// what gets copied to Cloud Storage (`catalog/<file>`). Nothing here talks to Storage; the
// Storage-backed loader is in @trailroom/pipeline (catalog-images.ts) so this package never
// imports Firebase. Kept out of the main entry so client bundles never import node:fs.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATALOG, PROOF_MODEL_FILE, getItem } from "./index";

// Resolved from process.cwd() (not import.meta.url: Turbopack would try to bundle the directory
// as an asset). Only dev, tests and scripts ever read it; production reads Cloud Storage and
// never calls readCatalogAsset, so the build does not need to trace these files.
//   repo root (vitest, tsx scripts, turbo): packages/catalog/assets/prototype
//   apps/web (next dev / next start):       ../../packages/catalog/assets/prototype
function assetsDir(): string {
  for (const rel of [
    "packages/catalog/assets/prototype",
    "../../packages/catalog/assets/prototype",
  ]) {
    const p = resolve(/*turbopackIgnore: true*/ process.cwd(), rel);
    if (existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  throw new Error(
    "packages/catalog/assets/prototype not found from " + process.cwd(),
  );
}

/** The object file name of an item's render image, or undefined if the item is unknown. */
export function catalogFileFor(id: string): string | undefined {
  return getItem(id)?.renderImage;
}

/** Every servable image file name, once each: item photographs and the Discover proof photo. */
export function catalogFiles(): string[] {
  return [
    ...new Set([
      ...CATALOG.flatMap((i) => i.photos.map((p) => p.file)),
      PROOF_MODEL_FILE,
    ]),
  ];
}

/** Whether `file` is a photograph of some catalogue item (the only names ever served). */
export function isCatalogFile(file: string): boolean {
  return catalogFiles().includes(file);
}

/** The content type for a catalogue file name. */
export function catalogContentType(file: string): string {
  return file.endsWith(".webp") ? "image/webp" : "image/jpeg";
}

/** Reads one file from packages/catalog/assets/prototype. Only catalogue names are accepted. */
export function readCatalogAsset(file: string): Buffer {
  if (!isCatalogFile(file)) throw new Error(`not a catalogue image: ${file}`);
  return readFileSync(/*turbopackIgnore: true*/ resolve(assetsDir(), file));
}
