import { requireUser } from "../../../../../server/auth";
import { readJson, respond } from "../../../../../server/http";
import { answerArrived } from "../../../../../server/purchases";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return respond(
    await answerArrived(user, (await params).itemId, await readJson(request)),
  );
}
