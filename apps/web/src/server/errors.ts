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
  consent_required: {
    status: 403,
    message:
      "Adding a photo needs your confirmation that you are 18 or over and agree to it being used, so add it again from the upload screen.",
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
  unknown_label: {
    status: 404,
    message: "We do not carry that label, so check the name and retry.",
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
  account_required: {
    status: 403,
    message: "Create an account to open your poses.",
  },
  job_in_progress: {
    status: 409,
    message:
      "Another try-on is still rendering, so wait for it to finish before starting this one.",
  },
  daily_limit: {
    status: 429,
    message: "Today's try-ons are used up, so come back tomorrow.",
  },
  photo_in_use: {
    status: 409,
    message:
      "A try-on is still rendering with that photo, so wait for it to finish before removing it.",
  },
  photo_limit: {
    status: 409,
    message:
      "You can keep up to 6 photos, so remove one before adding another.",
  },
  start_failed: {
    status: 503,
    message: "We could not start your previews just now, so try again shortly.",
  },
  list_limit: {
    status: 409,
    message:
      "You can keep up to 30 lists, so delete one before making another.",
  },
  list_full: {
    status: 409,
    message:
      "A list holds up to 12 pieces, so remove one before adding another.",
  },
  ask_limit: {
    status: 409,
    message:
      "You have 20 asks open, so revoke one before asking friends about another.",
  },
  ask_closed: {
    status: 410,
    message: "This link is no longer active.",
  },
  own_ask: {
    status: 403,
    message: "This is your own ask, so only your friends can vote on it.",
  },
  too_many_attempts: {
    status: 429,
    message:
      "Too many attempts from your network, so wait a few minutes and try again.",
  },
  body_too_large: {
    status: 413,
    message: "That request is too large, so send a smaller one.",
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
  merge_refused: {
    status: 403,
    message:
      "Those two sessions could not be combined, so sign in again and retry.",
  },
  already_answered: {
    status: 409,
    message: "That was already answered, so there is nothing more to do.",
  },
  tryon_rendering: {
    status: 409,
    message:
      "That try-on is still rendering, so wait for it to finish before removing it.",
  },
  internal: {
    status: 500,
    message: "Something went wrong on our side, so try again shortly.",
  },
} as const;

export type ErrorCode = keyof typeof ERRORS;
