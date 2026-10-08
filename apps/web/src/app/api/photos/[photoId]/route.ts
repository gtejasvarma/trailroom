import { requireUser } from "../../../../server/auth";
import { respond } from "../../../../server/http";
import { removePhoto } from "../../../../server/photo-library";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { photoId } = await params;
  return respond(await removePhoto(user, photoId));
}
