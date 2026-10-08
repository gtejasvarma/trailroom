import type { ModelKey } from "./models";
import type { SpendMeta } from "./ledger";

export interface InputImage {
  mimeType: string;
  data: Buffer;
}

export type AspectRatio =
  "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "9:16" | "16:9";

export interface ProviderCall {
  model: ModelKey;
  prompt: string;
  images: InputImage[];
  aspectRatio: AspectRatio;
  meta: SpendMeta;
  client?: GeminiClient;
  /** Aborted when the call times out, so the HTTP request is cancelled too. */
  signal?: AbortSignal;
}

/** image is null when the model answered without one; detail then explains why (for classification). */
export interface ProviderResponse {
  promptTokens: number;
  /** Logged for visibility, never priced: the per-image output price is flat. */
  outputTokens?: number;
  thoughtTokens?: number;
  image: InputImage | null;
  detail: string;
}

export type Provider = (call: ProviderCall) => Promise<ProviderResponse>;

/** The slice of GoogleGenAI we use, so tests can inject a fake and assert the request body. */
export interface InteractionLike {
  status?: string;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
  };
  output_image?: { data?: string; mime_type?: string } | null;
  output_text?: string;
  errors?: { code?: string | number; message?: string }[];
}
export interface GeminiClient {
  interactions: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(params: any, options?: any): Promise<InteractionLike>;
  };
}
