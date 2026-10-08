// Test-only. Walks the node endpoints the way workflows/render-pose-set.yaml does, by calling the
// exported route handlers with signed Requests. Branch decisions are read from each response
// exactly as the YAML reads them (r.body.outcome, q.body.next, capacityHit after the join). Any
// non-200 answer is an error, as it is in Workflows once retries are spent; retries themselves
// are not simulated here (Workflows does them; the nodes are idempotent, see the replay test).
import { POST as prepare } from "../app/api/internal/pipeline/prepare/route";
import { POST as renderPose } from "../app/api/internal/pipeline/render-pose/route";
import { POST as qaPose } from "../app/api/internal/pipeline/qa-pose/route";
import { POST as publishPose } from "../app/api/internal/pipeline/publish-pose/route";
import { POST as failPose } from "../app/api/internal/pipeline/fail-pose/route";
import { POST as finalizeSet } from "../app/api/internal/pipeline/finalize-set/route";
import { POST as failJob } from "../app/api/internal/pipeline/fail-job/route";
import { INTERNAL_ROUTES } from "./internal-routes";
import { bearer, signToken, type TestKey, WORKFLOWS_SA } from "./oidc-testkit";

export const HANDLERS: Record<string, (r: Request) => Promise<Response>> = {
  prepare,
  "render-pose": renderPose,
  "qa-pose": qaPose,
  "publish-pose": publishPose,
  "fail-pose": failPose,
  "finalize-set": finalizeSet,
  "fail-job": failJob,
};

export function signedRequest(
  key: TestKey,
  segment: string,
  body: unknown,
  email = WORKFLOWS_SA,
): Request {
  const route = INTERNAL_ROUTES.find((r) => r.segment === segment)!;
  return new Request(`http://localhost${route.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...bearer(signToken(key, { email })),
    },
    body: JSON.stringify(body),
  });
}

export interface DriverOptions {
  /** Call every endpoint twice with the same body (a Workflows retry after a lost response). */
  twice?: boolean;
  /** Called for each (segment, body, response json) of the first call, for assertions. */
  onCall?: (segment: string, body: unknown, status: number, json: any) => void;
}

export function makeDriver(key: TestKey, opts: DriverOptions = {}) {
  async function post(segment: string, body: Record<string, unknown>) {
    const handler = HANDLERS[segment]!;
    const res = await handler(signedRequest(key, segment, body));
    const json = await res.json();
    opts.onCall?.(segment, body, res.status, json);
    if (opts.twice) {
      const again = await handler(signedRequest(key, segment, body));
      const json2 = await again.json();
      if (
        again.status !== res.status ||
        JSON.stringify(json2) !== JSON.stringify(json)
      ) {
        throw new Error(
          `replay of ${segment} differed: ${res.status} ${JSON.stringify(json)} vs ${again.status} ${JSON.stringify(json2)}`,
        );
      }
    }
    if (res.status !== 200) {
      throw new Error(`${segment} answered ${res.status}`);
    }
    return json;
  }

  // pose_branch in the YAML.
  async function poseBranch(jobId: string, pose: string): Promise<string> {
    const r1 = await post("render-pose", { jobId, pose, attempt: 1 });
    if (r1.outcome === "capacity") return "capacity";
    const q1 = await post("qa-pose", { jobId, pose, attempt: 1 });
    if (q1.next === "publish") {
      await post("publish-pose", { jobId, pose, attempt: 1 });
      return "done";
    }
    if (q1.next === "retry") {
      const r2 = await post("render-pose", { jobId, pose, attempt: 2 });
      if (r2.outcome === "capacity") return "capacity";
      const q2 = await post("qa-pose", { jobId, pose, attempt: 2 });
      if (q2.next === "publish") {
        await post("publish-pose", { jobId, pose, attempt: 2 });
        return "done";
      }
      if (q2.next !== "fail_pose") throw new Error("unexpected next after 2");
    } else if (q1.next !== "fail_pose") {
      throw new Error("unexpected next after 1");
    }
    await post("fail-pose", { jobId, pose });
    return "done";
  }

  /** main in the YAML. Returns the final status; rethrows after fail-job(internal). */
  return async function run(jobId: string): Promise<string> {
    let capacityHit = false;
    try {
      const prepared = await post("prepare", { jobId });
      const settled = await Promise.allSettled(
        (prepared.poses as string[]).map(async (pose) => {
          if ((await poseBranch(jobId, pose)) === "capacity") {
            capacityHit = true;
          }
        }),
      );
      const failed = settled.find((s) => s.status === "rejected");
      if (failed) throw (failed as PromiseRejectedResult).reason;
      if (capacityHit) {
        return (await post("fail-job", { jobId, code: "capacity" })).status;
      }
      return (await post("finalize-set", { jobId })).status;
    } catch (e) {
      const detail = e instanceof Error ? e.message : "workflow error";
      await post("fail-job", { jobId, code: "internal", detail }).catch(
        () => undefined,
      );
      throw e;
    }
  };
}
