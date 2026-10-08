// jobInternals/{jobId}: free-text failure detail (model refusal text, error messages, service
// account names). Server-only: the rules catch-all denies every client read, unlike jobs/{id},
// which its owner can read through the Firestore listener.
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";

export interface JobInternalsDoc {
  failureDetail?: string;
  /** Keyed `<pose>_<attempt>`. */
  attempts?: Record<string, string>;
}

const col = () => firestore().collection("jobInternals");

export async function setJobInternal(
  jobId: string,
  patch: {
    failureDetail?: string;
    attemptDetail?: { pose: string; attempt: number; detail: string };
  },
): Promise<void> {
  const data: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.failureDetail !== undefined)
    data.failureDetail = patch.failureDetail;
  if (patch.attemptDetail) {
    const { pose, attempt, detail } = patch.attemptDetail;
    data.attempts = { [`${assertSegment("pose", pose)}_${attempt}`]: detail };
  }
  await col().doc(assertSegment("jobId", jobId)).set(data, { merge: true });
}

export async function getJobInternal(
  jobId: string,
): Promise<JobInternalsDoc | null> {
  const snap = await col().doc(assertSegment("jobId", jobId)).get();
  return snap.exists ? (snap.data() as JobInternalsDoc) : null;
}

export async function deleteJobInternal(jobId: string): Promise<void> {
  await col().doc(assertSegment("jobId", jobId)).delete();
}
