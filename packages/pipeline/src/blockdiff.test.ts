import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { maxBlockMeanDiff } from "./blockdiff";

const W = 768;
const H = 1024;
const BOUND = 12; // JPEG transcode at q92 4:4:4 stays well under this per block

async function base() {
  const raw = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      raw[o] = (x * 255) / W;
      raw[o + 1] = (y * 255) / H;
      raw[o + 2] = 120;
    }
  return raw;
}
const toRaw = (buf: Buffer) =>
  sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });

describe("maxBlockMeanDiff", () => {
  it("passes a plain JPEG transcode", async () => {
    const raw = await base();
    const png = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();
    const jpg = await sharp(png)
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const a = await toRaw(png);
    const b = await toRaw(jpg);
    expect(maxBlockMeanDiff(a.data, b.data, W, H, 3)).toBeLessThan(BOUND);
  });

  it("fails a small composited strip that barely moves the global mean", async () => {
    const raw = await base();
    const png = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer();
    const strip = await sharp({
      create: {
        width: 200,
        height: 24,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    const marked = await sharp(png)
      .composite([{ input: strip, left: 20, top: H - 60 }])
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const a = await toRaw(png);
    const b = await toRaw(marked);
    let total = 0;
    for (let i = 0; i < a.data.length; i++)
      total += Math.abs(a.data[i]! - b.data[i]!);
    const globalMean = total / a.data.length;
    expect(globalMean).toBeLessThan(3); // the old check would have passed this
    expect(maxBlockMeanDiff(a.data, b.data, W, H, 3)).toBeGreaterThan(BOUND);
  });
});
