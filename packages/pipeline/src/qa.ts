// The QA gate. This build's gate is STRUCTURAL, not perceptual: it can tell that an image is a
// usable, non-degenerate, new picture, but not that it is the same person, wearing the right
// garment, with unaltered proportions. Those are M1's scorers (PRD §10.3); they have slots below,
// registered as `skipped` so the job doc and status line never pass this gate off as the real one.
import sharp from "sharp";
import type { ReasonCode, Verdict } from "./types";

export type CheckLevel = "image" | "set";
export type CheckResult =
  | { status: "pass" }
  | { status: "fail"; reason: ReasonCode }
  | { status: "skipped" };

export interface Decoded {
  width: number;
  height: number;
  /** Interleaved 8-bit RGB. */
  rgb: Buffer;
}

export interface CheckContext {
  image: Buffer;
  personInput: Buffer;
  /** Memoised decodes; null when the bytes are not an image. */
  decodeImage(): Promise<Decoded | null>;
  decodeInput(): Promise<Decoded | null>;
}

export interface QaCheck {
  id: string;
  level: CheckLevel;
  run(ctx: CheckContext): Promise<CheckResult>;
}

export const MIN_SHORT_SIDE = 768;
/** Aspect (width / height) must be within 2% of 3:4. */
export const ASPECT = 3 / 4;
export const ASPECT_TOLERANCE = 0.02;
/**
 * Luminance standard deviation (0-255 scale) below which an image counts as blank. A flat field
 * re-encoded by JPEG/PNG sits under 2; any photo of a person, even on a seamless white backdrop,
 * is far above 20 (the person alone contributes). 8 leaves wide margin on both sides.
 */
export const BLANK_LUMA_STDDEV_FLOOR = 8;
/**
 * Mean absolute per-channel difference (0-255) under which a same-sized image is treated as a
 * copy of the input. A lossy re-encode of the same pixels differs by roughly 1-3 at normal
 * quality; a real edit changes the garment region by tens of levels, so it averages well above 4
 * across the whole frame only when the edit is large. 2 keeps a genuine small edit from being
 * flagged while still catching re-encodes (JPEG q>=80).
 */
export const COPY_MEAN_ABS_DIFF = 2;

async function decode(buf: Buffer): Promise<Decoded | null> {
  try {
    const { data, info } = await sharp(buf)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) return null;
    return { width: info.width, height: info.height, rgb: data };
  } catch {
    return null;
  }
}

export function lumaStdDev(d: Decoded): number {
  const n = d.width * d.height;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const y =
      0.299 * d.rgb[i * 3]! +
      0.587 * d.rgb[i * 3 + 1]! +
      0.114 * d.rgb[i * 3 + 2]!;
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

export function meanAbsDiff(a: Decoded, b: Decoded): number {
  let total = 0;
  for (let i = 0; i < a.rgb.length; i++)
    total += Math.abs(a.rgb[i]! - b.rgb[i]!);
  return total / a.rgb.length;
}

const fail = (reason: ReasonCode): CheckResult => ({ status: "fail", reason });
const pass: CheckResult = { status: "pass" };

const skipped = (id: string): QaCheck => ({
  id,
  level: id === "cross_pose_consistency" ? "set" : "image",
  run: async () => ({ status: "skipped" }),
});

/** The perceptual checks this gate does not run yet. M1's scorers replace these entries. */
export const SKIPPED_CHECKS = [
  "identity",
  "proportion",
  "garment_fidelity",
  "artifacts",
  "cross_pose_consistency",
] as const;

export const CHECKS: QaCheck[] = [
  {
    id: "decodes",
    level: "image",
    run: async (c) => ((await c.decodeImage()) ? pass : fail("undecodable")),
  },
  {
    id: "min_size",
    level: "image",
    run: async (c) => {
      const d = await c.decodeImage();
      if (!d) return pass; // already reported by "decodes"
      return Math.min(d.width, d.height) >= MIN_SHORT_SIDE
        ? pass
        : fail("too_small");
    },
  },
  {
    id: "aspect",
    level: "image",
    run: async (c) => {
      const d = await c.decodeImage();
      if (!d) return pass;
      const ratio = d.width / d.height;
      return Math.abs(ratio - ASPECT) / ASPECT <= ASPECT_TOLERANCE
        ? pass
        : fail("wrong_aspect");
    },
  },
  {
    id: "not_blank",
    level: "image",
    run: async (c) => {
      const d = await c.decodeImage();
      if (!d) return pass;
      return lumaStdDev(d) >= BLANK_LUMA_STDDEV_FLOOR ? pass : fail("blank");
    },
  },
  {
    id: "not_copy_of_input",
    level: "image",
    run: async (c) => {
      if (c.image.equals(c.personInput)) return fail("copy_of_input");
      const [d, inp] = await Promise.all([c.decodeImage(), c.decodeInput()]);
      if (!d || !inp) return pass;
      if (d.width !== inp.width || d.height !== inp.height) return pass;
      return meanAbsDiff(d, inp) < COPY_MEAN_ABS_DIFF
        ? fail("copy_of_input")
        : pass;
    },
  },
  ...SKIPPED_CHECKS.map(skipped),
];

export interface QaReport {
  verdict: Verdict;
  reasons: ReasonCode[];
}

/** Runs every image-level check; set-level checks are run by whoever holds the whole set. */
export async function checkImage(input: {
  image: Buffer;
  personInput: Buffer;
}): Promise<QaReport> {
  let img: Promise<Decoded | null> | undefined;
  let inp: Promise<Decoded | null> | undefined;
  const ctx: CheckContext = {
    image: input.image,
    personInput: input.personInput,
    decodeImage: () => (img ??= decode(input.image)),
    decodeInput: () => (inp ??= decode(input.personInput)),
  };
  const reasons: ReasonCode[] = [];
  for (const check of CHECKS) {
    if (check.level !== "image") continue;
    const res = await check.run(ctx);
    if (res.status === "fail" && !reasons.includes(res.reason)) {
      reasons.push(res.reason);
    }
  }
  return { verdict: reasons.length === 0 ? "pass" : "fail", reasons };
}
