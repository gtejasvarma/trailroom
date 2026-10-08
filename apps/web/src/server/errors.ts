// Every error the API can return, in one place so the copy can be linted (no fit or size
// language) and so status codes stay consistent. Messages: one plain sentence, sentence case,
// saying what happened and what to do.
export const ERRORS = {
  unauthorized: {
    status: 401,
    message: "We could not verify your session, so sign in again and retry.",
  },
  invalid_request: {
    status: 400,
    message:
      "That request was not in the expected format, so check it and retry.",
  },
  invalid_consent: {
    status: 400,
    message:
      "Consent needs the current version, the age confirmation and your acceptance, so accept all three and retry.",
  },
  consent_required: {
    status: 403,
    message: "Accept the consent and age confirmation first, then retry.",
  },
  not_an_image: {
    status: 400,
    message:
      "That file is not an image we can read, so choose a photo instead.",
  },
  unsupported_type: {
    status: 415,
    message:
      "That image type is not supported, so use a JPEG, PNG or WebP photo.",
  },
  too_large: {
    status: 413,
    message: "That file is over 10 MB, so choose a smaller one.",
  },
  too_small: {
    status: 422,
    message:
      "That photo is under 768 pixels on its short side, so choose a higher-resolution one.",
  },
  bad_aspect: {
    status: 422,
    message:
      "That photo is too wide or too tall to use, so choose a full-length or chest-up portrait.",
  },
  photo_required: {
    status: 409,
    message: "Add your photo first, then try the piece on.",
  },
  unknown_item: {
    status: 404,
    message: "We could not find that piece, so choose another from the list.",
  },
  not_ready: {
    status: 409,
    message:
      "This piece does not render reliably yet, so try one of the closest alternatives.",
  },
  signup_required: {
    status: 403,
    message:
      "Guests get one set of previews, so create an account to try on more.",
  },
  daily_limit: {
    status: 429,
    message: "Today's try-ons are used up, so come back tomorrow.",
  },
  render_in_progress: {
    status: 409,
    message:
      "A try-on is still rendering, so wait for it to finish before changing your photo.",
  },
  start_failed: {
    status: 503,
    message: "We could not start your previews just now, so try again shortly.",
  },
  not_found: {
    status: 404,
    message: "We could not find that.",
  },
  still_guest: {
    status: 409,
    message:
      "Your session is still a guest session, so finish signing in with an account and retry.",
  },
  internal: {
    status: 500,
    message: "Something went wrong on our side, so try again shortly.",
  },
} as const;

export type ErrorCode = keyof typeof ERRORS;
