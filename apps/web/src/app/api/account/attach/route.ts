import { attachAccount } from "../../../../server/account";
import { requireUser } from "../../../../server/auth";
import { respond } from "../../../../server/http";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await attachAccount(user));
}
