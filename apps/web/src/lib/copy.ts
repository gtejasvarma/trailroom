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
  tagline: "One photo, four poses, garments from the labels you follow.",
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
    tabs: "Sections",
    skip: "Skip to content",
    discover: "Discover",
    lists: "Lists",
    yourTryOns: "Your try-ons",
    signIn: "Sign in",
    account: "Your account",
    back: "Back",
    listsShortcut: "Open your lists",
  },
  toasts: {
    // Interim: these controls get their real function in a later phase.
    soon: "Sign-in and lists arrive in the next build.",
    listsSoon: "Lists arrive soon.",
    following: (label: string) => `Following ${label}.`,
    unfollowed: (label: string) => `Unfollowed ${label}.`,
    followFailed: "We could not update that just now, so try again.",
    dismiss: "Dismiss",
  },
  discover: {
    title: "Discover",
    gridLabel: "Pieces",
    lookingFor: "What are you looking for",
    categoriesLabel: "Categories",
    categories: {
      all: "Everything",
      apparel: "Apparel",
      jewellery: "Jewellery",
      accessories: "Accessories",
    } as Record<string, string>,
    categoryIntro: {
      all: "Every piece from every label we carry. Try any of it on your own photo.",
      apparel:
        "Coats, dresses and tailoring from independent labels. Try any of it on your own photo.",
      jewellery:
        "Earrings and necklaces from independent labels. Trying jewellery on is not built yet.",
      accessories:
        "Scarves and small pieces from independent labels arrive soon.",
    } as Record<string, string>,
    emptyCategory: "Nothing here yet. Check back soon.",
    startTitle: "Start with these",
    startNote: "Pieces the label photographed four ways. Try any of them on.",
    demoChip: "Demo",
    startLabel: "Pieces to start with",
    proofTitle: "Drag to see the difference",
    proofBody:
      "Maya uploaded one photo. Now every piece here comes back on her body, in four poses.",
    proofOnHer: "On her photo",
    proofModel: "Model shot",
    proofModelDesktop: "Label’s photo",
    proofSlider: "Compare the label’s photo with the same piece on Maya",
    proofModelAlt: "The label’s photograph of the piece",
    proofOnPersonAlt: "The same piece, rendered on Maya’s photo",
    upload: "Upload your picture",
    creditsLink: "Photo credits",
  },
  card: {
    carousel: "carousel",
    slide: "slide",
    modelShot: "Model shot",
    onYourPhoto: "On your photo",
    photos: (n: number) => `↔ ${n} ${n === 1 ? "photo" : "photos"}`,
    poses: (n: number) => `↔ ${n} ${n === 1 ? "pose" : "poses"}`,
    frameLabel: (name: string, i: number, n: number) =>
      `${name}, photo ${i} of ${n}`,
    framesLabel: (name: string) => `Photos of ${name}`,
    dot: (i: number) => `Show photo ${i}`,
    prev: "Previous photo",
    next: "Next photo",
    buy: (price: string) => `Buy ${price}`,
    addToList: "Add to a list",
    openLabel: (name: string) => `Open ${name}`,
    follow: "Follow",
    following: "Following",
    followLabel: (name: string) => `Follow ${name}`,
    followingLabel: (name: string) => `Following ${name}. Unfollow`,
  },
  item: {
    tryItOn: "Try it on",
    back: "All pieces",
    price: (usd: number) => `$${usd}`,
    imageAlt: (name: string, label: string, photo: string) =>
      `${name} by ${label}, ${photo}`,
    moreFrom: (label: string) => `More from ${label}`,
    breadcrumb: "Breadcrumb",
    galleryLabel: "Photos",
    thumb: (i: number) => `Show photo ${i}`,
    photoCount: (i: number, n: number) => `${i} / ${n}`,
    notePhoto: "One photo of you, then every piece here renders on it.",
    pairsWith: "Goes with",
    viewLabel: (name: string) => `View ${name}`,
    tryLabel: (name: string) => `Try on ${name}`,
    startError: "We could not start that just now, so try again.",
  },
  label: {
    pieces: (n: number) => (n === 1 ? "piece" : "pieces"),
    tryOnReady: "try-on ready",
    empty: "No pieces from this label yet.",
    gridLabel: (label: string) => `Pieces from ${label}`,
  },
  lists: {
    title: "Lists",
    intro:
      "Save anything you’re weighing up into a list, then ask friends what they think. One piece or five, they vote in one tap each.",
    create: "New list",
    emptyTitle: "No lists yet",
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
    notYetTitle: "We can’t show this kind of piece yet",
    notYetBody: (reason: string) => `${reason} Here are pieces we can show.`,
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
    intro: "Every image in the catalogue is listed here.",
    line: "Demo catalogue. Labels and prices are invented; images are from the Trailroom design prototype.",
    filesLabel: "Image files",
    back: "Back to Discover",
  },
  errors: {
    generic: "Something went wrong, so try again.",
    network:
      "We could not reach the server, so check your connection and try again.",
  },
} as const;
