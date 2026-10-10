import { requireUser } from "../../../../../../server/auth";
import { NO_STORE, respond } from "../../../../../../server/http";
import { getInboxImage } from "../../../../../../server/inbox";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ askId: string; itemId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { askId, itemId } = await params;
  const r = await getInboxImage(user, askId, itemId);
  if (!r.ok) return respond(r);
  return new Response(new Uint8Array(r.body.bytes), {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": r.body.contentType },
  });
}
