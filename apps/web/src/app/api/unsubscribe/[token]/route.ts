import { logError } from "@trailroom/render";
import {
  PUBLIC_UNSUB_HEADERS,
  unsubscribe,
  unsubscribeLimited,
} from "../../../../server/unsubscribe";

// POST /api/unsubscribe/<token>. Public (see lib/gate-paths.ts). The answer never depends on
// whether the token is real: 200 and the same body, unless this client is over its limit (429,
// which depends only on the client).
type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Ctx) {
  if (unsubscribeLimited(request.headers)) {
    return Response.json(
      { error: "too_many_attempts" },
      { status: 429, headers: PUBLIC_UNSUB_HEADERS },
    );
  }
  try {
    await unsubscribe((await params).token);
  } catch (e) {
    logError("unsubscribe failed", e);
    return Response.json(
      { error: "internal" },
      { status: 500, headers: PUBLIC_UNSUB_HEADERS },
    );
  }
  return Response.json(
    { done: true },
    { status: 200, headers: PUBLIC_UNSUB_HEADERS },
  );
}
