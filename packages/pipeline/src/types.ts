// Types-only module: safe to import from client components (no runtime imports at all).
import type { FailureCode, JobStatus, PoseStatus } from "@trailroom/db";

export type { FailureCode, JobStatus, PoseStatus };

export type Verdict = "pass" | "fail";

/** Why an image failed QA. The first five are structural checks; the rest are render outcomes. */
export type ReasonCode =
  | "undecodable"
  | "too_small"
  | "wrong_aspect"
  | "blank"
  | "copy_of_input"
  | "blocked"
  | "no_image"
  | "model_error"
  | "capacity";

export type RenderOutcome =
  "rendered" | "blocked" | "no_image" | "model_error" | "capacity";

export type NextStep = "publish" | "retry" | "fail_pose";

export type SetStatus = "complete" | "complete_partial" | "failed";

export interface PoseAttemptInput {
  jobId: string;
  pose: string;
  attempt: number;
}

export interface PrepareInput {
  jobId: string;
}
export interface PrepareOutput {
  poses: string[];
  maxAttempts: number;
}

export interface RenderPoseOutput {
  outcome: RenderOutcome;
}

export interface QaPoseOutput {
  verdict: Verdict;
  reasons: ReasonCode[];
  next: NextStep;
}

export interface PublishPoseOutput {
  published: true;
}

export interface FailPoseInput {
  jobId: string;
  pose: string;
}
export interface FailPoseOutput {
  status: PoseStatus;
}

export interface FinalizeSetOutput {
  status: JobStatus;
  published: string[];
}

export interface FailJobInput {
  jobId: string;
  code: FailureCode;
  detail?: string;
}
export interface FailJobOutput {
  status: JobStatus;
}
