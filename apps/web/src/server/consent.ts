import { recordConsent } from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export async function acceptConsent(
  user: User,
  input: unknown,
): Promise<Result<{ consented: true }>> {
  const b = (input ?? {}) as Record<string, unknown>;
  if (
    typeof input !== "object" ||
    input === null ||
    b.version !== CONSENT_VERSION ||
    b.ageAttested18 !== true ||
    b.accepted !== true
  ) {
    return err("invalid_consent");
  }
  await recordConsent(user.uid, CONSENT_VERSION);
  return ok({ consented: true as const });
}
