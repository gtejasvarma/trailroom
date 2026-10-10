import { requireUser } from "../../../server/auth";
import { readJson, respond } from "../../../server/http";
import { getPurchases, recordPurchase } from "../../../server/purchases";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getPurchases(user));
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await recordPurchase(user, await readJson(request)));
}
