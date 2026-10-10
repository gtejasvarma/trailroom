import { requireUser } from "../../../../server/auth";
import { readJson, respond } from "../../../../server/http";
import { changeList, deleteList } from "../../../../server/lists";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(
    await changeList(user, (await params).id, await readJson(request)),
  );
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await deleteList(user, (await params).id));
}
