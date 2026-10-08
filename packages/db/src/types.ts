import { Timestamp } from "firebase-admin/firestore";

/** Guest records live 48 hours. */
export const GUEST_TTL_MS = 48 * 60 * 60 * 1000;

/** createdAt + 48h for guests, null for signed-in users. */
export function expiryFor(isGuest: boolean, createdAt: Date): Timestamp | null {
  return isGuest
    ? Timestamp.fromMillis(createdAt.getTime() + GUEST_TTL_MS)
    : null;
}

export type JobStatus =
  "queued" | "rendering" | "complete" | "complete_partial" | "failed";
export type PoseStatus = "pending" | "rendering" | "passed" | "failed";
export type FailureCode =
  "render_failed" | "capacity" | "not_ready" | "internal";

export interface ConsentDoc {
  version: string;
  acceptedAt: Timestamp;
  ageAttested18: true;
}

export interface PhotoDoc {
  storagePath: string;
  width: number;
  height: number;
  identityVersion: number;
  isGuest: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
}

/** What the pipeline durably records per (pose, attempt); this is what makes its nodes replayable. */
export interface AttemptRecord {
  outcome?: "rendered" | "blocked" | "no_image" | "model_error" | "capacity";
  // Free-text detail is NOT stored here: the owner can read this doc. It goes to jobInternals.
  qa?: { verdict: "pass" | "fail"; reasons: string[] };
}

export interface PoseState {
  status: PoseStatus;
  attempt: number;
  reasons: string[];
  /** Keyed by attempt number as a string. Absent on jobs created before the pipeline existed. */
  attempts?: Record<string, AttemptRecord>;
}

export interface JobDoc {
  uid: string;
  itemId: string;
  identityVersion: number;
  poseSetId: string;
  status: JobStatus;
  failure: null | { code: FailureCode };
  poses: Record<string, PoseState>;
  poseOrder: string[];
  qaSkipped: string[];
  model: string;
  promptVersion: string;
  isGuest: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp | null;
}

export type PoseSetStatus =
  "rendering" | "complete" | "complete_partial" | "failed";

export interface PoseSetDoc {
  uid: string;
  itemId: string;
  identityVersion: number;
  jobId: string;
  status: PoseSetStatus;
  poses: string[];
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
}
