import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ASK_TOKEN_PATTERN,
  getAskByToken,
  hashAskToken,
  isAskTokenShape,
  newAskToken,
} from "./index";

describe("ask tokens", () => {
  it("are 256 bits of URL-safe characters: 43 base64url characters", () => {
    for (let i = 0; i < 50; i++) {
      const { token } = newAskToken();
      expect(token).toHaveLength(43);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
      expect(ASK_TOKEN_PATTERN.test(token)).toBe(true);
    }
  });

  it("are unique", () => {
    expect(
      new Set(Array.from({ length: 1000 }, () => newAskToken().token)).size,
    ).toBe(1000);
  });

  it("come with the SHA-256 hex of the token, and that is all that should be stored", () => {
    const { token, hash } = newAskToken();
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashAskToken(token)).toBe(hash);
  });

  it("have a shape check that rejects everything else", () => {
    expect(isAskTokenShape(newAskToken().token)).toBe(true);
    for (const bad of [
      "",
      "x",
      "a".repeat(42),
      "a".repeat(44),
      "a".repeat(500),
      `${"a".repeat(42)}=`,
      `${"a".repeat(42)}/`,
      "../../etc/passwd",
      undefined,
      null,
      5,
    ]) {
      expect(isAskTokenShape(bad)).toBe(false);
    }
  });

  it("a malformed token is answered without touching Firestore", async () => {
    // With no emulator and no project configured, any Firestore access throws. A garbage token
    // resolves to null, so it never got that far; a well-formed one does reach the lookup.
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.FIREBASE_CONFIG;
    for (const bad of ["x", "a".repeat(500), "../../x", ""]) {
      await expect(getAskByToken(bad)).resolves.toBeNull();
    }
    await expect(getAskByToken(newAskToken().token)).rejects.toThrow();
  });
});
