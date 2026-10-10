import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";
import { getInbox } from "../../../server/inbox";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getInbox(user));
}
