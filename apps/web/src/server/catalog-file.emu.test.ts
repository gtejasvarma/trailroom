import { beforeEach, describe, expect, it } from "vitest";
import { readCatalogAsset } from "@trailroom/catalog/server";
import { bucket, putCatalogImage, putPhoto } from "@trailroom/db";
import { GET } from "../app/catalog/[file]/route";

const get = (file: string) =>
  GET(new Request(`http://localhost/catalog/${file}`), {
    params: Promise.resolve({ file }),
  });

beforeEach(async () => {
  await bucket().deleteFiles({ prefix: "catalog/", force: true });
});

describe("/catalog/[file]", () => {
  it("serves a catalogue image from Storage with the right headers", async () => {
    const res = await get("commons-parka.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(readCatalogAsset("commons-parka.jpg"))).toBe(true);
  });

  it("404s for unknown names, traversal, encoded slashes and other prefixes", async () => {
    await putCatalogImage("not-a-garment.jpg", Buffer.from("x"));
    await putPhoto("someone", Buffer.from("private"));
    for (const name of [
      "nope.jpg",
      "not-a-garment.jpg",
      "..",
      "../photos/someone/base.jpg",
      "..%2Fphotos%2Fsomeone%2Fbase.jpg",
      "photos%2Fsomeone%2Fbase.jpg",
      "commons-parka.jpg%2F..%2F..",
      "%E0%A4%A",
      "",
    ]) {
      expect((await get(name)).status, name).toBe(404);
    }
  });
});
