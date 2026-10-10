import { markSeen } from "../../../../server/arrivals";
import { requireUser } from "../../../../server/auth";
import { readJson, respond } from "../../../../server/http";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await markSeen(user, await readJson(request)));
}
