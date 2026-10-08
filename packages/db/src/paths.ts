// Pure storage path builders. Every segment is validated so a crafted id can never escape its
// prefix (no "/", no "..", no empty, no backslash or control chars).

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._@=-]*$/;

export function assertSegment(name: string, value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 200 ||
    value === "." ||
    value === ".." ||
    value.includes("..") ||
    !SEGMENT.test(value)
  ) {
    throw new Error(`invalid path segment for ${name}`);
  }
  return value;
}

export function photoPath(uid: string, photoId: string): string {
  return `photos/${assertSegment("uid", uid)}/${assertSegment("photoId", photoId)}.jpg`;
}

export function photoPrefix(uid: string): string {
  return `photos/${assertSegment("uid", uid)}/`;
}

export function extFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/webp") return "webp";
  throw new Error(`unsupported content type ${contentType}`);
}

export function stagingPath(
  jobId: string,
  pose: string,
  attempt: number,
  ext = "png",
): string {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error("invalid attempt");
  }
  assertSegment("ext", ext);
  return `staging/${assertSegment("jobId", jobId)}/${assertSegment("pose", pose)}-${attempt}.${ext}`;
}

export function stagingPrefix(jobId: string): string {
  return `staging/${assertSegment("jobId", jobId)}/`;
}

export function renderPath(
  uid: string,
  poseSetId: string,
  pose: string,
): string {
  return `renders/${assertSegment("uid", uid)}/${assertSegment("poseSetId", poseSetId)}/${assertSegment("pose", pose)}.jpg`;
}

export function renderPrefix(uid: string, poseSetId?: string): string {
  const base = `renders/${assertSegment("uid", uid)}/`;
  return poseSetId ? `${base}${assertSegment("poseSetId", poseSetId)}/` : base;
}

/** Garment images shared by every user: `catalog/<file>`. `file` is a single validated segment. */
export function catalogPath(file: string): string {
  return `catalog/${assertSegment("file", file)}`;
}

export function catalogPrefix(): string {
  return "catalog/";
}
