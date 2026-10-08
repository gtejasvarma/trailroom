import { serveCatalogFile } from "../../../server/catalog-file";

// Same URLs as before (`/catalog/<file>.jpg`), now read from Cloud Storage. Behind the gate.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  return serveCatalogFile(file);
}
