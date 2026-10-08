// Every user-visible string in the product lives here. Components import `copy` and never write
// text literals. copy.test.ts lints every string for fit/size and body-judgement language.
// Dynamic strings are functions of plain strings or numbers so the lint can call them.
//
// Rules (CLAUDE.md, docs/Design.md §9): sentence case; buttons name the outcome; errors say what
// happened and what to do; nothing about fit, size, flattery or "before and after".

export const EXPECTATION_LINE =
  "A preview, not a fitting — it can't tell you size or fit.";

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
/** Small counts as words ("four"); anything else as given. */
const word = (n: number | string) =>
  typeof n === "number" && WORDS[n] !== undefined ? WORDS[n]! : String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const copy = {
  brand: "Trailroom",
  gate: {
    title: "Trailroom is in private testing",
    body: "Enter the password you were given to see it.",
    password: "Password",
    wrong: "That password didn’t match. Check it and try again.",
    open: "Open Trailroom",
    tooMany:
      "Too many wrong passwords from your network, so wait ten minutes and try again.",
  },
  nav: {
    home: "Trailroom home",
    you: "You",
    main: "Main",
    skip: "Skip to content",
  },
  catalogue: {
    title: "Try something on",
    intro: "One photo, four poses, garments from the labels you follow.",
    creditsLink: "Photo credits",
    gridLabel: "Pieces",
  },
  item: {
    tryItOn: "Try it on",
    back: "All pieces",
    price: (usd: number) => `$${usd}`,
    imageAlt: (name: string, label: string) => `${name} by ${label}`,
    viewLabel: (name: string) => `View ${name}`,
    tryLabel: (name: string) => `Try on ${name}`,
    startError: "We could not start that just now, so try again.",
  },
  consent: {
    title: "Before you add a photo",
    intro: "Here is exactly what happens to it.",
    statements: [
      "We store one photo of you and the renders made from it.",
      "Guest photos and renders are deleted after about 48 hours unless you create an account.",
      "You can remove the photo and every render at any time with Delete my photo.",
      "We never train on your photos.",
      "Your photo is sent to Google's Gemini API to make the images; we ask Google not to retain it, and it is not used to train models.",
      "Renders are AI-generated previews.",
    ],
    ageLabel: "I am 18 or older",
    agreeLabel:
      "I agree to my photo being used to generate try-on images as described",
    accept: "Agree and add my photo",
    decline: "Not now",
    saving: "Saving your answer",
    error: "We could not record that just now, so try again.",
  },
  photo: {
    title: "Add your photo",
    guidance: "One person, full body or chest up. A plain background helps.",
    choose: "Choose a photo",
    chooseDifferent: "Choose a different photo",
    use: "Use this photo",
    useCurrent: "Use my current photo",
    currentTitle: "Your photo is saved",
    currentBody: "Use it again, or choose a different one.",
    previewAlt: "The photo you chose",
    uploading: "Uploading your photo",
    starting: "Starting your try-on",
    loading: "Checking your account",
    rejected: "That photo was not accepted.",
  },
  queue: {
    title: (name: string) => `Trying on ${name}`,
    tilesLabel: "Poses",
    keepBrowsing: "Keep browsing",
    loading: "Loading your try-on",
    pending: "Waiting to render",
    poseFailed: "This pose could not be shown",
    missing: "We could not find that try-on.",
    missingAction: "Back to the pieces",
    garmentAlt: (name: string) => `${name}, the piece being rendered`,
  },
  status: {
    queued: "Waiting to start",
    // The poses render at the same time, so there is no "current pose": only a count that is true.
    rendering: (ready: number, total: number) =>
      `Rendering ${word(total)} poses. ${ready} of ${total} ready.`,
    ready: (n: number, total: number) => `${n} of ${total} poses ready`,
    failed: "This try-on could not be finished",
  },
  poses: {
    front: "Front",
    "three-quarter": "Three-quarter",
    walking: "Walking",
    seated: "Seated",
  } as Record<string, string>,
  result: {
    title: (name: string) => name,
    heroAlt: (name: string, label: string, pose: string) =>
      `AI-generated preview of ${name} by ${label}, ${pose} pose`,
    thumbAlt: (name: string, pose: string) => `${name}, ${pose} pose`,
    thumbsLabel: "Choose a pose",
    aiCaption: "AI-generated preview",
    expectation: EXPECTATION_LINE,
    partial:
      "Three of four poses are shown. One could not be rendered well enough to show.",
    addAnother: "Add another",
    addToList: "Add to a list",
    save: "Save",
    saveLabel: "Save this render",
    listsLater: "Lists arrive in a later build.",
    saved: "Saved to your device.",
    saveFailed: "We could not save that image, so try again.",
    internalNote: (checks: string) =>
      `Internal build note: checks not yet run on these renders: ${checks}.`,
    internalNoteNone: "Internal build note: every check ran on these renders.",
  },
  account: {
    title: (n: number) =>
      n === 1 ? "One pose is ready" : `${cap(word(n))} poses are ready`,
    body: "Create an account. They're yours to keep.",
    google: "Continue with Google",
    close: "Close",
    working: "Signing you in",
    error: "We could not sign you in, so try again.",
    popupClosed: "The sign-in window was closed, so try again.",
  },
  signup: {
    title: "Guests get one try-on",
    body: "Create an account to try on another piece. Your first set stays yours.",
    google: "Continue with Google",
    back: "Back to the pieces",
  },
  failure: {
    notReadyTitle: "We can't render this one honestly",
    notReadyBody: (reason: string) =>
      `${reason} We'd rather say so than show you a guess.`,
    renderFailedTitle: "That render did not come out well enough to show",
    renderFailedBody:
      "We checked it before showing it and it did not pass, so we are not showing it.",
    capacityTitle: "Today's render budget is used up",
    capacityBody: "Come back tomorrow and it will be ready to go again.",
    dailyLimitTitle: "Today's try-ons are used up",
    dailyLimitBody: "Come back tomorrow to try on more.",
    internalTitle: "Something went wrong on our side",
    internalBody: "Nothing was shown to you. Try again.",
    tryAgain: "Try again",
    differentPhoto: "Use a different photo",
    toCatalogue: "Back to the pieces",
    closestTitle: "Closest three we can render",
    closestLabel: (name: string) => `Try on ${name}`,
  },
  you: {
    title: "You",
    hasPhoto: "A photo of you is stored.",
    noPhoto: "No photo is stored.",
    guest:
      "You are using a guest session. Guest photos and renders are deleted after about 48 hours.",
    account: "You are signed in.",
    delete: "Delete my photo",
    deleting: "Deleting",
    deletedTitle: "Deleted",
    deletedBody: "Your photo and every render made from it are gone.",
    deleteError: "We could not delete that just now, so try again.",
    browse: "Back to the pieces",
    loading: "Checking your account",
  },
  credits: {
    title: "Photo credits",
    intro: "Every catalogue photo is from Wikimedia Commons.",
    author: "Author",
    licence: "Licence",
    source: "Source",
    sourceLink: (title: string) => `View source for ${title}`,
    back: "All pieces",
  },
  errors: {
    generic: "Something went wrong, so try again.",
    network:
      "We could not reach the server, so check your connection and try again.",
  },
} as const;
