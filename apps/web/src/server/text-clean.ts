// What free text a person types may not carry into a page other people read: control characters
// and the invisible formatting that can reorder or hide the text around it. U+200C and U+200D
// stay, because emoji sequences and several scripts need them.

/** Bidirectional controls, line and paragraph separators, and the byte-order mark. */
export const INVISIBLE_FORMATTING =
  /[\u{061C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{2028}\u{2029}\u{FEFF}]/gu;
/** Every control character (C0, DEL and C1). */
export const CONTROL = /\p{Cc}/gu;

/** Removes the invisible formatting above and replaces controls with `controlAs`. */
export function stripUnsafe(text: string, controlAs = ""): string {
  return text.replace(CONTROL, controlAs).replace(INVISIBLE_FORMATTING, "");
}

export const hasControl = (text: string): boolean => /\p{Cc}/u.test(text);
