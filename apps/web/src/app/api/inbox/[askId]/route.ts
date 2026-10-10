import { requireUser } from "../../../../server/auth";
import { respond } from "../../../../server/http";
import { getInboxDetail } from "../../../../server/inbox";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ askId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getInboxDetail(user, (await params).askId));
}
