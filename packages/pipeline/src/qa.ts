// The QA gate. This build's gate is mostly STRUCTURAL: it can tell that an image is a usable,
// non-degenerate, new picture. The one perceptual check it has is IDENTITY: a face-match service
// says whether the face in the render is the face in the person's photo, and a probability below
// the owner's minimum fails the pose. When that service is not configured, or cannot judge, the
// check is `skipped` and the job doc says so. The rest (proportion, garment, artifacts, cross-pose)
// are M1's scorers (PRD §10.3); they have slots below, registered as `skipped` so the job doc and
// status line never pass this gate off as the real one.
import sharp from "sharp";
import { logError } from "@trailroom/render";
import type { FaceMatchFn } from "./face-match";
import { DEFAULT_FACE_MATCH_MIN } from "./face-match";
import type { ReasonCode, Verdict } from "./types";

export type CheckLevel = "image" | "set";
export type CheckResult =
  | { status: "pass"; probability?: number }
  | { status: "fail"; reason: ReasonCode; probability?: number }
  /** `note` says why the check could not judge. */
  | { status: "skipped"; note?: string };

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
  /** The face-match call; absent when the identity check is not configured. */
  faceMatch?: FaceMatchFn;
  /** Matches below this probability fail the identity check. */
  faceMatchMin?: number;
  /** True once an earlier check in this run has already failed the image. */
  alreadyFailed?: () => boolean;
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

/**
 * What the identity check does when the face-match service is configured but cannot answer
 * (unreachable, a timeout, an error after the retry). "skip" keeps the product working while a
 * helper service is cold or down: the pose is judged by the other checks and the job records that
 * identity did not run. Flip to "fail" to refuse every render whenever the check cannot run.
 */
export const IDENTITY_ON_SERVICE_ERROR = "skip" as "skip" | "fail";

export const IDENTITY_CHECK = "identity";

const fail = (reason: ReasonCode): CheckResult => ({ status: "fail", reason });
const pass: CheckResult = { status: "pass" };

const identityCheck: QaCheck = {
  id: IDENTITY_CHECK,
  level: "image",
  run: async (c) => {
    if (!c.faceMatch) return { status: "skipped", note: "not_configured" };
    // Nothing to learn from a face check on an image that already failed.
    if (c.alreadyFailed?.()) return { status: "skipped", note: "not_run" };
    let r;
    try {
      r = await c.faceMatch(c.personInput, c.image);
    } catch (e) {
      logError("face-match unavailable", e);
      return IDENTITY_ON_SERVICE_ERROR === "fail"
        ? fail("identity_mismatch")
        : { status: "skipped", note: "service_unavailable" };
    }
    if (!r.personFace) return { status: "skipped", note: "no_face_in_photo" };
    if (!r.renderFace) return { status: "skipped", note: "no_face_in_render" };
    const probability = r.probability ?? 0;
    const min = c.faceMatchMin ?? DEFAULT_FACE_MATCH_MIN;
    return probability < min
      ? { status: "fail", reason: "identity_mismatch", probability }
      : { status: "pass", probability };
  },
};

const skipped = (id: string): QaCheck => ({
  id,
  level: id === "cross_pose_consistency" ? "set" : "image",
  run: async () => ({ status: "skipped" }),
});

/** The perceptual checks this gate does not run yet. M1's scorers replace these entries. */
export const SKIPPED_CHECKS = [
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
  identityCheck,
  ...SKIPPED_CHECKS.map(skipped),
];

/** What the identity check did, as recorded on the attempt. */
export interface IdentityOutcome {
  status: "pass" | "fail" | "skipped";
  probability?: number;
  note?: string;
}

export interface QaReport {
  verdict: Verdict;
  reasons: ReasonCode[];
  /** Present only when a face-match service was supplied; absent means the check was off. */
  identity?: IdentityOutcome;
}

/** Runs every image-level check; set-level checks are run by whoever holds the whole set. */
export async function checkImage(input: {
  image: Buffer;
  personInput: Buffer;
  faceMatch?: FaceMatchFn;
  faceMatchMin?: number;
}): Promise<QaReport> {
  let img: Promise<Decoded | null> | undefined;
  let inp: Promise<Decoded | null> | undefined;
  const reasons: ReasonCode[] = [];
  const ctx: CheckContext = {
    image: input.image,
    personInput: input.personInput,
    decodeImage: () => (img ??= decode(input.image)),
    decodeInput: () => (inp ??= decode(input.personInput)),
    faceMatch: input.faceMatch,
    faceMatchMin: input.faceMatchMin,
    alreadyFailed: () => reasons.length > 0,
  };
  let identity: IdentityOutcome | undefined;
  for (const check of CHECKS) {
    if (check.level !== "image") continue;
    const res = await check.run(ctx);
    if (check.id === IDENTITY_CHECK && input.faceMatch) {
      identity = { status: res.status };
      if ("probability" in res && res.probability !== undefined) {
        identity.probability = Math.round(res.probability * 1000) / 1000;
      }
      if ("note" in res && res.note) identity.note = res.note;
    }
    if (res.status === "fail" && !reasons.includes(res.reason)) {
      reasons.push(res.reason);
    }
  }
  return { verdict: reasons.length === 0 ? "pass" : "fail", reasons, identity };
}
