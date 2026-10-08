import { requireUser } from "../../../../../server/auth";
import { NO_STORE, respond } from "../../../../../server/http";
import { getThumb } from "../../../../../server/photo-library";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { photoId } = await params;
  const result = await getThumb(user, photoId);
  if (!result.ok) return respond(result);
  return new Response(new Uint8Array(result.body.bytes), {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": result.body.contentType },
  });
}
