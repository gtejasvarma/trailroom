import { requireUser } from "../../../../server/auth";
import { respond } from "../../../../server/http";
import { removeMyTryOn } from "../../../../server/try-ons";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ poseSetId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await removeMyTryOn(user, (await params).poseSetId));
}
