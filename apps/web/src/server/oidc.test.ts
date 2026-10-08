import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  requireServiceCaller,
  type ServiceCallerOptions,
  requireWorkflowsCaller,
  useKeySourceForTests,
} from "./oidc";
import {
  AUDIENCE,
  keySourceFor,
  makeKey,
  signToken,
  WORKFLOWS_SA,
} from "./oidc-testkit";

const key = makeKey();
const other = makeKey("test-key-1"); // same kid, different key material

const opts: ServiceCallerOptions = {
  audience: AUDIENCE,
  allowedEmails: [WORKFLOWS_SA],
  keySource: keySourceFor(key),
};
const call = (headers: Record<string, string>, o = opts) =>
  requireServiceCaller(
    new Request("http://x/api/internal/ping", { headers }),
    o,
  );
const withToken = (t: string) => ({ authorization: `Bearer ${t}` });
const expect401 = async (p: ReturnType<typeof call>) => {
  const r = await p;
  expect(r).toBeInstanceOf(Response);
  expect((r as Response).status).toBe(401);
};

describe("requireServiceCaller", () => {
  it("accepts a valid token from an allowed service account", async () => {
    const r = await call(withToken(signToken(key)));
    expect(r).toEqual({ email: WORKFLOWS_SA });
  });

  it("rejects missing, non-Bearer and malformed credentials", async () => {
    await expect401(call({}));
    await expect401(call({ authorization: `Basic ${signToken(key)}` }));
    await expect401(call({ authorization: "Bearer" }));
    await expect401(call(withToken("not-a-jwt")));
    await expect401(call(withToken("a.b.c")));
  });

  it("rejects the wrong audience, issuer, expired and unverified-email tokens", async () => {
    await expect401(
      call(withToken(signToken(key, { aud: "https://evil.test" }))),
    );
    await expect401(
      call(withToken(signToken(key, { iss: "https://evil.test" }))),
    );
    await expect401(
      call(withToken(signToken(key, { iss: "accounts.google.com" }))),
    );
    const past = Math.floor(Date.now() / 1000) - 7200;
    await expect401(
      call(withToken(signToken(key, { iat: past, exp: past + 3600 }))),
    );
    await expect401(call(withToken(signToken(key, { email_verified: false }))));
    await expect401(
      call(withToken(signToken(key, { email_verified: undefined }))),
    );
  });

  it("rejects an email that is not on the allow-list", async () => {
    await expect401(
      call(withToken(signToken(key, { email: "someone@example.com" }))),
    );
    await expect401(call(withToken(signToken(key, { email: undefined }))));
  });

  it("rejects a token signed by a different key, and alg none", async () => {
    await expect401(call(withToken(signToken(other))));
    await expect401(call(withToken(signToken(key, {}, { alg: "none" }))));
    const unsigned =
      signToken(key, {}, { alg: "none" }).split(".").slice(0, 2).join(".") +
      ".";
    await expect401(call(withToken(unsigned)));
    await expect401(call(withToken(signToken(key, {}, { alg: "HS256" }))));
    await expect401(call(withToken(signToken(key, {}, { kid: "unknown" }))));
  });

  it("fails closed when its config is missing", async () => {
    const token = signToken(key);
    await expect401(call(withToken(token), { ...opts, audience: undefined }));
    await expect401(call(withToken(token), { ...opts, audience: "" }));
    await expect401(call(withToken(token), { ...opts, allowedEmails: [] }));
    await expect401(
      call(withToken(token), { ...opts, allowedEmails: [undefined, ""] }),
    );
  });
});

describe("env-driven callers", () => {
  const saved = { ...process.env };
  beforeEach(() => useKeySourceForTests(keySourceFor(key)));
  afterEach(() => {
    useKeySourceForTests(null);
    process.env = { ...saved };
  });
  const r = () =>
    new Request("http://x", { headers: withToken(signToken(key)) });

  it("passes when INTERNAL_AUDIENCE and WORKFLOWS_SA_EMAIL are set", async () => {
    process.env.INTERNAL_AUDIENCE = AUDIENCE;
    process.env.WORKFLOWS_SA_EMAIL = WORKFLOWS_SA;
    expect(await requireWorkflowsCaller(r())).toEqual({ email: WORKFLOWS_SA });
  });

  it("is a 401 for an otherwise valid token when env is missing", async () => {
    delete process.env.INTERNAL_AUDIENCE;
    process.env.WORKFLOWS_SA_EMAIL = WORKFLOWS_SA;
    expect(((await requireWorkflowsCaller(r())) as Response).status).toBe(401);
    process.env.INTERNAL_AUDIENCE = AUDIENCE;
    delete process.env.WORKFLOWS_SA_EMAIL;
    expect(((await requireWorkflowsCaller(r())) as Response).status).toBe(401);
  });

  it("the test key source cannot be installed in production", () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      expect(() => useKeySourceForTests(keySourceFor(key))).toThrow();
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
  });
});
