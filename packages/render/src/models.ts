// Prices checked 2026-10-06 against https://ai.google.dev/gemini-api/docs/pricing (paid tier,
// standard) and https://ai.google.dev/gemini-api/docs/image-generation. Output is a flat
// per-image price at 1K; input is per million tokens. Nano Banana 2 (gemini-3.1-flash-image) is
// now "previous generation" but kept so earlier eval runs stay reproducible.
export const MODELS = {
  "nano-banana-2.1": {
    id: "gemini-nano-banana-2.1",
    outputUsdPerImage: 0.0336,
    inputUsdPerMTok: 1.5,
  },
  "nano-banana-2-lite": {
    id: "gemini-3.1-flash-lite-image",
    outputUsdPerImage: 0.0336,
    inputUsdPerMTok: 0.25,
  },
  "nano-banana-2": {
    id: "gemini-3.1-flash-image",
    outputUsdPerImage: 0.067,
    inputUsdPerMTok: 0.5,
  },
  "nano-banana-pro": {
    id: "gemini-3-pro-image",
    outputUsdPerImage: 0.134,
    inputUsdPerMTok: 2.0,
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export function isModelKey(s: string): s is ModelKey {
  return Object.prototype.hasOwnProperty.call(MODELS, s);
}

// Upper bound used to reserve budget before a call; settled to the real token count after.
const EST_TOKENS_PER_INPUT_IMAGE = 2000;
const EST_TOKENS_PER_PROMPT = 500;

export function estimateCostUsd(model: ModelKey, inputImages: number): number {
  const m = MODELS[model];
  const tokens =
    inputImages * EST_TOKENS_PER_INPUT_IMAGE + EST_TOKENS_PER_PROMPT;
  return m.outputUsdPerImage + (tokens / 1e6) * m.inputUsdPerMTok;
}
