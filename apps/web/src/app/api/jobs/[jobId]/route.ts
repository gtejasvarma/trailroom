import { requireUser } from "../../../../server/auth";
import { respond } from "../../../../server/http";
import { getJobForUser } from "../../../../server/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const { jobId } = await params;
  return respond(await getJobForUser(user, jobId));
}
