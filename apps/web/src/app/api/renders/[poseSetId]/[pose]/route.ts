import { requireUser } from "../../../../../server/auth";
import { NO_STORE, respond } from "../../../../../server/http";
import { getRenderForUser } from "../../../../../server/renders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poseSetId: string; pose: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { poseSetId, pose } = await params;
  const result = await getRenderForUser(user, poseSetId, pose);
  if (!result.ok) return respond(result);
  return new Response(new Uint8Array(result.body.bytes), {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": result.body.contentType },
  });
}
