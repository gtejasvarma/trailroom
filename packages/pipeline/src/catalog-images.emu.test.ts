import sharp from "sharp";
import { getItem } from "@trailroom/catalog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogFiles, readCatalogAsset } from "@trailroom/catalog/server";
import { bucket, getJob, getJobInternal, firestore } from "@trailroom/db";
import { getFakeCalls, setFakeScript } from "@trailroom/render";
import { clearFirestore } from "../../db/src/emu-helpers";
import {
  CatalogImageMissingError,
  loadCatalogFile,
  loadItemImage,
  seedCatalogImages,
} from "./catalog-images";
import { failJob, renderPose } from "./nodes";
import { listObjects, makeJob } from "./testkit";

async function clearCatalog() {
  await bucket().deleteFiles({ prefix: "catalog/", force: true });
}

beforeEach(async () => {
  process.env.RENDER_PROVIDER = "fake";
  setFakeScript(null);
  await clearFirestore();
  await clearCatalog();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("catalogue images in Storage", () => {
  it("seedCatalogImages uploads every file; loadItemImage returns a JPEG for a .webp", async () => {
    const paths = await seedCatalogImages();
    expect(paths).toHaveLength(catalogFiles().length);
    expect(await listObjects("catalog/")).toEqual(
      catalogFiles()
        .map((f) => `catalog/${f}`)
        .sort(),
    );
    const img = await loadItemImage("blouse");
    expect(img.mimeType).toBe("image/jpeg");
    // The stored object is the webp; the model gets a transcoded JPEG, not the webp bytes.
    expect(img.data.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(img.data.equals(readCatalogAsset("wrap-top-front.webp"))).toBe(
      false,
    );
    expect((await sharp(img.data).metadata()).format).toBe("jpeg");
  });

  it("a .jpg render image is passed through untouched", async () => {
    const img = await loadItemImage("coat");
    expect(img.mimeType).toBe("image/jpeg");
    expect(img.data.equals(readCatalogAsset("p19299199.jpg"))).toBe(true);
  });

  it("stores each file with its own content type", async () => {
    await seedCatalogImages();
    const [webp] = await bucket()
      .file("catalog/wrap-top-front.webp")
      .getMetadata();
    const [jpg] = await bucket().file("catalog/p19299199.jpg").getMetadata();
    expect(webp.contentType).toBe("image/webp");
    expect(jpg.contentType).toBe("image/jpeg");
  });

  it("the provider is handed a JPEG or PNG for a .webp render image", async () => {
    const j = await makeJob("u-webp", "blouse", ["front"]);
    expect(getItem("blouse")!.renderImage.endsWith(".webp")).toBe(true);
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    const [call] = getFakeCalls();
    expect(call!.inputMimeTypes).toHaveLength(2);
    for (const m of call!.inputMimeTypes)
      expect(["image/jpeg", "image/png"]).toContain(m);
  });

  it("outside production a missing object is seeded on demand (that one only)", async () => {
    const img = await loadItemImage("blouse");
    expect(img.mimeType).toBe("image/jpeg");
    expect(await listObjects("catalog/")).toEqual([
      "catalog/wrap-top-front.webp",
    ]);
  });

  it("in production a missing object throws naming the path, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const e = await loadItemImage("blouse").catch((x) => x);
    expect(e).toBeInstanceOf(CatalogImageMissingError);
    expect(e.message).toContain("catalog/wrap-top-front.webp");
    expect(e.path).toBe("catalog/wrap-top-front.webp");
    expect(await listObjects("catalog/")).toEqual([]);
  });

  it("names that are not catalogue images are never loaded", async () => {
    expect(await loadCatalogFile("../photos/x.jpg")).toBeNull();
    expect(await loadCatalogFile("nope.jpg")).toBeNull();
  });

  it("a job whose garment image is missing in production ends failed/internal with no model call and no spend", async () => {
    const j = await makeJob("u-nogarment");
    vi.stubEnv("NODE_ENV", "production");
    const err = await renderPose({
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    }).catch((x) => x);
    expect(err).toBeInstanceOf(CatalogImageMissingError);
    // The error path every driver takes: fail-job internal with the specific detail.
    const out = await failJob({
      jobId: j.jobId,
      code: "internal",
      detail: err.message,
    });
    expect(out.status).toBe("failed");
    vi.unstubAllEnvs();
    const job = (await getJob(j.jobId))!;
    expect(job.status).toBe("failed");
    expect(job.failure?.code).toBe("internal");
    expect(job.failure).toEqual({ code: "internal" });
    expect((await getJobInternal(j.jobId))?.failureDetail).toContain(
      "catalog/wrap-top-front.webp",
    );
    expect(getFakeCalls()).toHaveLength(0);
    expect((await firestore().collection("spendLog").get()).size).toBe(0);
    expect((await firestore().collection("spend").get()).size).toBe(0);
  });
});
