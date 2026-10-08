// The one place that decides how a job is run: in-process (local dev and tests) or by Cloud
// Workflows (deployed). Set ORCHESTRATOR=inline|workflows; the default is workflows.
import { logError } from "@trailroom/render";
import { runInline } from "@trailroom/pipeline";
import { startWorkflowExecution } from "./workflows";

const inflight = new Set<Promise<unknown>>();

/** Tests only: resolves when every inline run started so far has finished. */
export async function awaitInlineRuns(): Promise<void> {
  while (inflight.size > 0) await Promise.allSettled([...inflight]);
}

export async function startRender(jobId: string): Promise<void> {
  const mode = process.env.ORCHESTRATOR ?? "workflows";
  if (mode === "inline") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ORCHESTRATOR=inline is for local dev and tests and is refused in production",
      );
    }
    // Not awaited: the request returns while the job runs.
    const run = runInline(jobId)
      .catch((e) => logError("inline run failed", e))
      .finally(() => inflight.delete(run));
    inflight.add(run);
    return;
  }
  if (mode === "workflows") {
    await startWorkflowExecution(jobId);
    return;
  }
  throw new Error(`ORCHESTRATOR "${mode}" must be "inline" or "workflows"`);
}
