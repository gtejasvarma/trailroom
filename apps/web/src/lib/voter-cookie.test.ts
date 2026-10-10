import { describe, expect, it } from "vitest";
import { newVoterKey } from "@trailroom/db";
import { readVoterKey, voterCookie } from "./voter-cookie";

describe("the voter cookie", () => {
  it("is HttpOnly, SameSite=Lax, scoped to the API that reads it, Secure only in production", () => {
    const key = newVoterKey();
    const dev = voterCookie(key, false);
    const prod = voterCookie(key, true);
    expect(dev).toContain(`trailroom_voter=${key}`);
    for (const c of [dev, prod]) {
      expect(c).toContain("HttpOnly");
      expect(c).toContain("SameSite=Lax");
      expect(c).toContain("Path=/api/ask");
      expect(c).toMatch(/Max-Age=\d+/);
    }
    expect(dev).not.toContain("Secure");
    expect(prod).toContain("Secure");
  });

  it("reads back what it issued, and nothing that is not that shape", () => {
    const key = newVoterKey();
    expect(readVoterKey(`a=b; trailroom_voter=${key}; c=d`)).toBe(key);
    expect(readVoterKey(`trailroom_voter=${key}`)).toBe(key);
    expect(readVoterKey(null)).toBeNull();
    expect(readVoterKey("")).toBeNull();
    expect(readVoterKey("other=1")).toBeNull();
    expect(readVoterKey("trailroom_voter=short")).toBeNull();
    // A Firebase uid (28 characters) is never accepted as a voter key.
    expect(readVoterKey("trailroom_voter=" + "a".repeat(28))).toBeNull();
    expect(readVoterKey(`trailroom_voter=${key}x`)).toBeNull();
    expect(readVoterKey(`xtrailroom_voter=${key}`)).toBeNull();
  });

  it("keys are 128 random bits, unique", () => {
    const keys = new Set(Array.from({ length: 200 }, newVoterKey));
    expect(keys.size).toBe(200);
    for (const k of keys) expect(k).toMatch(/^[a-f0-9]{32}$/);
  });
});
