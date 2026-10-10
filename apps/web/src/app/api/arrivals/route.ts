import { getArrivalsView } from "../../../server/arrivals";
import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getArrivalsView(user));
}
