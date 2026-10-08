import { requireUser } from "../../../../server/auth";
import { changeFollow } from "../../../../server/follows";
import { respond } from "../../../../server/http";

type Ctx = { params: Promise<{ label: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await changeFollow(user, (await params).label, true));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await changeFollow(user, (await params).label, false));
}
