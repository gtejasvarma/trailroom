// The Storage-backed garment image loader. Garment images live at `catalog/<file>` in the app
// bucket; the repo copies (packages/catalog/assets) are only the source for seeding.
//
// Lives in @trailroom/pipeline (which already depends on both @trailroom/catalog and
// @trailroom/db) so the catalogue package stays Firebase-free and the imports stay acyclic.
import sharp from "sharp";
import {
  catalogContentType,
  catalogFileFor,
  catalogFiles,
  isCatalogFile,
  readCatalogAsset,
} from "@trailroom/catalog/server";
import {
  catalogPath,
  getCatalogImage,
  putCatalogImage,
  type StoredObject,
} from "@trailroom/db";

/** The garment object is absent from Storage. Names the exact object path. */
export class CatalogImageMissingError extends Error {
  readonly path: string;
  constructor(path: string) {
    super(
      `garment image missing from Cloud Storage: ${path} (copy the catalogue images to gs://<bucket>/catalog/)`,
    );
    this.name = "CatalogImageMissingError";
    this.path = path;
  }
}

/** Uploads every catalogue image into the (emulator or real) bucket. */
export async function seedCatalogImages(): Promise<string[]> {
  const out: string[] = [];
  for (const file of catalogFiles()) {
    out.push(
      await putCatalogImage(
        file,
        readCatalogAsset(file),
        catalogContentType(file),
      ),
    );
  }
  return out;
}

/**
 * `catalog/<file>` from Storage. A miss is an error in production (no fallback); elsewhere that
 * one object is seeded from the repo assets, so local runs need no manual step.
 * Returns null only for a file name that is not a catalogue image.
 */
export async function loadCatalogFile(
  file: string,
): Promise<StoredObject | null> {
  if (!isCatalogFile(file)) return null;
  const found = await getCatalogImage(file);
  if (found) return found;
  if (process.env.NODE_ENV === "production") {
    throw new CatalogImageMissingError(catalogPath(file));
  }
  let data: Buffer;
  try {
    data = readCatalogAsset(file);
  } catch {
    return null; // a published piece's image that was never uploaded
  }
  const contentType = catalogContentType(file);
  await putCatalogImage(file, data, contentType);
  return { data, contentType };
}

export async function loadItemImage(
  id: string,
): Promise<{ mimeType: string; data: Buffer }> {
  const file = catalogFileFor(id);
  if (!file) throw new Error(`unknown catalogue item ${id}`);
  const obj = await loadCatalogFile(file);
  if (!obj) throw new Error(`unknown catalogue item ${id}`);
  // The model takes JPEG or PNG only: a .webp label photograph is transcoded here.
  if (file.endsWith(".webp")) {
    return {
      mimeType: "image/jpeg",
      data: await sharp(obj.data).jpeg({ quality: 92 }).toBuffer(),
    };
  }
  return { mimeType: catalogContentType(file), data: obj.data };
}
