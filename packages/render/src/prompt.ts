// The try-on prompt. Text is Tejas's (2026-09-27), kept verbatim for the Front pose. Front is the
// edit of the person's own photo, so "front" means "as photographed", not a re-posed front view.
// Other poses change exactly four sentences, marked POSE-SWAP below, because an edit that
// preserves "pose", "camera angle, and framing" can't also produce a new pose.
// Decided 2026-09-30: Front stays "as photographed" (waist-up or high-angle photos keep that
// framing), and the hem clause stays even though most garment images are flat lays with no body
// to measure against. How the model resolves that is something to observe, not prompt away.
// Bump PROMPT_VERSION on any edit so runs stay comparable.
export const PROMPT_VERSION = "edit-v1";

export type Category = "top" | "bottom" | "dress" | "outerwear";
export const CATEGORIES: readonly Category[] = [
  "top",
  "bottom",
  "dress",
  "outerwear",
];

export const POSES = {
  front: null, // the person's own pose in their photo
  // Direction locked so every set turns the same way; face toward camera keeps identity visible.
  "three-quarter":
    "full body, standing, body turned about 45 degrees so their left shoulder is closer to " +
    "the camera, face turned towards the camera",
  walking: "full body, mid-stride, walking towards the camera",
  seated:
    "full body, seated on a plain stool, facing the camera, both feet on the floor",
} as const;
export type Pose = keyof typeof POSES;

/** What the person is wearing in their photo, by slot. From manifest.json. */
export interface Wearing {
  top: string;
  bottom: string | null; // null when the photo doesn't show it
  outer: string | null;
}

/** The replacement clause: which of the person's clothes the garment takes the place of. */
function swapClause(
  category: Category,
  wearing: Wearing,
  target: string,
): string {
  switch (category) {
    case "top":
      return `replacing their ${wearing.top} with the ${target}`;
    case "bottom":
      return `replacing their ${wearing.bottom ?? "trousers"} with the ${target}`;
    case "dress":
      return (
        `replacing their ${wearing.top}` +
        (wearing.bottom ? ` and ${wearing.bottom}` : "") +
        ` with the ${target}`
      );
    case "outerwear":
      // Nothing to replace unless they already wear an outer layer: then it's an addition.
      return wearing.outer
        ? `replacing their ${wearing.outer} with the ${target}`
        : `adding the ${target} as an outer layer over their ${wearing.top}`;
  }
}

export function buildPrompt(opts: {
  pose: Pose;
  category: Category;
  wearing: Wearing;
  target: string;
}): string {
  const reposed = POSES[opts.pose];
  const swap = swapClause(opts.category, opts.wearing, opts.target);

  // POSE-SWAP 1: edit-in-place vs. re-pose.
  const editLine = reposed
    ? `Show the same person, in the same setting, in a new pose: ${reposed}.`
    : "This is an edit\nof Image 2, not a new photograph: change only the clothing in that region.";
  // POSE-SWAP 2: "existing ... pose" only holds for the unposed edit.
  const drapeOver = reposed
    ? "the person's existing body shape and the new pose"
    : "the person's existing body shape and pose";
  // POSE-SWAP 3: don't ask to preserve pose, hands, camera angle or framing when re-posing.
  const preserve = reposed
    ? "face and facial features, expression, skin\ntone, hair, body shape and proportions, " +
      "all\nclothing and accessories not being replaced, and the background."
    : "face and facial features, expression, skin\ntone, hair, body shape and proportions, " +
      "pose and hand positions, all\nclothing and accessories not being replaced, the " +
      "background, camera angle, and\nframing.";
  // POSE-SWAP 4: framing can't match a photo with a different pose.
  const output = reposed
    ? "Output one photorealistic image with the same aspect ratio as Image 2."
    : "Output one photorealistic image with the same aspect ratio and framing as\nImage 2.";

  return `Image 1 is a product photo of a garment. Image 2 is a photo of a person.

Edit Image 2 so the person is wearing the garment from Image 1, ${swap}. ${editLine}

Garment fidelity: reproduce the garment from Image 1 exactly — same color,
fabric texture, pattern scale and alignment, print and logo placement and
text, neckline, sleeve length, hem length, buttons, zippers, pockets, and
stitching. If the garment in Image 1 is worn by a model, take only the
garment and ignore that model's face, body, skin tone, hair, and pose.

Fit: drape the garment naturally over ${drapeOver}, with realistic folds where the body bends. Keep correct layering:
hair, arms, and hands that are in front of the clothing stay in front. The
hem should fall at the same point on the body as in Image 1.

Preserve from Image 2 exactly: ${preserve}

Lighting: match the garment to Image 2's light direction, color
temperature, and shadows so it looks photographed in the same scene.

${output}`;
}

/**
 * What a person is assumed to wear in a user-uploaded photo. Eval fixtures have a manifest that
 * says what each person wears; product uploads have none, so the prompt gets generic slot names.
 * A VLM "what are they wearing" step would sharpen this and is out of scope for this build.
 */
export const GENERIC_WEARING: Wearing = {
  top: "current top",
  bottom: "current bottoms",
  outer: null,
};
