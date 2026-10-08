import { describe, expect, it } from "vitest";
import { describeError, redactPaths } from "./log";

describe("redactPaths", () => {
  it("redacts id segments of known paths", () => {
    const m =
      "No document to update: projects/p/databases/(default)/documents/jobs/abc123 and consents/uid9, photos/uid9/base.jpg, renders/uid9/set1/front.jpg, jobInternals/abc123";
    const out = redactPaths(m);
    for (const secret of ["abc123", "uid9", "set1"])
      expect(out).not.toContain(secret);
    expect(out).toContain("jobs/…");
    expect(out).toContain("consents/…");
    expect(out).toContain("photos/…");
    expect(out).toContain("renders/…");
    expect(out).toContain("jobInternals/…");
  });

  it("leaves other text alone", () => {
    expect(redactPaths("network down")).toBe("network down");
  });
});

describe("describeError", () => {
  it("prints the code and a redacted message", () => {
    const e = Object.assign(new Error("gone: jobs/xyz"), { code: 5 });
    expect(describeError(e)).toBe("code=5 gone: jobs/…");
  });
  it("copes with non-errors", () => {
    expect(describeError("boom")).toBe("code=none boom");
  });
});
