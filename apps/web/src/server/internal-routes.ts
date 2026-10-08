// The single list of graph node endpoints: node name -> path -> strict body validator. The route
// files, their shared handler and the workflow contract test all read this, so there is one list.
// Node names are the ones in GRAPH (packages/pipeline/src/inline.ts).
import { MAX_ATTEMPTS } from "@trailroom/pipeline/policy";

export const PIPELINE_BASE = "/api/internal/pipeline";

export type NodeName =
  | "prepare"
  | "renderPose"
  | "qaPose"
  | "publishPose"
  | "failPose"
  | "finalizeSet"
  | "failJob";

export type NodeInput =
  | { jobId: string }
  | { jobId: string; pose: string; attempt: number }
  | { jobId: string; pose: string }
  | { jobId: string; code: "capacity" | "internal"; detail?: string };

export interface InternalRoute {
  node: NodeName;
  /** URL segment under PIPELINE_BASE. */
  segment: string;
  path: string;
  /** Body keys the endpoint requires, and the ones it accepts but does not require. */
  keys: readonly string[];
  optionalKeys: readonly string[];
  /** Strict parse: exact key set, exact types. Returns null for any violation. */
  parse(body: unknown): NodeInput | null;
}

const JOB_ID = /^[A-Za-z0-9_-]{1,100}$/;
const POSE = /^[a-z][a-z0-9_-]{0,31}$/;
const MAX_DETAIL = 500;

function exactKeys(
  body: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const rec = body as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (!required.every((k) => keys.includes(k))) return null;
  if (!keys.every((k) => required.includes(k) || optional.includes(k))) {
    return null;
  }
  return rec;
}

const jobId = (v: unknown): v is string =>
  typeof v === "string" && JOB_ID.test(v);
const pose = (v: unknown): v is string => typeof v === "string" && POSE.test(v);
const attempt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_ATTEMPTS;

function define(
  node: NodeName,
  segment: string,
  keys: readonly string[],
  optionalKeys: readonly string[],
  check: (rec: Record<string, unknown>) => NodeInput | null,
): InternalRoute {
  return {
    node,
    segment,
    path: `${PIPELINE_BASE}/${segment}`,
    keys,
    optionalKeys,
    parse: (body) => {
      const rec = exactKeys(body, keys, optionalKeys);
      return rec ? check(rec) : null;
    },
  };
}

const poseAttempt = (r: Record<string, unknown>) =>
  jobId(r.jobId) && pose(r.pose) && attempt(r.attempt)
    ? { jobId: r.jobId, pose: r.pose, attempt: r.attempt }
    : null;

export const INTERNAL_ROUTES: readonly InternalRoute[] = [
  define("prepare", "prepare", ["jobId"], [], (r) =>
    jobId(r.jobId) ? { jobId: r.jobId } : null,
  ),
  define(
    "renderPose",
    "render-pose",
    ["jobId", "pose", "attempt"],
    [],
    poseAttempt,
  ),
  define("qaPose", "qa-pose", ["jobId", "pose", "attempt"], [], poseAttempt),
  define(
    "publishPose",
    "publish-pose",
    ["jobId", "pose", "attempt"],
    [],
    poseAttempt,
  ),
  define("failPose", "fail-pose", ["jobId", "pose"], [], (r) =>
    jobId(r.jobId) && pose(r.pose) ? { jobId: r.jobId, pose: r.pose } : null,
  ),
  define("finalizeSet", "finalize-set", ["jobId"], [], (r) =>
    jobId(r.jobId) ? { jobId: r.jobId } : null,
  ),
  define("failJob", "fail-job", ["jobId", "code"], ["detail"], (r) => {
    if (!jobId(r.jobId)) return null;
    if (r.code !== "capacity" && r.code !== "internal") return null;
    if (r.detail !== undefined && typeof r.detail !== "string") return null;
    // Free text from an error message: clamp rather than reject, so a long one cannot stop the
    // job from being failed.
    const detail = r.detail?.slice(0, MAX_DETAIL);
    return detail
      ? { jobId: r.jobId, code: r.code, detail }
      : { jobId: r.jobId, code: r.code };
  }),
];

export function routeFor(node: NodeName): InternalRoute {
  const r = INTERNAL_ROUTES.find((x) => x.node === node);
  if (!r) throw new Error(`no internal route for ${node}`);
  return r;
}
