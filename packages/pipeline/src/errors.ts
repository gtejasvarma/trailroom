/**
 * The job is finished (or gone), so this node must not reserve spend, render or publish. The
 * internal handler maps it to 409: Cloud Workflows does not retry 4xx, and the error handler's
 * fail-job call is a safe no-op on a terminal job.
 */
export class JobTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobTerminalError";
  }
}

/** Another call owns this attempt and has not finished within our wait; the caller should retry. */
export class RetryableNodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableNodeError";
  }
}
