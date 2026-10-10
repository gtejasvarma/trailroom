import { logError } from "@trailroom/render";
import { requireSchedulerCaller } from "../../../../server/oidc";
import { originOf } from "../../../../server/asks";
import { purgeExpiredGuests } from "../../../../server/purge";

export const maxDuration = 300;

// Cloud Scheduler `purge-guests`, OIDC as the Scheduler service account only.
export async function POST(request: Request) {
  const caller = await requireSchedulerCaller(request);
  if (caller instanceof Response) return caller;
  try {
    return Response.json(
      await purgeExpiredGuests(new Date(), originOf(request)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    logError("purge failed", e);
    return Response.json(
      { error: "internal" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
