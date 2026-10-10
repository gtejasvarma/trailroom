import { mergeAccount } from "../../../../server/account";
import { requireUser } from "../../../../server/auth";
import { readJson, respond } from "../../../../server/http";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await mergeAccount(user, await readJson(request)));
}
