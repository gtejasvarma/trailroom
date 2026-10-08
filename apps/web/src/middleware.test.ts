import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

const middleware = readFileSync(resolve(__dirname, "middleware.ts"), "utf8");

describe("request body limit", () => {
  it("Next's buffered-body limit is above the upload limit plus multipart framing", () => {
    const v = nextConfig.experimental?.proxyClientMaxBodySize;
    const bytes =
      typeof v === "number" ? v : Number.parseInt(String(v), 10) * 1024 * 1024;
    expect(bytes).toBeGreaterThanOrEqual(10 * 1024 * 1024 + 64 * 1024);
  });
});

describe("gate exemptions", () => {
  it("only _next/static and the favicon are skipped; _next/image is gated", () => {
    const matcher = /matcher:\s*\[\s*"([^"]+)"/.exec(middleware)?.[1] ?? "";
    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("favicon.ico");
    expect(matcher).not.toContain("_next/image");
  });

  it("the image optimizer is turned off", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });
});
