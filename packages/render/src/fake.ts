// Fake provider for tests and Playwright e2e. It goes through the same reserve/settle and price
// table as the real one. It must never run in production: a synthetic image reaching a deployed
// user would be a worse failure than a failed render.
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { POSES } from "./prompt";
import type { Provider, ProviderCall, ProviderResponse } from "./provider";

export function assertFakeAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("the fake render provider cannot be used in production");
  }
}

export type FakeOutcome =
  | "ok"
  | "blocked"
  | "no_image"
  | "error"
  | "undersized"
  | "blank"
  | "copy_input";

/**
 * One rule per entry. A call consumes the first entry whose `pose` (if given) matches and which
 * has `times` left (unlimited when omitted). No matching entry means "ok".
 * Set in-process with setFakeScript(), or across a process boundary (e.g. a Next dev server
 * under Playwright) with RENDER_FAKE_SCRIPT='[{"pose":"walking","outcome":"blocked","times":1}]'.
 * Counters are per process and reset whenever the script changes.
 * copy_input returns the LAST input image (callers pass garment first, person last).
 */
export interface FakeRule {
  pose?: string;
  outcome: FakeOutcome;
  times?: number;
  /** Wait this long before answering, so an e2e test can watch a job while it renders. */
  delayMs?: number;
}

let override: FakeRule[] | null | undefined;
let used: number[] = [];
let usedFor: string | undefined;

const calls: {
  pose: string | undefined;
  outcome: FakeOutcome;
  /** The mime type of each input image the provider was handed, in order. */
  inputMimeTypes: string[];
  /** The byte length of each input image, in order, so a test can tell which image went where. */
  inputBytes: number[];
  /** The prompt the provider was handed. */
  prompt: string;
}[] = [];

/** Every provider call since the last setFakeScript()/resetFakeCalls(), for tests. */
export function getFakeCalls(): readonly {
  pose: string | undefined;
  outcome: FakeOutcome;
  inputMimeTypes: string[];
  inputBytes: number[];
  prompt: string;
}[] {
  return calls;
}
export function resetFakeCalls(): void {
  calls.length = 0;
}

export function setFakeScript(rules: FakeRule[] | null | undefined): void {
  override = rules;
  calls.length = 0;
  used = [];
  usedFor = undefined;
}

function activeScript(): FakeRule[] {
  if (override) return override;
  // RENDER_FAKE_SCRIPT_FILE is re-read on every call, so a Playwright test can rewrite the file
  // between scenarios without restarting the server it is driving. It wins over the inline var.
  const file = process.env.RENDER_FAKE_SCRIPT_FILE;
  const raw =
    file && existsSync(file)
      ? readFileSync(file, "utf8").trim()
      : process.env.RENDER_FAKE_SCRIPT;
  if (!raw) return [];
  if (usedFor !== raw) {
    used = [];
    usedFor = raw;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed))
    throw new Error("RENDER_FAKE_SCRIPT must be a JSON array");
  return parsed as FakeRule[];
}

function nextRule(pose: string | undefined): FakeRule {
  const script = activeScript();
  for (let i = 0; i < script.length; i++) {
    const r = script[i]!;
    if (r.pose !== undefined && r.pose !== pose) continue;
    if (r.times !== undefined && (used[i] ?? 0) >= r.times) continue;
    used[i] = (used[i] ?? 0) + 1;
    return r;
  }
  return { outcome: "ok" };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

async function png(
  w: number,
  h: number,
  px: (x: number, y: number) => [number, number, number],
): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const o = (y * w + x) * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

/** Deterministic 768x1024 image: a hue from prompt+pose, a vertical gradient, and a pose-placed block. */
function synthetic(prompt: string, pose: string): Promise<Buffer> {
  const hue = hash(prompt + "|" + pose) % 256;
  const poseIdx = Math.max(0, Object.keys(POSES).indexOf(pose));
  const bx = 120 + poseIdx * 90;
  return png(768, 1024, (x, y) => {
    const inBlock = x >= bx && x < bx + 220 && y >= 200 && y < 900;
    if (inBlock)
      return [(hue + 128) % 256, 60 + poseIdx * 40, 200 - poseIdx * 30];
    return [hue, Math.floor((y / 1024) * 255), Math.floor((x / 768) * 255)];
  });
}

export const fakeProvider: Provider = async (
  call: ProviderCall,
): Promise<ProviderResponse> => {
  assertFakeAllowed();
  const pose = call.meta.pose ?? "front";
  const promptTokens =
    call.images.length * 1290 + Math.ceil(call.prompt.length / 4);
  const rule = nextRule(call.meta.pose);
  const outcome = rule.outcome;
  if (rule.delayMs) await new Promise((r) => setTimeout(r, rule.delayMs));
  calls.push({
    pose: call.meta.pose,
    outcome,
    inputMimeTypes: call.images.map((i) => i.mimeType),
    inputBytes: call.images.map((i) => i.data.length),
    prompt: call.prompt,
  });
  const img = (data: Buffer) => ({ mimeType: "image/png", data });

  switch (outcome) {
    case "error":
      throw new Error("fake: scripted error");
    case "blocked":
      return {
        promptTokens,
        image: null,
        detail: 'status=failed errors="SAFETY blocked by policy (fake)"',
      };
    case "no_image":
      return {
        promptTokens,
        image: null,
        detail: 'status=completed text="no image (fake)"',
      };
    case "undersized":
      return {
        promptTokens,
        detail: "",
        image: img(await png(300, 400, (x, y) => [x % 256, y % 256, 90])),
      };
    case "blank":
      return {
        promptTokens,
        detail: "",
        image: img(await png(768, 1024, () => [128, 128, 128])),
      };
    case "copy_input": {
      const last = call.images[call.images.length - 1];
      if (!last) throw new Error("fake: copy_input needs an input image");
      return { promptTokens, detail: "", image: { ...last } };
    }
    case "ok":
      return {
        promptTokens,
        detail: "",
        image: img(await synthetic(call.prompt, pose)),
      };
  }
};
