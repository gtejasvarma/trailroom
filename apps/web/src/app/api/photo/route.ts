import { deleteMyData } from "../../../server/account";
import { requireUser } from "../../../server/auth";
import { respond } from "../../../server/http";
import { uploadPhoto } from "../../../server/photo";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await uploadPhoto(user, request));
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await deleteMyData(user));
}
