// What free text a person types may not carry into a page other people read: control characters
// and the invisible formatting that can reorder or hide the text around it. U+200C and U+200D
// stay, because emoji sequences and several scripts need them.

import { CONTROL, INVISIBLE_FORMATTING } from "@trailroom/catalog";

// The character classes are shared with the catalogue checks (@trailroom/catalog).
export { CONTROL, INVISIBLE_FORMATTING };

/** Removes the invisible formatting above and replaces controls with `controlAs`. */
export function stripUnsafe(text: string, controlAs = ""): string {
  return text.replace(CONTROL, controlAs).replace(INVISIBLE_FORMATTING, "");
}

export const hasControl = (text: string): boolean => /\p{Cc}/u.test(text);
