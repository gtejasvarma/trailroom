import { arrivalsLimited, markSeen } from "../../../../server/arrivals";
import { requireUser } from "../../../../server/auth";
import { errorResponse, readJson, respond } from "../../../../server/http";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (arrivalsLimited("seen", user.uid))
    return errorResponse("too_many_attempts");
  return respond(await markSeen(user, await readJson(request)));
}
