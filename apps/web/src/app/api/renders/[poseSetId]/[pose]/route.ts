import { requireUser } from "../../../../../server/auth";
import { errorResponse, NO_STORE, respond } from "../../../../../server/http";
import { getRenderForUser, parseSize } from "../../../../../server/renders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poseSetId: string; pose: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { poseSetId, pose } = await params;
  const size = parseSize(new URL(request.url).searchParams.get("size"));
  if (!size) return errorResponse("invalid_request");
  const result = await getRenderForUser(user, poseSetId, pose, size);
  if (!result.ok) return respond(result);
  return new Response(new Uint8Array(result.body.bytes), {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": result.body.contentType },
  });
}
