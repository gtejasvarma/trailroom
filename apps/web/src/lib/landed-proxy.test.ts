import { describe, expect, it } from "vitest";
import {
  LANDED_ORIGIN,
  landedUrl,
  requestHeadersForLanded,
  responseHeadersFromLanded,
} from "./landed-proxy";

describe("forwarding /landed to Landed", () => {
  it("keeps the path and query, and changes only the host", () => {
    expect(landedUrl("https://trailroom.ai/landed/api/me?x=1")).toBe(
      `${LANDED_ORIGIN}/landed/api/me?x=1`,
    );
    expect(landedUrl("https://trailroom.ai/landed")).toBe(
      `${LANDED_ORIGIN}/landed`,
    );
  });
  it("never passes Trailroom's host or cookies on, and keeps the sign-in and Google token headers", () => {
    const h = requestHeadersForLanded(
      new Headers({
        host: "trailroom.ai",
        cookie: "trailroom_gate=secret",
        authorization: "Bearer id-token",
        "x-google-access-token": "ya29.token",
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      }),
      "https://trailroom.ai/landed/api/setup",
    );
    expect(h.get("host")).toBeNull();
    expect(h.get("cookie")).toBeNull();
    expect(h.get("authorization")).toBe("Bearer id-token");
    expect(h.get("x-google-access-token")).toBe("ya29.token");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("x-forwarded-host")).toBe("trailroom.ai");
  });
  it("drops the compression and framing headers fetch has already dealt with, and keeps the rest", () => {
    const h = responseHeadersFromLanded(
      new Headers({
        "content-encoding": "gzip",
        "content-length": "123",
        "content-type": "audio/L16;rate=24000",
        "cache-control": "no-store",
        "x-frame-options": "DENY",
      }),
    );
    expect(h.get("content-encoding")).toBeNull();
    expect(h.get("content-length")).toBeNull();
    expect(h.get("content-type")).toBe("audio/L16;rate=24000");
    expect(h.get("x-frame-options")).toBe("DENY");
  });
});
