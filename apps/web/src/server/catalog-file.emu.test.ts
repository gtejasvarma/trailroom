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
    const res = await get("p19299199.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(readCatalogAsset("p19299199.jpg"))).toBe(true);
  });

  it("serves a .webp with the image/webp content type", async () => {
    const res = await get("dress-2-front.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(readCatalogAsset("dress-2-front.webp"))).toBe(true);
  });

  it("serves the Discover proof photograph", async () => {
    const res = await get("p6218357.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
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
      "p19299199.jpg%2F..%2F..",
      "commons-parka.jpg",
      "p12144990.jpg",
      "%E0%A4%A",
      "",
    ]) {
      expect((await get(name)).status, name).toBe(404);
    }
  });
});
