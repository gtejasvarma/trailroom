import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { E2E_TMP, FAKE_SCRIPT_FILE } from "../playwright.config";

/** A non-uniform synthetic image: stripes and blocks, no person. */
async function synthetic(w: number, h: number, format: "jpeg" | "png") {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const block = x > w * 0.3 && x < w * 0.6 && y > h * 0.2 && y < h * 0.8;
      raw[o] = block ? 200 : (x * 255) / w;
      raw[o + 1] = (y * 255) / h;
      raw[o + 2] = block ? 60 : (x + y) % 256;
    }
  }
  const img = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
  return format === "jpeg" ? img.jpeg().toBuffer() : img.png().toBuffer();
}

export default async function globalSetup() {
  mkdirSync(E2E_TMP, { recursive: true });
  writeFileSync(join(E2E_TMP, "photo.jpg"), await synthetic(900, 1200, "jpeg"));
  writeFileSync(join(E2E_TMP, "tiny.png"), await synthetic(100, 130, "png"));
  writeFileSync(FAKE_SCRIPT_FILE, "[]");
}
