// Serves garment images from Cloud Storage `catalog/<file>`. Only file names that belong to a
// catalogue item are served; everything else (traversal, other prefixes, unknown names) is a 404.
import { logError } from "@trailroom/render";
import { catalogContentType, isCatalogFile } from "@trailroom/catalog/server";
import { CatalogImageMissingError, loadCatalogFile } from "@trailroom/pipeline";

const notFound = () => new Response("Not found", { status: 404 });

export async function serveCatalogFile(rawName: string): Promise<Response> {
  let file: string;
  try {
    file = decodeURIComponent(rawName);
  } catch {
    return notFound();
  }
  if (!isCatalogFile(file)) return notFound();
  try {
    const obj = await loadCatalogFile(file);
    if (!obj) return notFound();
    return new Response(new Uint8Array(obj.data), {
      status: 200,
      headers: {
        "Content-Type": catalogContentType(file),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof CatalogImageMissingError) {
      logError("catalog image missing", e);
      return notFound();
    }
    logError("catalog image read failed", e);
    return new Response("Something went wrong", { status: 500 });
  }
}
