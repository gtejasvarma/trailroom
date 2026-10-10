import { requireUser } from "../../../server/auth";
import { readJson, respond } from "../../../server/http";
import { createList, getLists } from "../../../server/lists";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getLists(user));
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await createList(user, await readJson(request)));
}
