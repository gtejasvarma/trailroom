import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  costMicros,
  estimateCostMicros,
  fakeProvider,
  ReservationExistsError,
  renderImage,
  setFakeScript,
  SpendCeilingError,
  SpendMeter,
  type GeminiClient,
  type InputImage,
  type InteractionLike,
  type RenderRequest,
  type SpendLedger,
} from "./index";

const garment: InputImage = {
  mimeType: "image/jpeg",
  data: Buffer.from("garment-bytes"),
};
const person: InputImage = {
  mimeType: "image/png",
  data: Buffer.from("person-bytes"),
};

function clientReturning(response: InteractionLike | Error) {
  const create = vi.fn(async (_params: unknown) => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { client: { interactions: { create } } as GeminiClient, create };
}

function request(over: Partial<RenderRequest> = {}): RenderRequest {
  return {
    model: "nano-banana-2.1",
    prompt: "a prompt",
    images: [garment, person],
    aspectRatio: "3:4",
    meter: new SpendMeter(1),
    meta: { pose: "walking", jobId: "j1", attempt: 1 },
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  setFakeScript(null);
});

describe("renderImage against the Gemini request shape", () => {
  it("sends store:false, 1K, the aspect ratio, the table's model id, and images in order", async () => {
    const { client, create } = clientReturning({
      usage: { total_input_tokens: 3000 },
      output_image: { data: Buffer.from("png").toString("base64") },
    });
    await renderImage(request({ client }));

    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0]![0] as {
      model: string;
      store: boolean;
      response_format: Record<string, string>;
      input: { type: string; text?: string; data?: string }[];
    };
    expect(body.model).toBe("gemini-nano-banana-2.1");
    expect(body.store).toBe(false);
    expect(body.response_format).toEqual({
      type: "image",
      aspect_ratio: "3:4",
      image_size: "1K",
    });
    expect(body.input.map((p) => p.type)).toEqual(["text", "image", "image"]);
    expect(body.input[1]!.data).toBe(garment.data.toString("base64"));
    expect(body.input[2]!.data).toBe(person.data.toString("base64"));
  });

  it("settles input tokens plus the image price on success", async () => {
    const meter = new SpendMeter(1);
    const { client } = clientReturning({
      usage: { total_input_tokens: 3000 },
      output_image: { data: Buffer.from("png").toString("base64") },
    });
    const res = await renderImage(request({ client, meter }));
    expect(res.ok).toBe(true);
    expect(meter.spentMicros).toBe(costMicros("nano-banana-2.1", 3000, true));
    expect(res.costUsd).toBeCloseTo(0.0381, 9);
    expect(meter.pendingMicros).toBe(0);
  });

  it("settles only the input-token cost when no image comes back", async () => {
    const meter = new SpendMeter(1);
    const { client } = clientReturning({
      status: "completed",
      usage: { total_input_tokens: 3000 },
      output_text: "I can describe it instead.",
    });
    const res = await renderImage(request({ client, meter }));
    expect(res).toMatchObject({ ok: false, reason: "no_image" });
    expect(meter.spentMicros).toBe(4_500);
  });

  it("classifies a policy refusal as blocked", async () => {
    const { client } = clientReturning({
      status: "failed",
      errors: [{ code: "SAFETY", message: "blocked by policy" }],
    });
    const res = await renderImage(request({ client }));
    expect(res).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("settles at the estimate when the call throws (it may have been billed)", async () => {
    const meter = new SpendMeter(1);
    const { client } = clientReturning(new Error("network down"));
    const res = await renderImage(request({ client, meter }));
    expect(res).toMatchObject({
      ok: false,
      reason: "error",
      detail: "network down",
    });
    expect(meter.spentMicros).toBe(estimateCostMicros("nano-banana-2.1", 2));
    expect(meter.pendingMicros).toBe(0);
  });

  describe("HTTP status on a thrown provider error", () => {
    const status = (n: number) =>
      Object.assign(new Error(`${n} API error occurred`), { status: n });
    it.each([402, 429])("settles at zero for a %i", async (n) => {
      const meter = new SpendMeter(1);
      const { client } = clientReturning(status(n));
      const res = await renderImage(request({ client, meter }));
      expect(res).toMatchObject({ ok: false, reason: "error", costUsd: 0 });
      if (!res.ok) expect(res.detail).toContain(`status=${n}`);
      expect(meter.spentMicros).toBe(0);
      expect(meter.pendingMicros).toBe(0);
    });
    it("reads the status from the message when no field carries it", async () => {
      const meter = new SpendMeter(1);
      const { client } = clientReturning(new Error("402 API error occurred"));
      await renderImage(request({ client, meter }));
      expect(meter.spentMicros).toBe(0);
    });
    it("settles at the estimate for a 500", async () => {
      const meter = new SpendMeter(1);
      const { client } = clientReturning(status(500));
      await renderImage(request({ client, meter }));
      expect(meter.spentMicros).toBe(estimateCostMicros("nano-banana-2.1", 2));
    });
    it("logs one error line per failed call: model, pose, attempt, status", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { client } = clientReturning(status(402));
      await renderImage(request({ client }));
      expect(err).toHaveBeenCalledTimes(1);
      const line = String(err.mock.calls[0]![0]);
      expect(line).toContain("model=nano-banana-2.1");
      expect(line).toContain("pose=walking");
      expect(line).toContain("attempt=1");
      expect(line).toContain("status=402");
      expect(line).not.toContain("person-bytes");
      err.mockRestore();
    });
  });

  it("settles at the estimate when a response reports no usage", async () => {
    const meter = new SpendMeter(1);
    const { client } = clientReturning({
      output_image: { data: Buffer.from("png").toString("base64") },
    });
    const res = await renderImage(request({ client, meter }));
    expect(res.ok).toBe(true);
    const est = estimateCostMicros("nano-banana-2.1", 2);
    expect(meter.spentMicros).toBe(est);
    expect(est).toBeGreaterThan(costMicros("nano-banana-2.1", 0, true));
  });

  it("records output and thought token counts without pricing them", async () => {
    const meter = new SpendMeter(1);
    const { client } = clientReturning({
      usage: {
        total_input_tokens: 3000,
        total_output_tokens: 1290,
        total_thought_tokens: 77,
      },
      output_image: { data: Buffer.from("png").toString("base64") },
    });
    const res = await renderImage(request({ client, meter }));
    expect(res).toMatchObject({ outputTokens: 1290, thoughtTokens: 77 });
    expect(meter.spentMicros).toBe(costMicros("nano-banana-2.1", 3000, true));
  });

  it("returns the paid image even when settling fails", async () => {
    const meter: SpendLedger = {
      reserve: async () => async () => {
        throw new Error("firestore down at consents/abc");
      },
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clientReturning({
      usage: { total_input_tokens: 3000 },
      output_image: { data: Buffer.from("png").toString("base64") },
    });
    const res = await renderImage(request({ client, meter }));
    expect(res.ok).toBe(true);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).not.toContain("abc");
    err.mockRestore();
  });

  it("does not call the model when the reservation already exists", async () => {
    const meter: SpendLedger = {
      reserve: async () => {
        throw new ReservationExistsError("j1__walking__1");
      },
    };
    const { client, create } = clientReturning({});
    await expect(
      renderImage(request({ client, meter })),
    ).rejects.toBeInstanceOf(ReservationExistsError);
    expect(create).not.toHaveBeenCalled();
  });

  it("times out a call that never answers: error result, settled at the estimate, signal aborted", async () => {
    const meter = new SpendMeter(1);
    let signal: AbortSignal | undefined;
    const client = {
      interactions: {
        create: vi.fn((_p: unknown, o?: { signal?: AbortSignal }) => {
          signal = o?.signal;
          return new Promise<InteractionLike>(() => {});
        }),
      },
    } as GeminiClient;
    const res = await renderImage(request({ client, meter, timeoutMs: 30 }));
    expect(res).toMatchObject({ ok: false, reason: "error" });
    expect((res as { detail: string }).detail).toMatch(/timed out/);
    expect(meter.spentMicros).toBe(estimateCostMicros("nano-banana-2.1", 2));
    expect(meter.pendingMicros).toBe(0);
    expect(signal?.aborted).toBe(true);
  });

  it("refuses at the ceiling without calling the model", async () => {
    const { client, create } = clientReturning({});
    await expect(
      renderImage(request({ client, meter: new SpendMeter(0.01) })),
    ).rejects.toBeInstanceOf(SpendCeilingError);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider name instead of falling back", async () => {
    vi.stubEnv("RENDER_PROVIDER", "mock");
    await expect(renderImage(request())).rejects.toThrow(/RENDER_PROVIDER/);
  });
});

describe("the fake provider", () => {
  it("cannot be selected in production", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    vi.stubEnv("NODE_ENV", "production");
    const meter = new SpendMeter(1);
    await expect(renderImage(request({ meter }))).rejects.toThrow(/production/);
    expect(meter.pendingMicros).toBe(0);
  });

  it("cannot be called directly in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      fakeProvider({
        model: "nano-banana-2.1",
        prompt: "p",
        images: [garment, person],
        aspectRatio: "3:4",
        meta: {},
      }),
    ).rejects.toThrow(/production/);
  });

  it("returns a 3:4 image of at least 768 px that is not uniform, and meters it", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    const meter = new SpendMeter(1);
    const res = await renderImage(request({ meter }));
    if (!res.ok) throw new Error(res.detail);
    const meta = await sharp(res.image.data).metadata();
    expect(Math.min(meta.width!, meta.height!)).toBeGreaterThanOrEqual(768);
    expect(Math.abs(meta.width! / meta.height! - 3 / 4)).toBeLessThan(0.015);
    const stats = await sharp(res.image.data).stats();
    expect(stats.channels[1]!.stdev).toBeGreaterThan(20);
    expect(meter.spentMicros).toBe(
      costMicros("nano-banana-2.1", res.promptTokens, true),
    );
  });

  it("is deterministic for one input and differs between poses", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    const render = async (pose: string) => {
      const res = await renderImage(request({ meta: { pose } }));
      if (!res.ok) throw new Error(res.detail);
      return res.image.data;
    };
    const [a, again, b] = [
      await render("walking"),
      await render("walking"),
      await render("seated"),
    ];
    expect(a.equals(again)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });

  it("plays each scripted outcome", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    const run = async (outcome: Parameters<typeof setFakeScript>[0]) => {
      setFakeScript(outcome);
      return renderImage(request());
    };
    expect(await run([{ outcome: "blocked" }])).toMatchObject({
      reason: "blocked",
    });
    expect(await run([{ outcome: "no_image" }])).toMatchObject({
      reason: "no_image",
    });
    expect(await run([{ outcome: "error" }])).toMatchObject({
      reason: "error",
    });

    const small = await run([{ outcome: "undersized" }]);
    if (!small.ok) throw new Error(small.detail);
    expect((await sharp(small.image.data).metadata()).width).toBeLessThan(768);

    const blank = await run([{ outcome: "blank" }]);
    if (!blank.ok) throw new Error(blank.detail);
    const stats = await sharp(blank.image.data).stats();
    expect(Math.max(...stats.channels.map((c) => c.stdev))).toBe(0);

    const copy = await run([{ outcome: "copy_input" }]);
    if (!copy.ok) throw new Error(copy.detail);
    expect(copy.image.data.equals(person.data)).toBe(true);
  });

  it("applies a rule to its pose only, and only `times` times", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    setFakeScript([{ pose: "walking", outcome: "blocked", times: 1 }]);
    const walking = () => renderImage(request({ meta: { pose: "walking" } }));
    expect((await renderImage(request({ meta: { pose: "front" } }))).ok).toBe(
      true,
    );
    expect((await walking()).ok).toBe(false);
    expect((await walking()).ok).toBe(true);
  });

  it("re-reads a script file on every call, for tests driving another process", async () => {
    vi.stubEnv("RENDER_PROVIDER", "fake");
    const file = join(mkdtempSync(join(tmpdir(), "fake-")), "script.json");
    vi.stubEnv("RENDER_FAKE_SCRIPT_FILE", file);
    writeFileSync(file, JSON.stringify([{ outcome: "no_image" }]));
    expect((await renderImage(request())).ok).toBe(false);
    writeFileSync(file, "[]");
    expect((await renderImage(request())).ok).toBe(true);
  });
});

describe("the reservation estimate", () => {
  it("counts every input image: an outfit's three cost more than a try-on's two", () => {
    const two = estimateCostMicros("nano-banana-2.1", 2);
    const three = estimateCostMicros("nano-banana-2.1", 3);
    expect(three).toBeGreaterThan(two);
    // 2000 estimated tokens per image at $1.5 per million tokens = 3000 micro-USD.
    expect(three - two).toBeGreaterThanOrEqual(3000);
    expect(three).toBe(Math.ceil(0.0336 * 1e6 + (3 * 2000 + 500) * 1.5));
  });
});
