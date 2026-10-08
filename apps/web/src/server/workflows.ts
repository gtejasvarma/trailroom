// Starts the deployed Cloud Workflow `render-pose-set` for a job. The argument is the job id and
// nothing else; the workflow reads its own base URL from a workflow environment variable.
import { ExecutionsClient } from "@google-cloud/workflows";
import { projectId } from "@trailroom/db";

type Env = Record<string, string | undefined>;

export interface ExecutionsLike {
  createExecution(request: {
    parent: string;
    execution: { argument: string };
  }): Promise<unknown>;
}

let shared: ExecutionsClient | undefined;
function defaultClient(): ExecutionsLike {
  return (shared ??= new ExecutionsClient()) as unknown as ExecutionsLike;
}

export function workflowParent(env: Env = process.env): string {
  // Same resolution as the data layer: App Hosting provides the project in FIREBASE_CONFIG.
  const project = projectId(env);
  const location = env.WORKFLOW_LOCATION || "us-central1";
  const name = env.WORKFLOW_NAME || "render-pose-set";
  return `projects/${project}/locations/${location}/workflows/${name}`;
}

export async function startWorkflowExecution(
  jobId: string,
  client?: ExecutionsLike,
  env: Env = process.env,
): Promise<void> {
  const parent = workflowParent(env);
  await (client ?? defaultClient()).createExecution({
    parent,
    execution: { argument: JSON.stringify({ jobId }) },
  });
}
