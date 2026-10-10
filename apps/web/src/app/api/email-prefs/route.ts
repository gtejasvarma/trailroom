import { requireUser } from "../../../server/auth";
import { readEmailPrefs, writeEmailPrefs } from "../../../server/email/prefs";
import { readJson, respond } from "../../../server/http";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await readEmailPrefs(user));
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await writeEmailPrefs(user, await readJson(request)));
}
