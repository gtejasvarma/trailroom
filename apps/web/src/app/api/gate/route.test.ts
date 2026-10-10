import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.GATE_PASSWORD = "the-password";
  process.env.GATE_COOKIE_SECRET = "a-different-cookie-secret-aaaaaaaa";
  process.env.TRUSTED_PROXY_HOPS = "1";
});

async function attempt(forwardedFor: string, password = "wrong") {
  const { POST } = await import("./route");
  const body = new FormData();
  body.set("password", password);
  return POST(
    new NextRequest("http://localhost/api/gate", {
      method: "POST",
      body,
      headers: { "x-forwarded-for": forwardedFor },
    }),
  );
}

describe("the gate's rate limits", () => {
  it("cannot be dodged by a different made-up first hop each time", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await attempt(`6.6.6.${i}, 203.0.113.7`)).status);
    expect(statuses.slice(0, 10).every((s) => s === 303)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("has a global bucket that holds whatever the per-client key says", async () => {
    // Distinct real clients, so no per-client bucket fills; the global one does.
    let blocked = false;
    for (let i = 0; i < 150 && !blocked; i++)
      blocked = (await attempt(`198.51.${i % 250}.${i}`)).status === 429;
    expect(blocked).toBe(true);
    // Even a client never seen before, and even the right password, is refused while it is full.
    expect((await attempt("192.0.2.200", "the-password")).status).toBe(429);
  });
});
