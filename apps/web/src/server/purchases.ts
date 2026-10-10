// Buy, and did it arrive. The labels are invented, so there is no merchant: pressing "Go to
// <label>" records an intent, and a later answer says whether it arrived. Signed-in people only.
import { getItem } from "@trailroom/catalog";
import {
  answerPurchase,
  listPurchasesForUser,
  recordPurchaseIntent,
  type PurchaseDoc,
} from "@trailroom/db";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export interface PurchaseBody {
  itemId: string;
  clickedAt: string;
  /** null until answered; once true or false it never changes. */
  arrived: boolean | null;
}

const body = (p: PurchaseDoc): PurchaseBody => ({
  itemId: p.itemId,
  clickedAt: p.clickedAt.toDate().toISOString(),
  arrived: p.arrived,
});

const validItem = (v: unknown): v is string =>
  typeof v === "string" && getItem(v) !== undefined;

export async function getPurchases(
  user: User,
): Promise<Result<{ purchases: PurchaseBody[] }>> {
  if (user.isGuest) return err("account_required");
  return ok({ purchases: (await listPurchasesForUser(user.uid)).map(body) });
}

/** POST /api/purchases { itemId }: records the intent once; a repeat returns the first record. */
export async function recordPurchase(
  user: User,
  input: unknown,
): Promise<Result<{ purchase: PurchaseBody; created: boolean }>> {
  if (user.isGuest) return err("account_required");
  const itemId = (input as { itemId?: unknown } | undefined)?.itemId;
  if (!validItem(itemId)) return err("unknown_item");
  const r = await recordPurchaseIntent(user.uid, itemId);
  return ok(
    { purchase: body(r.purchase), created: r.created },
    r.created ? 201 : 200,
  );
}

/** POST /api/purchases/{itemId}/arrived { arrived }: stored once; a second answer is 409. */
export async function answerArrived(
  user: User,
  itemId: string,
  input: unknown,
): Promise<Result<{ purchase: PurchaseBody }>> {
  if (user.isGuest) return err("account_required");
  const arrived = (input as { arrived?: unknown } | undefined)?.arrived;
  if (typeof arrived !== "boolean") return err("invalid_request");
  if (!validItem(itemId)) return err("not_found");
  const r = await answerPurchase(user.uid, itemId, arrived);
  if (r.status === "missing") return err("not_found");
  if (r.status === "already") return err("already_answered");
  return ok({ purchase: body(r.purchase) });
}
