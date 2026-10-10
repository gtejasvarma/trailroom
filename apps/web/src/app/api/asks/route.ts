import { requireUser } from "../../../server/auth";
import { createAsk, getAsks } from "../../../server/asks";
import { readJson, respond } from "../../../server/http";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await getAsks(user));
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await createAsk(user, request, await readJson(request)));
}
