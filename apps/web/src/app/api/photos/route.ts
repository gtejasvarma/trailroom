import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";
import { listMyPhotos } from "../../../server/photo-library";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await listMyPhotos(user));
}
