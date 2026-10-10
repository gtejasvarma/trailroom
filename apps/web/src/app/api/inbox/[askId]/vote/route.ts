import { requireUser } from "../../../../../server/auth";
import { readJson, respond } from "../../../../../server/http";
import { voteInbox } from "../../../../../server/inbox";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ askId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const body = (await readJson(request)) as { itemId?: unknown } | undefined;
  return respond(await voteInbox(user, (await params).askId, body?.itemId));
}
