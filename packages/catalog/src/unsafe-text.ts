// The character classes free text may not carry into a page other people read, or into an email
// subject: control characters (which include line breaks and tabs) and the invisible formatting
// that can reorder or hide the text around it. U+200C and U+200D stay, because emoji sequences
// and several scripts need them. Lives here, with no imports, so the catalogue checks and the
// app's text cleaning share one definition without a package depending on the app.

/** Bidirectional controls, line and paragraph separators, and the byte-order mark. */
export const INVISIBLE_FORMATTING =
  /[\u{061C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{2028}\u{2029}\u{FEFF}]/gu;
/** Every control character (C0, DEL and C1). */
export const CONTROL = /\p{Cc}/gu;

/** True when the text holds a control character (line breaks included) or invisible formatting. */
export const hasUnsafeText = (text: string): boolean =>
  /\p{Cc}/u.test(text) ||
  /[\u{061C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{2028}\u{2029}\u{FEFF}]/u.test(
    text,
  );
