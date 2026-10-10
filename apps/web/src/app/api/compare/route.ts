import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";
import { getCompare } from "../../../server/compare";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(
    await getCompare(user, new URL(request.url).searchParams.get("ids")),
  );
}
