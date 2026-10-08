import { requireUser } from "../../../server/auth";
import { acceptConsent } from "../../../server/consent";
import { readJson, respond } from "../../../server/http";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await acceptConsent(user, await readJson(request)));
}
