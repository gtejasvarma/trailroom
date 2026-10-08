import { requireWorkflowsCaller } from "../../../../server/oidc";

// Deploy smoke check: 200 only for a valid Workflows service account token; 401 otherwise.
async function ping(request: Request) {
  // Same answer the Phase 0 placeholder gave an anonymous caller (the gate e2e test checks it).
  if (!request.headers.get("authorization")) {
    return Response.json({ error: "no credentials" }, { status: 401 });
  }
  const caller = await requireWorkflowsCaller(request);
  if (caller instanceof Response) return caller;
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const GET = ping;
export const POST = ping;
