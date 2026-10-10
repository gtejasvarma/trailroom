import { arrivalsLimited, getArrivalsView } from "../../../server/arrivals";
import { requireUser } from "../../../server/auth";
import { errorResponse, respond } from "../../../server/http";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (arrivalsLimited("view", user.uid))
    return errorResponse("too_many_attempts");
  return respond(await getArrivalsView(user));
}
