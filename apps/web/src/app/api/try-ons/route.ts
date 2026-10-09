import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";
import { listTryOns } from "../../../server/try-ons";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await listTryOns(user));
}
