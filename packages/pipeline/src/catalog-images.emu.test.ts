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
  it("seedCatalogImages uploads all five; loadItemImage returns the stored bytes", async () => {
    const paths = await seedCatalogImages();
    expect(paths).toHaveLength(5);
    expect(await listObjects("catalog/")).toEqual(
      catalogFiles()
        .map((f) => `catalog/${f}`)
        .sort(),
    );
    const img = await loadItemImage("g-parka");
    expect(img.mimeType).toBe("image/jpeg");
    expect(img.data.equals(readCatalogAsset("commons-parka.jpg"))).toBe(true);
  });

  it("outside production a missing object is seeded on demand (that one only)", async () => {
    const img = await loadItemImage("g-parka");
    expect(img.data.equals(readCatalogAsset("commons-parka.jpg"))).toBe(true);
    expect(await listObjects("catalog/")).toEqual([
      "catalog/commons-parka.jpg",
    ]);
  });

  it("in production a missing object throws naming the path, with no fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const e = await loadItemImage("g-parka").catch((x) => x);
    expect(e).toBeInstanceOf(CatalogImageMissingError);
    expect(e.message).toContain("catalog/commons-parka.jpg");
    expect(e.path).toBe("catalog/commons-parka.jpg");
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
      "catalog/commons-parka.jpg",
    );
    expect(getFakeCalls()).toHaveLength(0);
    expect((await firestore().collection("spendLog").get()).size).toBe(0);
    expect((await firestore().collection("spend").get()).size).toBe(0);
  });
});
