import { requireUser } from "../../../server/auth";
import { readJson, respond } from "../../../server/http";
import { listOutfits, startOutfit } from "../../../server/outfits";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await startOutfit(user, await readJson(request)));
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(await listOutfits(user));
}
