import { beforeEach, describe, expect, it } from "vitest";
import {
  DELETE as followDELETE,
  POST as followPOST,
} from "../app/api/follows/[label]/route";
import { GET as meGET } from "../app/api/me/route";
import { anonymousToken, emailToken, req, reset } from "./testkit";

beforeEach(reset);

const ctx = (label: string) => ({ params: Promise.resolve({ label }) });
const follow = (token: string | undefined, label: string) =>
  followPOST(req("POST", `/api/follows/${label}`, { token }), ctx(label));
const unfollow = (token: string | undefined, label: string) =>
  followDELETE(req("DELETE", `/api/follows/${label}`, { token }), ctx(label));
const me = async (token: string) =>
  (await (await meGET(req("GET", "/api/me", { token }))).json()) as {
    follows: string[];
  };

describe("/api/follows/[label]", () => {
  it("needs a session", async () => {
    expect((await follow(undefined, "marchand")).status).toBe(401);
    expect((await unfollow(undefined, "marchand")).status).toBe(401);
  });

  it("follows, is idempotent, and shows in /api/me", async () => {
    const t = await anonymousToken();
    expect((await me(t)).follows).toEqual([]);
    for (let i = 0; i < 2; i++) {
      const res = await follow(t, "marchand");
      expect(res.status).toBe(200);
      expect((await res.json()).follows).toEqual(["marchand"]);
    }
    await follow(t, "cyra");
    expect((await me(t)).follows).toEqual(["cyra", "marchand"]);
  });

  it("unfollows, and unfollowing a label never followed is fine", async () => {
    const t = await emailToken();
    await follow(t, "marchand");
    for (let i = 0; i < 2; i++) {
      const res = await unfollow(t, "marchand");
      expect(res.status).toBe(200);
      expect((await res.json()).follows).toEqual([]);
    }
    expect((await unfollow(t, "cyra")).status).toBe(200);
    expect((await me(t)).follows).toEqual([]);
  });

  it("another user cannot see it", async () => {
    const a = await anonymousToken();
    const b = await anonymousToken();
    await follow(a, "loam-studio");
    expect((await me(a)).follows).toEqual(["loam-studio"]);
    expect((await me(b)).follows).toEqual([]);
  });

  it("404s a label we do not carry, and never writes it", async () => {
    const t = await anonymousToken();
    for (const label of ["nobody", "..", "MARCHAND"]) {
      const res = await follow(t, label);
      expect(res.status, label).toBe(404);
      expect((await res.json()).error).toBe("unknown_label");
    }
    expect((await me(t)).follows).toEqual([]);
  });
});
