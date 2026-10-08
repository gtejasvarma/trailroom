import { ERRORS, type ErrorCode } from "./errors";

export type Ok<T> = { ok: true; status: number; body: T };
export type Err = {
  ok: false;
  status: number;
  body: { error: ErrorCode; message: string } & Record<string, unknown>;
};
export type Result<T> = Ok<T> | Err;

export const ok = <T>(body: T, status = 200): Ok<T> => ({
  ok: true,
  status,
  body,
});

export function err(code: ErrorCode, extra: Record<string, unknown> = {}): Err {
  const e = ERRORS[code];
  return {
    ok: false,
    status: e.status,
    body: { error: code, message: e.message, ...extra },
  };
}

/** Nothing here is cacheable: responses are per-user. */
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function respond(result: Result<unknown>): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  });
}

export function errorResponse(
  code: ErrorCode,
  extra?: Record<string, unknown>,
) {
  return respond(err(code, extra));
}

/** Parses a JSON body; undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
