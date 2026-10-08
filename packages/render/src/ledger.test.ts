import { describe, expect, it } from "vitest";
import { SpendCeilingError, SpendMeter } from "./ledger";
import { microsToUsd, usdToMicros, usdToMicrosCeil } from "./money";
import { estimateCostUsd, MODELS, type ModelKey } from "./models";
import { costMicros, estimateCostMicros } from "./index";

describe("SpendMeter", () => {
  it("refuses a reservation that would pass the ceiling, counting calls in flight", async () => {
    const meter = new SpendMeter(1);
    await meter.reserve(600_000);
    await expect(meter.reserve(400_001)).rejects.toBeInstanceOf(
      SpendCeilingError,
    );
  });

  it("admits a reservation that lands exactly on the ceiling", async () => {
    const meter = new SpendMeter(1);
    await meter.reserve(600_000);
    await expect(meter.reserve(400_000)).resolves.toBeTypeOf("function");
  });

  it("settles once: a second settle changes nothing", async () => {
    const meter = new SpendMeter(1);
    const settle = await meter.reserve(500_000);
    await settle(120_000);
    await settle(900_000);
    expect(meter.spentMicros).toBe(120_000);
    expect(meter.pendingMicros).toBe(0);
  });

  it("releases the unspent part of a reservation on settle", async () => {
    const meter = new SpendMeter(1);
    const settle = await meter.reserve(900_000);
    await settle(100_000);
    await expect(meter.reserve(900_000)).resolves.toBeTypeOf("function");
  });

  it("admits exactly seven of twenty concurrent reservations when seven fit", async () => {
    const meter = new SpendMeter(0.7);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => meter.reserve(100_000)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(7);
    expect(meter.pendingMicros).toBe(700_000);
  });
});

describe("money", () => {
  it("round-trips dollars through micro-USD", () => {
    for (const usd of [0, 0.0336, 0.067, 0.134, 5, 0.000001]) {
      expect(microsToUsd(usdToMicros(usd))).toBeCloseTo(usd, 9);
    }
    expect(usdToMicros(0.0336)).toBe(33_600);
  });

  it("rounds reservations up, without being fooled by float noise", () => {
    expect(usdToMicrosCeil(0.1)).toBe(100_000);
    expect(usdToMicrosCeil(0.0000011)).toBe(2);
  });

  it("does not drift over 10,000 additions", () => {
    const per = costMicros("nano-banana-2.1", 2713, true);
    let total = 0;
    for (let i = 0; i < 10_000; i++) total += per;
    expect(total).toBe(per * 10_000);
    expect(Number.isInteger(total)).toBe(true);
  });
});

describe("cost arithmetic", () => {
  // Hand-computed: tokens x $/MTok is micro-USD; add the flat 1K image price.
  const cases: [ModelKey, number, number][] = [
    ["nano-banana-2.1", 3000, 4_500 + 33_600],
    ["nano-banana-2-lite", 3000, 750 + 33_600],
    ["nano-banana-2", 3000, 1_500 + 67_000],
    ["nano-banana-pro", 3000, 6_000 + 134_000],
  ];
  it.each(cases)("%s with an image", (model, tokens, micros) => {
    expect(costMicros(model, tokens, true)).toBe(micros);
  });

  it("charges input tokens only when no image came back", () => {
    expect(costMicros("nano-banana-2.1", 3000, false)).toBe(4_500);
  });

  it("covers every model in the table", () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(Object.keys(MODELS).sort());
  });

  it("estimates two input images at 4,500 tokens plus the image", () => {
    expect(estimateCostUsd("nano-banana-2.1", 2)).toBeCloseTo(
      0.0336 + 0.00675,
      9,
    );
    expect(estimateCostMicros("nano-banana-2.1", 2)).toBe(40_350);
  });

  it("never estimates below the real cost of a typical call", () => {
    for (const model of Object.keys(MODELS) as ModelKey[]) {
      expect(estimateCostMicros(model, 2)).toBeGreaterThanOrEqual(
        costMicros(model, 3000, true),
      );
    }
  });
});
