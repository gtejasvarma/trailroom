// "on you" alone is allowed ("See it on you"); it is only a fit sentence when a placement or fit
// verb leads to it ("Sits at the hip on you"). Hard rule (CLAUDE.md): no fit or size language anywhere in user-facing copy. Describe the
// object only. Phase 4 reuses this to scan UI strings.
export const BANNED_FIT_PHRASES =
  /\b(runs?\s+(small|large|big|short|long|tight)|true[-\s]to[-\s]size|fits?\s|fitting|fit\s+(you|perfectly|well)|flatter\w*|slimm?\w*|slender|figure|hem(line)?s?\b|mid-?calf|hits?\s+(at|mid)|sizes?\b|sizing|oversized|tailored\s+to\s+you|looks?\s+great\s+on|snug|loose|baggy|roomy|relaxed\s+fit|waist|flowy|curvy|figure-hugging|tailored\s+fit)\b|\b(?:hits?|sits?|falls?|lands?|pools?|breaks?|runs?|crops?|skims?|gathers?|drapes?|hangs?|clings?|needs?)\b[^.!?\n]*\bon\s+you\b/i;

export function findFitLanguage(text: string): string | null {
  return BANNED_FIT_PHRASES.exec(text)?.[0] ?? null;
}
