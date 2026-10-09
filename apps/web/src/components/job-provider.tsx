"use client";
// One place that holds the person's running job, so every screen sees the same state: the shell's
// chip, the ready bar and toast, and (through the same live document) the queue screen. It finds
// a job that is already rendering from /api/me, so it survives navigation and a reload. The
// state comes from the live job document (Firestore listener, polling fallback), never a timer.
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished, isRunning, passedPoses, type JobView } from "../lib/job";
import { useJob } from "../lib/use-job";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

interface JobState {
  /** The tracked job, if any: running, or finished and not yet opened. */
  job: JobView | null;
  /** True once a job that ran while the person was elsewhere has finished and not been opened. */
  readyJob: JobView | null;
  /** Start tracking a job (call right after starting a try-on). */
  track: (jobId: string) => void;
  dismissReady: () => void;
}

const JobContext = createContext<JobState>({
  job: null,
  readyJob: null,
  track: () => {},
  dismissReady: () => {},
});
export const useActiveJob = () => useContext(JobContext);

export function JobProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const say = useToast();
  const { activeJobId, refresh } = useMe();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const { job } = useJob(trackedId);
  const lastStatus = useRef<{ id: string; status: string } | null>(null);
  const onPath = useRef(pathname);
  onPath.current = pathname;

  // A job already rendering on the server (a reload, another tab) is picked up.
  useEffect(() => {
    if (activeJobId && !trackedId) setTrackedId(activeJobId);
  }, [activeJobId, trackedId]);

  // Opening a try-on's own screen tracks that job (a job just started lands here), unless a
  // different one is still running: its chip must not be lost.
  useEffect(() => {
    const m = /^\/try-on\/([^/]+)$/.exec(pathname);
    if (!m || m[1] === trackedId) return;
    if (job && isRunning(job.status)) return;
    setTrackedId(m[1]!);
  }, [pathname, trackedId, job]);

  // Running -> finished while the person is elsewhere: the ready bar and a toast.
  useEffect(() => {
    if (!job) return;
    const prev = lastStatus.current;
    lastStatus.current = { id: job.jobId, status: job.status };
    const wasRunning =
      prev?.id === job.jobId && isRunning(prev.status as never);
    if (!wasRunning || isRunning(job.status)) return;
    void refresh();
    const here = onPath.current === `/try-on/${job.jobId}`;
    if (here) return;
    const name = getItem(job.itemId)?.name ?? "";
    if (isFinished(job.status)) {
      setReadyId(job.jobId);
      say(copy.chip.readyToast(name, passedPoses(job).length), {
        label: copy.chip.seeIt,
        href: `/try-on/${job.jobId}`,
      });
    } else {
      say(copy.toasts.jobFailed, {
        label: copy.toasts.seeWhy,
        href: `/try-on/${job.jobId}`,
      });
    }
  }, [job, refresh, say]);

  // Opening the job's own screen retires the ready bar.
  useEffect(() => {
    if (readyId && pathname === `/try-on/${readyId}`) setReadyId(null);
  }, [pathname, readyId]);

  const track = useCallback((jobId: string) => {
    setTrackedId(jobId);
    setReadyId(null);
  }, []);
  const dismissReady = useCallback(() => setReadyId(null), []);

  const value = useMemo<JobState>(
    () => ({
      job,
      readyJob:
        job && readyId === job.jobId && isFinished(job.status) ? job : null,
      track,
      dismissReady,
    }),
    [job, readyId, track, dismissReady],
  );
  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}
