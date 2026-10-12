import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkImage,
  CHECKS,
  IDENTITY_CHECK,
  IDENTITY_ON_SERVICE_ERROR,
  SKIPPED_CHECKS,
} from "./qa";
import type { FaceMatchFn, FaceMatchResult } from "./face-match";

async function make(
  w: number,
  h: number,
  px: (x: number, y: number) => [number, number, number],
  fmt: "png" | "jpeg" = "png",
): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const o = (y * w + x) * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  const s = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
  return fmt === "png"
    ? s.png().toBuffer()
    : s.jpeg({ quality: 90 }).toBuffer();
}

const textured =
  (seed: number) =>
  (x: number, y: number): [number, number, number] => [
    (x * 255) / 768 + seed,
    (y * 255) / 1024,
    (((x >> 5) ^ (y >> 5)) & 1) * 120,
  ];

let person: Buffer;
let good: Buffer;
beforeAll(async () => {
  person = await make(768, 1024, textured(0), "jpeg");
  // A different picture of the same size: shifted palette plus a block the person lacks.
  good = await make(768, 1024, (x, y) =>
    x > 200 && x < 500 && y > 300 && y < 800
      ? [20, 200, 40]
      : textured(90)(x, y),
  );
});

describe("checkImage", () => {
  it("passes a good image", async () => {
    expect(await checkImage({ image: good, personInput: person })).toEqual({
      verdict: "pass",
      reasons: [],
    });
  });

  it("fails undersized with only too_small", async () => {
    const image = await make(300, 400, textured(90));
    expect(await checkImage({ image, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["too_small"],
    });
  });

  it("fails wrong aspect with only wrong_aspect", async () => {
    const image = await make(1024, 1024, textured(90));
    expect(await checkImage({ image, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["wrong_aspect"],
    });
  });

  it("fails blank with only blank", async () => {
    const image = await make(768, 1024, () => [128, 128, 128]);
    expect(await checkImage({ image, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["blank"],
    });
  });

  it("fails undecodable bytes with only undecodable", async () => {
    const image = Buffer.from("definitely not an image");
    expect(await checkImage({ image, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["undecodable"],
    });
  });

  it("fails a byte-identical copy of the input", async () => {
    expect(await checkImage({ image: person, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["copy_of_input"],
    });
  });

  it("fails a re-encoded copy of the input", async () => {
    const reencoded = await sharp(person).png().toBuffer();
    expect(reencoded.equals(person)).toBe(false);
    expect(await checkImage({ image: reencoded, personInput: person })).toEqual(
      {
        verdict: "fail",
        reasons: ["copy_of_input"],
      },
    );
    const lossy = await sharp(person).jpeg({ quality: 85 }).toBuffer();
    expect(await checkImage({ image: lossy, personInput: person })).toEqual({
      verdict: "fail",
      reasons: ["copy_of_input"],
    });
  });
});

describe("check registry", () => {
  it("registers the four remaining M1 slots as skipped; identity is a real check", async () => {
    expect([...SKIPPED_CHECKS]).toEqual([
      "proportion",
      "garment_fidelity",
      "artifacts",
      "cross_pose_consistency",
    ]);
    for (const id of SKIPPED_CHECKS) {
      const c = CHECKS.find((x) => x.id === id)!;
      const res = await c.run({} as never);
      expect(res).toEqual({ status: "skipped" });
    }
    expect(CHECKS.find((c) => c.id === "cross_pose_consistency")!.level).toBe(
      "set",
    );
    expect(IDENTITY_CHECK).toBe("identity");
    // With no service supplied it is skipped, exactly as before.
    expect(
      await CHECKS.find((c) => c.id === IDENTITY_CHECK)!.run({} as never),
    ).toEqual({
      status: "skipped",
      note: "not_configured",
    });
  });
});

describe("the identity check", () => {
  const face =
    (r: Partial<FaceMatchResult>): FaceMatchFn =>
    async () => ({
      personFace: true,
      renderFace: true,
      distance: 0.6,
      probability: 0.5,
      ...r,
    });
  const run = (faceMatch: FaceMatchFn, min = 0.1, image = good) =>
    checkImage({ image, personInput: person, faceMatch, faceMatchMin: min });

  it("fails a match below the minimum with identity_mismatch", async () => {
    expect(await run(face({ probability: 0.05 }))).toEqual({
      verdict: "fail",
      reasons: ["identity_mismatch"],
      identity: { status: "fail", probability: 0.05 },
    });
  });
  it("passes at or above the minimum", async () => {
    expect((await run(face({ probability: 0.1 }))).identity).toEqual({
      status: "pass",
      probability: 0.1,
    });
    expect((await run(face({ probability: 0.9 }))).verdict).toBe("pass");
  });
  it("uses the minimum it is given", async () => {
    expect((await run(face({ probability: 0.3 }), 0.5)).verdict).toBe("fail");
  });
  it("skips, with a note, when a face is missing on either side", async () => {
    expect(await run(face({ personFace: false, probability: null }))).toEqual({
      verdict: "pass",
      reasons: [],
      identity: { status: "skipped", note: "no_face_in_photo" },
    });
    expect(
      (await run(face({ renderFace: false, probability: null }))).identity,
    ).toEqual({
      status: "skipped",
      note: "no_face_in_render",
    });
  });
  it("skips when the service cannot be reached (the policy constant says skip)", async () => {
    expect(IDENTITY_ON_SERVICE_ERROR).toBe("skip");
    const down: FaceMatchFn = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    expect(await run(down)).toEqual({
      verdict: "pass",
      reasons: [],
      identity: { status: "skipped", note: "service_unavailable" },
    });
  });
  it("does not call the service for an image that already failed", async () => {
    const calls = vi.fn(face({}));
    const image = await make(300, 400, textured(90));
    const r = await run(calls, 0.1, image);
    expect(calls).not.toHaveBeenCalled();
    expect(r.reasons).toEqual(["too_small"]);
  });
  it("leaves identity out of the report when no service is supplied", async () => {
    expect(
      (await checkImage({ image: good, personInput: person })).identity,
    ).toBeUndefined();
  });
});
