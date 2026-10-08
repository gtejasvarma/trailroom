import { describe, expect, it } from "vitest";
import { clientKey, createAttemptLimiter } from "./gate-limit";
import {
  GATE_MAX_AGE_SECONDS,
  constantTimeEqual,
  readGateConfig,
  signGateCookie,
  verifyGateCookie,
} from "./gate";

const SECRET = "test-secret-aaaaaaaaaaaaaaaa";
const PW = "the-password";
const NOW = Date.UTC(2026, 9, 6);

describe("gate cookie", () => {
  it("signs and verifies", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    expect(await verifyGateCookie(SECRET, PW, v, NOW + 1000)).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    const flipped = v.slice(0, -1) + (v.endsWith("0") ? "1" : "0");
    expect(await verifyGateCookie(SECRET, PW, flipped, NOW)).toBe(false);
  });

  it("rejects an extended expiry without re-signing", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    const [expiry, sig] = v.split(".");
    const forged = `${Number(expiry) + 999999}.${sig}`;
    expect(await verifyGateCookie(SECRET, PW, forged, NOW)).toBe(false);
  });

  it("rejects an expired cookie", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    const later = NOW + (GATE_MAX_AGE_SECONDS + 1) * 1000;
    expect(await verifyGateCookie(SECRET, PW, v, later)).toBe(false);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const v = await signGateCookie("another-secret", PW, NOW);
    expect(await verifyGateCookie(SECRET, PW, v, NOW)).toBe(false);
  });

  it("changing the password invalidates existing cookies", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    expect(await verifyGateCookie(SECRET, "another-password", v, NOW)).toBe(
      false,
    );
    expect(await verifyGateCookie(SECRET, PW, v, NOW)).toBe(true);
  });

  it("does not put the password or its hash in the cookie value", async () => {
    const v = await signGateCookie(SECRET, PW, NOW);
    expect(v).not.toContain(PW);
    expect(v).toMatch(/^\d+\.[0-9a-f]{64}$/);
  });

  it("rejects missing and malformed values", async () => {
    for (const bad of [undefined, "", "nodot", ".sig", "abc.def", "123."]) {
      expect(await verifyGateCookie(SECRET, PW, bad, NOW)).toBe(false);
    }
  });
});

describe("constantTimeEqual", () => {
  it("is correct for equal-length inputs", async () => {
    expect(await constantTimeEqual("hunter22", "hunter22")).toBe(true);
    expect(await constantTimeEqual("hunter22", "hunter23")).toBe(false);
  });

  it("is correct for unequal-length inputs, including prefixes", async () => {
    expect(await constantTimeEqual("hunter", "hunter22")).toBe(false);
    expect(await constantTimeEqual("", "x")).toBe(false);
    expect(await constantTimeEqual("", "")).toBe(true);
  });

  it("compares fixed-size digests, so length is never an early exit", async () => {
    // Both a short and a very long wrong guess go through the same hash-then-compare
    // path; neither can be rejected on length alone.
    const spy = [] as number[];
    const orig = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (async (
      alg: AlgorithmIdentifier,
      data: BufferSource,
    ) => {
      const out = await orig(alg, data);
      spy.push(out.byteLength);
      return out;
    }) as typeof crypto.subtle.digest;
    try {
      await constantTimeEqual("a", "b");
      await constantTimeEqual("a", "b".repeat(10_000));
    } finally {
      crypto.subtle.digest = orig;
    }
    expect(spy).toEqual([32, 32, 32, 32]);
  });
});

describe("readGateConfig", () => {
  it("fails closed when either value is missing, in production or not", () => {
    for (const env of [
      {},
      { GATE_PASSWORD: "pw" },
      { GATE_COOKIE_SECRET: "s" },
      { GATE_PASSWORD: "", GATE_COOKIE_SECRET: "s" },
    ]) {
      expect(readGateConfig(env)).toBeNull();
      expect(readGateConfig({ ...env, NODE_ENV: "production" })).toBeNull();
    }
  });

  it("refuses to start when the password equals the cookie secret", () => {
    expect(
      readGateConfig({ GATE_PASSWORD: "same", GATE_COOKIE_SECRET: "same" }),
    ).toBeNull();
  });

  it("returns the config when both are set", () => {
    expect(
      readGateConfig({ GATE_PASSWORD: "pw", GATE_COOKIE_SECRET: "s" }),
    ).toEqual({
      password: "pw",
      secret: "s",
    });
  });
});

describe("attempt limiter", () => {
  it("blocks the eleventh failed attempt in ten minutes, per client, and frees after the window", () => {
    let t = 0;
    const l = createAttemptLimiter(10, 600_000, () => t);
    for (let i = 0; i < 10; i++) {
      expect(l.blocked("1.1.1.1")).toBe(false);
      l.recordFailure("1.1.1.1");
    }
    expect(l.blocked("1.1.1.1")).toBe(true);
    expect(l.blocked("2.2.2.2")).toBe(false);
    t = 600_001;
    expect(l.blocked("1.1.1.1")).toBe(false);
  });

  it("keys on the first x-forwarded-for hop, with a constant fallback", () => {
    expect(
      clientKey(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })),
    ).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
