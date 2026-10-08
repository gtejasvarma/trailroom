// The inline orchestrator: drives the nodes in graph order for local dev and tests. Deployed jobs
// are driven by Cloud Workflows (Phase 5); both read the shape of the graph from GRAPH.
import {
  failJob,
  failPose,
  finalizeSet,
  prepare,
  publishPose,
  qaPose,
  renderPose,
} from "./nodes";
import { MAX_ATTEMPTS } from "./policy";
import type { JobStatus, NextStep } from "./types";

/**
 * The graph as data, so the workflow YAML and this driver can be checked against one source.
 *  - `sequence`: top-level order. "poses" is the parallel branch over the job's poses.
 *  - `branch`: per pose, run `steps` in order; then route on qaPose's `next` via `routes`
 *    ("retry" re-enters the branch at `retryFrom` with attempt + 1, at most maxAttempts).
 *  - A renderPose outcome of "capacity" ends that branch without QA or retry.
 *  - After the join: any capacity branch -> failJob(capacity), otherwise finalizeSet.
 *  - Any thrown error -> failJob(internal).
 */
export const GRAPH = {
  sequence: ["prepare", "poses", "finalizeSet"],
  branch: {
    steps: ["renderPose", "qaPose"],
    routes: {
      publish: "publishPose",
      retry: "renderPose",
      fail_pose: "failPose",
    },
    retryFrom: "renderPose",
    maxAttempts: MAX_ATTEMPTS,
    capacityOutcome: "capacity",
  },
  onCapacity: { node: "failJob", code: "capacity" },
  onError: { node: "failJob", code: "internal" },
} as const;

export interface InlineResult {
  status: JobStatus;
  published: string[];
  failureCode?: string;
}

/** Runs one pose to its end; returns "capacity" if the spend ceiling stopped it. */
async function runBranch(
  jobId: string,
  pose: string,
): Promise<"done" | "capacity"> {
  for (let attempt = 1; attempt <= GRAPH.branch.maxAttempts; attempt++) {
    const { outcome } = await renderPose({ jobId, pose, attempt });
    if (outcome === GRAPH.branch.capacityOutcome) return "capacity";
    const qa = await qaPose({ jobId, pose, attempt });
    const next: NextStep = qa.next;
    if (next === "publish") {
      await publishPose({ jobId, pose, attempt });
      return "done";
    }
    if (next === "fail_pose") {
      await failPose({ jobId, pose });
      return "done";
    }
    // "retry": loop to the next attempt.
  }
  await failPose({ jobId, pose });
  return "done";
}

export async function runInline(jobId: string): Promise<InlineResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "runInline is for local dev and tests; deployed jobs run in Cloud Workflows",
    );
  }
  try {
    const { poses } = await prepare({ jobId });
    const settled = await Promise.allSettled(
      poses.map((pose) => runBranch(jobId, pose)),
    );
    const errored = settled.find((s) => s.status === "rejected");
    if (errored) throw (errored as PromiseRejectedResult).reason;
    if (
      settled.some((s) => s.status === "fulfilled" && s.value === "capacity")
    ) {
      const r = await failJob({ jobId, code: "capacity" });
      return { status: r.status, published: [], failureCode: "capacity" };
    }
    const r = await finalizeSet({ jobId });
    return { status: r.status, published: r.published };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const r = await failJob({ jobId, code: "internal", detail });
    return { status: r.status, published: [], failureCode: "internal" };
  }
}
