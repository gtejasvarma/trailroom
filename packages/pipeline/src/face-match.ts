// The client for the face-match service (services/face-match): "is the face in this render the
// face in the person's photo?". Plain fetch, a timeout and one retry; no new dependency. In
// production the service is private (Cloud Run IAM), so the app injects a function that returns a
// Google-signed ID token for the service URL; against a local URL it returns nothing and no
// Authorization header is sent. The person's photo and the render travel to the service only for
// the length of the request; the service keeps neither.

export interface FaceMatchResult {
  /** A face was found in the person's own photo. */
  personFace: boolean;
  /** A face was found in the render. */
  renderFace: boolean;
  /** dlib face distance, when both faces were found. */
  distance: number | null;
  /**
   * 0 to 1, from the service's logistic mapping of the distance. A convenience mapping, not a
   * measured probability; null when either face was missing.
   */
  probability: number | null;
}

export type FaceMatchFn = (
  person: Buffer,
  render: Buffer,
) => Promise<FaceMatchResult>;

/** Returns an ID token whose audience is `audience`, or undefined to send no token. */
export type FaceMatchTokenFn = (
  audience: string,
) => Promise<string | undefined>;

export const FACE_MATCH_TIMEOUT_MS = 20_000;
export const FACE_MATCH_RETRIES = 1;
/**
 * The owner's rule: a render whose match probability is below 50% is not shown. (First set at
 * 10%; raised on 2026-10-12 after two different-person pairs scored 0.108 and 0.482.) 50% is
 * dlib's own same-person line, a face distance of 0.6.
 */
export const DEFAULT_FACE_MATCH_MIN = 0.5;

export interface FaceMatchConfig {
  /** The service's base URL, no trailing slash. */
  url: string;
  /** Matches below this probability fail. */
  min: number;
}

/**
 * FACE_MATCH_URL absent or empty: null, and the identity check stays `skipped` as before. A
 * FACE_MATCH_MIN that is not a number from 0 to 1 falls back to the default rather than turning
 * the check into "fail everything" or "pass everything".
 */
export function faceMatchConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): FaceMatchConfig | null {
  const url = env.FACE_MATCH_URL?.trim().replace(/\/+$/, "");
  if (!url) return null;
  const raw = env.FACE_MATCH_MIN?.trim();
  const n = raw ? Number(raw) : NaN;
  const min =
    Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_FACE_MATCH_MIN;
  return { url, min };
}

/** A non-retryable failure (a 4xx answer, or a body that is not what we expect). */
class FaceMatchRejected extends Error {}

export function createFaceMatchClient(opts: {
  url: string;
  getToken?: FaceMatchTokenFn;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}): FaceMatchFn {
  const url = opts.url.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? FACE_MATCH_TIMEOUT_MS;
  const retries = opts.retries ?? FACE_MATCH_RETRIES;
  const retryDelayMs = opts.retryDelayMs ?? 500;

  const once = async (
    person: Buffer,
    render: Buffer,
  ): Promise<FaceMatchResult> => {
    const form = new FormData();
    const type = "application/octet-stream";
    form.append(
      "person",
      new Blob([new Uint8Array(person)], { type }),
      "person",
    );
    form.append(
      "render",
      new Blob([new Uint8Array(render)], { type }),
      "render",
    );
    const headers: Record<string, string> = {};
    const token = await opts.getToken?.(url);
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await doFetch(`${url}/match`, {
      method: "POST",
      body: form,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 500) throw new Error(`face-match answered ${res.status}`);
    if (!res.ok) {
      throw new FaceMatchRejected(`face-match answered ${res.status}`);
    }
    const j = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !j ||
      typeof j.person_face_found !== "boolean" ||
      typeof j.render_face_found !== "boolean"
    ) {
      throw new FaceMatchRejected(
        "face-match answered with an unexpected body",
      );
    }
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const result: FaceMatchResult = {
      personFace: j.person_face_found,
      renderFace: j.render_face_found,
      distance: num(j.distance),
      probability: num(j.probability),
    };
    if (
      result.personFace &&
      result.renderFace &&
      (result.probability === null || result.probability > 1)
    ) {
      throw new FaceMatchRejected("face-match answered without a probability");
    }
    return result;
  };

  return async (person, render) => {
    let last: unknown;
    for (let i = 0; i <= retries; i++) {
      try {
        return await once(person, render);
      } catch (e) {
        last = e;
        // A 4xx or an unreadable body will not change on a second try; a network error, a
        // timeout or a 5xx (a cold or overloaded service) might.
        if (e instanceof FaceMatchRejected) break;
        if (i < retries && retryDelayMs > 0) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
    }
    throw last;
  };
}
