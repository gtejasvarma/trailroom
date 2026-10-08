"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { apiFetch } from "./api";
import { ensureUser, getFirebaseDb } from "./firebase";
import { toJobView, type JobView } from "./job";

const POLL_MS = 1500;

/**
 * Live job state: a Firestore listener on jobs/{jobId}, with a 1.5 s poll of GET /api/jobs/[id]
 * if the listener errors. `missing` is true when the job cannot be read at all.
 */
export function useJob(jobId: string): {
  job: JobView | null;
  missing: boolean;
} {
  const [job, setJob] = useState<JobView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const body = await apiFetch<Record<string, unknown>>(
          `/api/jobs/${jobId}`,
        );
        const view = toJobView(jobId, body);
        if (!cancelled && view) setJob(view);
        if (view && ["queued", "rendering"].includes(view.status)) {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch {
        if (!cancelled) setMissing(true);
      }
    };

    ensureUser()
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          doc(getFirebaseDb(), "jobs", jobId),
          (snap) => {
            if (cancelled) return;
            if (!snap.exists()) return setMissing(true);
            const view = toJobView(jobId, snap.data());
            if (view) {
              setMissing(false);
              setJob(view);
            }
          },
          () => {
            unsubscribe?.();
            void poll();
          },
        );
      })
      .catch(() => void poll());

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return { job, missing };
}
