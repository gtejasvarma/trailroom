// One logging helper for caught errors: a context string, the error's code, and a message with
// storage/Firestore path ids redacted, so logs do not carry user ids or job ids.

const PATTERNS: [RegExp, string][] = [
  [/(consents\/)[^\s/"',)]+/g, "$1…"],
  [/(photos\/)[^\s"',)]+/g, "$1…"],
  [/(renders\/)[^\s"',)]+/g, "$1…"],
  [/(staging\/)[^\s"',)]+/g, "$1…"],
  [/(jobInternals\/)[^\s/"',)]+/g, "$1…"],
  [/(jobs\/)[^\s/"',)]+/g, "$1…"],
  [/(poseSets\/)[^\s/"',)]+/g, "$1…"],
  [/(usage\/)[^\s/"',)]+/g, "$1…"],
];

/** Replaces the id segment after each known collection/prefix with an ellipsis. */
export function redactPaths(message: string): string {
  let out = message;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** The text that gets logged for an error: its code (if any) and a redacted message. */
export function describeError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return `code=${code === undefined ? "none" : String(code)} ${redactPaths(msg).slice(0, 300)}`;
}

export function logError(context: string, err: unknown): void {
  console.error(`${context}: ${describeError(err)}`);
}
