import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isExempt, isPublicAskPath } from "./gate-paths";

const TOKEN = "A".repeat(43);

describe("the password gate's exemptions", () => {
  it.each([
    "/gate",
    "/api/gate",
    "/api/internal",
    "/api/internal/purge",
    "/api/internal/pipeline/prepare",
    `/ask/${TOKEN}`,
    "/ask/not-a-real-token",
    `/api/ask/${TOKEN}`,
    `/api/ask/${TOKEN}/vote`,
    `/api/ask/${TOKEN}/image/coat`,
  ])("lets %s through", (p) => {
    expect(isExempt(p)).toBe(true);
  });

  it.each([
    "/",
    "/lists",
    "/lists/abc",
    "/asks",
    "/asks/abc",
    "/asked/abc",
    "/ask",
    "/ask/",
    "/ask//",
    `/ask/${TOKEN}/`,
    `/ask/${TOKEN}/extra`,
    `/ask${TOKEN}`,
    "/Ask/x",
    "/ASK/x",
    "/ask/.",
    "/ask/..",
    "/api",
    "/api/ask",
    "/api/ask/",
    "/api/asks",
    "/api/asks/abc/revoke",
    "/api/ask-anything",
    "/api/ask-anything/x",
    "/api/lists",
    "/api/inbox",
    "/api/inbox/abc",
    "/api/me",
    "/api/photo",
    "/api/renders/a/front",
    "/api/internal-x",
    "/api/gate/x",
    `/api/ask/${TOKEN}/vote/extra`,
    `/api/ask/${TOKEN}/image`,
    `/api/ask/${TOKEN}/image/`,
    `/api/ask/${TOKEN}/image/coat/extra`,
    `/api/ask/${TOKEN}/other`,
    "/api/ask/../lists",
    "/api/ask/./lists",
    "/%61sk/x",
    "/ask%2Fx",
    "/api%2Fask%2Fx",
    "/api/%61sk/x",
    "/catalog/x.jpg",
    "/you",
    "/item/coat",
    "/_next/image",
  ])("keeps %s behind the gate", (p) => {
    expect(isExempt(p)).toBe(false);
  });

  it("an encoded slash stays inside the token segment, so it never reaches another route", () => {
    // Still one segment as far as the gate is concerned: the page is public, but only the
    // /ask/[token] route can serve it, and the token fails its shape check there.
    expect(isPublicAskPath("/ask/x%2F..%2F..%2Flists")).toBe(true);
    expect(isPublicAskPath("/ask/x/../../lists")).toBe(false);
  });

  it("the middleware uses this list and nothing else", () => {
    const src = readFileSync(resolve(__dirname, "../middleware.ts"), "utf8");
    expect(src).toContain('from "@/lib/gate-paths"');
    expect(src).not.toMatch(/pathname\s*===\s*"\/ask/);
  });
});
