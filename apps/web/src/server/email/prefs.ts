// The person's email switches. Refused (404) while the server has no transport, so a client that
// ignores the capability still cannot store a choice that would drive nothing.
import { getEmailPrefs, setEmailPrefs } from "@trailroom/db";
import { err, ok, type Result } from "../http";
import type { User } from "../auth";
import { emailEnabled } from "./transport";

export interface EmailPrefsBody {
  news: boolean;
  price: boolean;
}

export async function readEmailPrefs(
  user: User,
): Promise<Result<EmailPrefsBody>> {
  if (!emailEnabled()) return err("not_found");
  if (user.isGuest) return err("account_required");
  const p = await getEmailPrefs(user.uid);
  return ok({ news: p?.news === true, price: p?.price === true });
}

export async function writeEmailPrefs(
  user: User,
  input: unknown,
): Promise<Result<EmailPrefsBody>> {
  if (!emailEnabled()) return err("not_found");
  if (user.isGuest) return err("account_required");
  const b = (input ?? {}) as Record<string, unknown>;
  const keys = Object.keys(b);
  if (
    keys.length === 0 ||
    keys.some((k) => k !== "news" && k !== "price") ||
    keys.some((k) => typeof b[k] !== "boolean")
  ) {
    return err("invalid_request");
  }
  const p = await setEmailPrefs(user.uid, {
    ...(typeof b.news === "boolean" ? { news: b.news } : {}),
    ...(typeof b.price === "boolean" ? { price: b.price } : {}),
  });
  return ok({ news: p.news, price: p.price });
}
