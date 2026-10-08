// The one chokepoint for image-model calls (CLAUDE.md hard rule). Anything that generates an
// image goes through renderImage(), so the spend ceiling cannot be bypassed.
import { GoogleGenAI } from "@google/genai";
import { assertFakeAllowed, fakeProvider } from "./fake";
import {
  ReservationExistsError,
  SpendCeilingError,
  type SpendLedger,
  type SpendMeta,
} from "./ledger";
import { logError } from "./log";
import {
  microsToUsd,
  usdToMicros,
  usdToMicrosCeil,
  type Micros,
} from "./money";
import { estimateCostUsd, MODELS, type ModelKey } from "./models";
import type {
  AspectRatio,
  GeminiClient,
  InputImage,
  Provider,
  ProviderCall,
  ProviderResponse,
} from "./provider";

export * from "./models";
export * from "./money";
export * from "./ledger";
export * from "./config";
export * from "./log";
export * from "./prompt";
export * from "./provider";
export {
  setFakeScript,
  getFakeCalls,
  resetFakeCalls,
  assertFakeAllowed,
  fakeProvider,
  type FakeOutcome,
  type FakeRule,
} from "./fake";
export { SpendCeilingError, ReservationExistsError };

export interface RenderRequest {
  model: ModelKey;
  prompt: string;
  /** Callers pass the garment first, then the person: the prompt says "Image 1" / "Image 2". */
  images: InputImage[];
  aspectRatio: AspectRatio;
  /** Any ledger: the in-memory SpendMeter (eval) or a durable one. */
  meter: SpendLedger;
  meta?: SpendMeta;
  /** Test seam: replaces the real Gemini client. */
  client?: GeminiClient;
  /** Give up on the model call after this long. Default 240 s: under the endpoint's 300 s. */
  timeoutMs?: number;
}

export const DEFAULT_MODEL_TIMEOUT_MS = 240_000;

export type RenderResult =
  | {
      ok: true;
      image: InputImage;
      costUsd: number;
      promptTokens: number;
      outputTokens?: number;
      thoughtTokens?: number;
    }
  | {
      ok: false;
      // "blocked": safety/policy refusal. "no_image": the model answered without an image.
      // Both are outcomes worth counting, not just errors to retry.
      reason: "blocked" | "no_image" | "error";
      detail: string;
      costUsd: number;
      promptTokens: number;
      outputTokens?: number;
      thoughtTokens?: number;
    };

let sharedClient: GoogleGenAI | undefined;
function getClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (put it in .env)");
  sharedClient ??= new GoogleGenAI({ apiKey });
  return sharedClient as unknown as GeminiClient;
}

export function estimateCostMicros(
  model: ModelKey,
  inputImages: number,
): Micros {
  return usdToMicrosCeil(estimateCostUsd(model, inputImages));
}

export function costMicros(
  model: ModelKey,
  promptTokens: number,
  producedImage: boolean,
): Micros {
  const m = MODELS[model];
  // tokens x ($ per 1M tokens) is micro-USD already.
  return (
    Math.round(promptTokens * m.inputUsdPerMTok) +
    (producedImage ? usdToMicros(m.outputUsdPerImage) : 0)
  );
}

const realProvider: Provider = async (
  call: ProviderCall,
): Promise<ProviderResponse> => {
  // Interactions API, per google-gemini/gemini-skills (gemini-api-dev) and
  // https://ai.google.dev/gemini-api/docs/image-generation. store: false so Google doesn't
  // retain user photos (interactions are stored for 55 days by default on the paid tier).
  const interaction = await (call.client ?? getClient()).interactions.create(
    {
      model: MODELS[call.model].id,
      input: [
        { type: "text", text: call.prompt },
        ...call.images.map((img) => ({
          type: "image" as const,
          mime_type: img.mimeType,
          data: img.data.toString("base64"),
        })),
      ],
      response_format: {
        type: "image",
        aspect_ratio: call.aspectRatio,
        image_size: "1K",
      },
      store: false,
    },
    { signal: call.signal },
  );

  const promptTokens = interaction.usage?.total_input_tokens ?? 0;
  const outputTokens = interaction.usage?.total_output_tokens;
  const thoughtTokens = interaction.usage?.total_thought_tokens;
  const image = interaction.output_image;
  if (image?.data) {
    return {
      promptTokens,
      outputTokens,
      thoughtTokens,
      detail: "",
      image: {
        mimeType: image.mime_type ?? "image/png",
        data: Buffer.from(image.data, "base64"),
      },
    };
  }
  // How refusals surface in the Interactions API isn't documented for image output yet, so
  // classify by status/errors/text and keep all three in `detail` to learn from the first run.
  const errors = (interaction.errors ?? [])
    .map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim())
    .join("; ");
  const text = interaction.output_text?.trim() ?? "";
  return {
    promptTokens,
    outputTokens,
    thoughtTokens,
    image: null,
    detail:
      `status=${interaction.status}` +
      (errors ? ` errors="${errors.slice(0, 300)}"` : "") +
      (text ? ` text="${text.slice(0, 300)}"` : ""),
  };
};

/** Throws (never returns an error result) when the fake is selected in production. */
function selectProvider(): Provider {
  const which = process.env.RENDER_PROVIDER;
  if (which === "fake") {
    assertFakeAllowed();
    return fakeProvider;
  }
  if (which !== undefined && which !== "" && which !== "gemini") {
    throw new Error(`RENDER_PROVIDER "${which}" must be "gemini" or "fake"`);
  }
  return realProvider;
}

/**
 * Generates one 1K image. Only 1K is supported: the pricing table is 1K-only.
 *
 * Spend is never under-recorded: a thrown provider error may still have been billed, so it
 * settles at the estimate; a response with no usage settles at the estimate too. Output text and
 * thought token counts are recorded for visibility only. The per-image price is flat, so other
 * output tokens are logged, not priced.
 */
export async function renderImage(req: RenderRequest): Promise<RenderResult> {
  const provider = selectProvider();
  const estimate = estimateCostMicros(req.model, req.images.length);
  // Rejects with SpendCeilingError / ReservationExistsError before anything is held.
  const settle = await req.meter.reserve(estimate, {
    ...req.meta,
    model: req.model,
  });
  // Until the provider answers cleanly, assume the call was billed at the estimate.
  let spent: Micros = estimate;
  let promptTokens = 0;
  let outputTokens: number | undefined;
  let thoughtTokens: number | undefined;
  const costUsd = () => microsToUsd(spent);
  try {
    const ctrl = new AbortController();
    const timeoutMs = req.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Error(`model call timed out after ${timeoutMs} ms`));
      }, timeoutMs);
    });
    let res;
    try {
      // The abort signal cancels the HTTP request; the race covers a provider that ignores it.
      res = await Promise.race([
        provider({
          model: req.model,
          prompt: req.prompt,
          images: req.images,
          aspectRatio: req.aspectRatio,
          meta: { ...req.meta, model: req.model },
          client: req.client,
          signal: ctrl.signal,
        }),
        timedOut,
      ]);
    } finally {
      clearTimeout(timer);
    }
    promptTokens = res.promptTokens;
    outputTokens = res.outputTokens;
    thoughtTokens = res.thoughtTokens;
    const extra = {
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(thoughtTokens !== undefined ? { thoughtTokens } : {}),
    };
    // No usage reported: do not trust a zero; hold the estimate.
    const reported = promptTokens > 0;
    spent = reported ? costMicros(req.model, promptTokens, false) : estimate;

    if (!res.image) {
      return {
        ok: false,
        reason: /safety|block|prohibit|policy|refus/i.test(res.detail)
          ? "blocked"
          : "no_image",
        detail: res.detail,
        costUsd: costUsd(),
        promptTokens,
        ...extra,
      };
    }
    spent = reported ? costMicros(req.model, promptTokens, true) : estimate;
    return {
      ok: true,
      image: res.image,
      costUsd: costUsd(),
      promptTokens,
      ...extra,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      detail: err instanceof Error ? err.message : String(err),
      costUsd: costUsd(),
      promptTokens,
    };
  } finally {
    try {
      await settle(spent, {
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(thoughtTokens !== undefined ? { thoughtTokens } : {}),
      });
    } catch (e) {
      // The paid image must still be returned; the stale reservation is reaped later.
      logError("renderImage: settle failed", e);
    }
  }
}
