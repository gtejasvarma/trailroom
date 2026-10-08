import { requireUser } from "../../../server/auth";
import { readJson, respond } from "../../../server/http";
import { startTryOn } from "../../../server/tryon";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await startTryOn(user, await readJson(request)));
}
