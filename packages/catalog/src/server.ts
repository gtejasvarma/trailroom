// Server-only: the licence-clean garment image files that live in this package, as the source of
// truth for what gets copied to Cloud Storage (`catalog/<file>`). Nothing here talks to Storage;
// the Storage-backed loader is in @trailroom/pipeline (catalog-images.ts) so this package never
// imports Firebase. Kept out of the main entry so client bundles never import node:fs.
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { CATALOG, getItem } from "./index";

// Resolved from process.cwd() (not import.meta.url: Turbopack would try to bundle the directory
// as an asset). Only dev, tests and scripts ever read it; production reads Cloud Storage and
// never calls readCatalogAsset, so the build does not need to trace these files.
//   repo root (vitest, tsx scripts, turbo): packages/catalog/assets
//   apps/web (next dev / next start):       ../../packages/catalog/assets
function assetsDir(): string {
  for (const rel of [
    "packages/catalog/assets",
    "../../packages/catalog/assets",
  ]) {
    const p = resolve(/*turbopackIgnore: true*/ process.cwd(), rel);
    if (existsSync(/*turbopackIgnore: true*/ p)) return p;
  }
  throw new Error("packages/catalog/assets not found from " + process.cwd());
}

/** The object file name for an item (the basename of item.image), or undefined if unknown. */
export function catalogFileFor(id: string): string | undefined {
  const item = getItem(id);
  return item ? basename(item.image) : undefined;
}

/** Every catalogue image file name, one per item. */
export function catalogFiles(): string[] {
  return CATALOG.map((i) => basename(i.image));
}

/** Whether `file` is the image file of some catalogue item (the only names ever served). */
export function isCatalogFile(file: string): boolean {
  return catalogFiles().includes(file);
}

/** Reads one file from packages/catalog/assets. Only names in the catalogue are accepted. */
export function readCatalogAsset(file: string): Buffer {
  if (!isCatalogFile(file)) throw new Error(`not a catalogue image: ${file}`);
  return readFileSync(/*turbopackIgnore: true*/ resolve(assetsDir(), file));
}
