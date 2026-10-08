// One handler for every graph node endpoint: OIDC (Workflows service account only), strict body
// validation, job lookup, the node function, JSON out. Errors from a node are logged and answered
// with a generic 500; the body never carries internals.
import { getJob } from "@trailroom/db";
import {
  failJob,
  JobTerminalError,
  failPose,
  finalizeSet,
  prepare,
  publishPose,
  qaPose,
  renderPose,
} from "@trailroom/pipeline";
import { logError } from "@trailroom/render";
import { requireWorkflowsCaller } from "./oidc";
import { routeFor, type NodeInput, type NodeName } from "./internal-routes";

/** Cache-Control for everything under /api/internal. */
const HEADERS = { "Cache-Control": "private, no-store" } as const;
const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: HEADERS });

// Each node takes its own input shape; routeFor(node).parse produced the matching one.
const NODES: Record<NodeName, (input: any) => Promise<unknown>> = {
  prepare,
  renderPose,
  qaPose,
  publishPose,
  failPose,
  finalizeSet,
  failJob,
};

export function nodeHandler(node: NodeName) {
  const route = routeFor(node);
  return async function POST(request: Request): Promise<Response> {
    const caller = await requireWorkflowsCaller(request);
    if (caller instanceof Response) return caller;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    const input: NodeInput | null = route.parse(body);
    if (!input) return json({ error: "invalid_request" }, 400);

    try {
      const job = await getJob(input.jobId);
      if (!job) return json({ error: "not_found" }, 404);
      if ("pose" in input && !job.poseOrder.includes(input.pose)) {
        return json({ error: "invalid_request" }, 400);
      }
      return json(await NODES[node]!(input), 200);
    } catch (e) {
      // The job is finished or gone: 4xx so Workflows does not retry (its error handler's
      // fail-job call is a no-op on a terminal job).
      if (e instanceof JobTerminalError)
        return json({ error: "job_terminal" }, 409);
      logError(`internal ${route.segment} failed`, e);
      return json({ error: "internal" }, 500);
    }
  };
}
