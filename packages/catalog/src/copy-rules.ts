// Hard rule (CLAUDE.md): no fit or size language anywhere in user-facing copy. Describe the
// object only. Phase 4 reuses this to scan UI strings.
export const BANNED_FIT_PHRASES =
  /\b(runs?\s+(small|large|big|short|long|tight)|true[-\s]to[-\s]size|fits?\s|fitting|fit\s+(you|perfectly|well)|flatter\w*|slimm?\w*|slender|figure|hem(line)?s?\b|mid-?calf|hits?\s+(at|mid)|sizes?\b|sizing|oversized|tailored\s+to\s+you|looks?\s+great\s+on|on\s+you|snug|loose|baggy|roomy|relaxed\s+fit|waist|flowy|curvy|figure-hugging|tailored\s+fit)\b/i;

export function findFitLanguage(text: string): string | null {
  return BANNED_FIT_PHRASES.exec(text)?.[0] ?? null;
}
