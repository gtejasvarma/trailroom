import { requireUser } from "../../../../../server/auth";
import { revokeAsk } from "../../../../../server/asks";
import { respond } from "../../../../../server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await revokeAsk(user, (await params).id));
}
