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
        "x-workspace-token": "ya29.token",
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        // Headers the hosting platform adds on the way into Trailroom.
        "x-serverless-authorization": "Bearer platform-token",
        "x-fah-backend": "trailroom",
        "x-cloud-trace-context": "abc/1;o=1",
        traceparent: "00-abc-def-01",
        // Next.js client navigation.
        rsc: "1",
        "next-router-state-tree": "%5B%22%22%5D",
      }),
      "https://trailroom.ai/landed/api/setup",
    );
    expect(h.get("host")).toBeNull();
    expect(h.get("cookie")).toBeNull();
    expect(h.get("authorization")).toBe("Bearer id-token");
    expect(h.get("x-workspace-token")).toBe("ya29.token");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("x-forwarded-host")).toBe("trailroom.ai");
    for (const platform of [
      "x-serverless-authorization",
      "x-fah-backend",
      "x-cloud-trace-context",
      "traceparent",
      "x-forwarded-for",
    ])
      expect(h.get(platform), platform).toBeNull();
    expect(h.get("rsc")).toBe("1");
    expect(h.get("next-router-state-tree")).toBe("%5B%22%22%5D");
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
      "https://trailroom.ai/landed/x",
    );
    expect(h.get("content-encoding")).toBeNull();
    expect(h.get("content-length")).toBeNull();
    expect(h.get("content-type")).toBe("audio/L16;rate=24000");
    expect(h.get("x-frame-options")).toBe("DENY");
  });
  it("points Landed's redirects back at trailroom.ai, and leaves other redirects alone", () => {
    const own = responseHeadersFromLanded(
      new Headers({ location: `${LANDED_ORIGIN}/landed/privacy?_rsc` }),
      "https://trailroom.ai/landed/privacy",
    );
    expect(own.get("location")).toBe(
      "https://trailroom.ai/landed/privacy?_rsc",
    );
    const google = responseHeadersFromLanded(
      new Headers({ location: "https://accounts.google.com/o/oauth2/auth" }),
      "https://trailroom.ai/landed/new",
    );
    expect(google.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/auth",
    );
  });
});
