// Test-only: signs Google-style OIDC ID tokens with a locally generated RSA key.
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";

export const AUDIENCE = "https://trailroom.example.test";
export const WORKFLOWS_SA = "workflows@demo-trailroom.iam.gserviceaccount.com";
export const SCHEDULER_SA = "scheduler@demo-trailroom.iam.gserviceaccount.com";

export interface TestKey {
  kid: string;
  privateKey: KeyObject;
  publicPem: string;
}

export function makeKey(kid = "test-key-1"): TestKey {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    kid,
    privateKey,
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const b64 = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");

export function signToken(
  key: TestKey,
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    email: WORKFLOWS_SA,
    email_verified: true,
    iat: now,
    exp: now + 3600,
    sub: "1234567890",
    ...claims,
  };
  const head = { alg: "RS256", typ: "JWT", kid: key.kid, ...header };
  const signed = `${b64(head)}.${b64(payload)}`;
  const sig = createSign("RSA-SHA256").update(signed).sign(key.privateKey);
  return `${signed}.${sig.toString("base64url")}`;
}

export const keySourceFor = (key: TestKey) => async () => ({
  [key.kid]: key.publicPem,
});

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
