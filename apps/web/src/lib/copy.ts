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
const lower = (s: string | number) => String(s).toLowerCase();
/** "4 poses" / "1 pose": a count the screen can back up with real images. */
const poseWord = (n: number | string) =>
  Number(n) === 1 ? "1 pose" : `${n} poses`;

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
    signOut: "Sign out",
    account: "Your account",
    back: "Back",
    listsShortcut: "Open your lists",
  },
  toasts: {
    // Interim: these controls get their real function in a later phase.
    soon: "Buying and lists arrive soon.",
    buySoon: "Buying arrives soon.",
    listsSoon: "Lists arrive soon.",
    outfitSoon: "Outfits arrive soon.",
    signedIn: "Signed in. Your try-ons are saved.",
    signedInSoon: "Signed in. Lists and buying arrive soon.",
    signedOut: "Signed out.",
    existingAccount:
      "You are signed in to your existing account. The guest try-on stays with the guest session.",
    jobFailed: "Your try-on could not be finished.",
    seeWhy: "See why",
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
    emptyCategory: "Nothing here yet. Check back soon.",
    startTitle: "Start with these",
    startNote: "Pieces the label photographed four ways. Try any of them on.",
    demoChip: "Demo",
    startLabel: "Pieces to start with",
    proofTitle: "Drag to see the difference",
    proofBody:
      "Maya uploaded one photo. Now every piece here comes back on her body, in four poses.",
    proofTitleDesktop: "Stop guessing how it looks on you",
    proofBodyDesktop:
      "Drag the divider. One photo and every piece here comes back on your body, in four poses. Private to you.",
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
    onYou: "On you",
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
    seePoses: (n: number) => `See your ${poseWord(n)}`,
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
  // One line under every upload control. Adding a photo is the consent: the client sends the
  // consent version with the upload and the server records it.
  consentLine:
    "By adding a photo you confirm you’re 18 or over and agree to it being used to make your try-ons.",
  privacy: {
    line: "Private to you, never public, never used to train.",
    details: "Details",
    title: "Your photos",
    done: "Done",
    rows: [
      ["◐", "Your photos and try-ons are private to you. Nothing is public."],
      [
        "◷",
        "They are kept until you remove them. Guests who never make an account are cleared after about 48 hours.",
      ],
      [
        "↗",
        "Your photo is sent to Google’s image model to make the try-ons. It is not used to train models.",
      ],
      ["18", "Trailroom is for people 18 and over."],
    ] as readonly (readonly [string, string])[],
  },
  photo: {
    titleUpload: "Upload your picture",
    subUpload: "One photo, then everything in Trailroom can be seen on you.",
    titlePiece: "Upload your picture",
    subPiece: (name: string) =>
      `One photo and the ${String(name).toLowerCase()} comes straight back on you.`,
    titleAdd: "Add a photo",
    browse: "Browse all photos",
    fileInput: "Choose a photo file from your device",
    takeOne: "or take one now",
    dropTitle: "Drop a photo here",
    dropSub: "Or browse for one. JPG or PNG, one person, plain background.",
    browseFiles: "Browse files",
    dropLabel: "Drop a photo here, or browse for one",
    use: "Use this photo",
    chooseAnother: "Choose another",
    previewAlt: "The photo you chose",
    checking: "Checking your photo",
    uploading: "Adding your photo",
    starting: "Starting your try-on",
    loading: "Checking your account",
    rejected: "That photo was not accepted.",
    unreadable:
      "That file is not an image we can read, so choose a photo instead.",
  },
  camera: {
    title: "Take a photo",
    guidance: "Full body in frame, even light, one person.",
    dim: "It looks dark here, so move toward some light.",
    take: "Take photo",
    cancel: "Cancel",
    switch: "Switch camera",
    starting: "Opening your camera",
    denied:
      "We could not open your camera, so allow camera access in your browser or choose a photo instead.",
    unavailable:
      "No camera is available on this device, so choose a photo instead.",
    fallback: "Choose a photo instead",
    videoLabel: "Live view from your camera",
    frameLabel: "Framing guide",
  },
  starters: {
    title: "Your photo is in",
    sub: "Pick anything below and it comes back on you, in four poses.",
    kicker: "Start with one of these",
    tryOn: "Try it on",
    browse: "Browse everything instead",
    photoAlt: "Your photo",
    tryLabel: (name: string) => `Try on ${name}`,
  },
  whichPhoto: {
    title: "Which photo?",
    tryOnThe: (name: string) => `Try on the ${String(name).toLowerCase()}`,
    using:
      "Using your default full-body photo. It renders in the background, so you don’t have to wait here.",
    confirm: "Add to the queue",
    different: "Use a different photo",
    isDefault: "DEFAULT",
    photoAlt: "Your default photo",
  },
  library: {
    title: "Which photo?",
    sub: "Your full-body photos. Tap one to use it for this try-on.",
    add: "+ Add a photo",
    photoLabel: (label: string, isDefault: boolean) =>
      isDefault ? `${label}, default photo` : label,
    useLabel: (label: string) => `Use ${label}`,
    starting: "Starting your try-on",
    empty: "No photos yet.",
  },
  queue: {
    title: (name: string) => `Trying on ${name}`,
    tilesLabel: "Poses",
    keepBrowsing: "Keep browsing while it renders",
    loading: "Loading your try-on",
    pending: "Waiting to render",
    rendering: "Rendering…",
    poseFailed: "This pose could not be shown",
    missing: "We could not find that try-on.",
    missingAction: "Back to the pieces",
    garmentAlt: (name: string) => `${name}, the piece being rendered`,
    // "4 poses, coming up" → "4 poses, on you" (signed in) / "4 poses, ready" (guest).
    titleRunning: (total: number) => `${cap(poseWord(total))}, coming up`,
    titleReadySignedIn: (n: number) => `${cap(poseWord(n))}, on you`,
    titleReadyGuest: (n: number) => `${cap(poseWord(n))}, ready`,
    lineRunning: (name: string, total: number, ready: number) =>
      `Your photo, the ${lower(name)}, ${poseWord(total)}. ${ready} of ${total} ready, and you can leave this screen while it renders.`,
    lineReadySignedIn: (name: string, n: number) =>
      `The ${lower(name)} on your photo, ${poseWord(n)}.`,
    lineReadyGuest: (name: string, n: number) =>
      `The ${lower(name)} on your photo, ${poseWord(n)}. Create an account to open ${n === 1 ? "it" : "them"}.`,
    cta: (n: number) => (n === 1 ? "See it on you" : `See your ${n} poses`),
    tileAlt: (name: string, pose: string) => `${name}, ${pose} pose, preview`,
  },
  // The persistent job chip and the ready bar (shell, every screen while a job runs).
  chip: {
    running: (name: string) => `Putting the ${lower(name)} on you`,
    sub: (ready: number, total: number) =>
      `${ready} of ${total} poses ready · you can keep browsing`,
    view: "View",
    readyLine: (name: string, n: number) =>
      `Your ${lower(name)} is ready — ${poseWord(n)}`,
    readyToast: (name: string, n: number) =>
      `Your ${lower(name)} is ready — ${poseWord(n)}.`,
    seeIt: "See it",
    ariaRunning: "Try-on in progress",
    ariaReady: "Try-on ready",
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
    galleryLabel: "Your poses",
    onYou: "On you",
    counter: (pose: string, i: number, n: number) =>
      n > 1 ? `${pose} · ${i}/${n}` : pose,
    onYouPose: (pose: string) => `On you · ${pose}`,
    dot: (i: number) => `Show pose ${i}`,
    aiCaption: "AI-generated preview",
    expectation: EXPECTATION_LINE,
    partial:
      "Three of four poses are shown. One could not be rendered well enough to show.",
    buy: (price: string, label: string) => `Buy ${price} at ${label}`,
    addToList: "Add to a list",
    saveToList: "Save to a list",
    outfit: "Build the outfit",
    outfitSub: "Have a look, then decide",
    addAnother: "Add another",
  },
  // The account sheet, by reason (the prototype's gateCopy), minus "ask", which is not built yet.
  account: {
    reasons: ["reveal", "list", "buy", "picknext", "signin"] as const,
    title: (reason: string, n: number) =>
      ({
        reveal: `${poseWord(n)} ${Number(n) === 1 ? "is" : "are"} ready — create an account`,
        list: "Create an account to save",
        buy: "Create an account to buy",
        picknext: "Your photo is in — create an account",
      })[reason] ?? "Create an account",
    sub: (reason: string, n: number) =>
      ({
        reveal: `Yours to keep. An account is what saves ${Number(n) === 1 ? "it" : "them"}, and your photo, for next time.`,
        list: "Lists and every try-on you make live in your account.",
        buy: "So we can keep this try-on and bring you back to it.",
        picknext:
          "It saves your photo so you only ever do this once, and keeps every try-on you make.",
      })[reason] ?? "Your photos and try-ons stay with you.",
    pending: (reason: string, n: number) =>
      ({
        reveal: `Then your ${poseWord(n)} ${Number(n) === 1 ? "opens" : "open"}.`,
        list: "Then you are back at the piece.",
        buy: "Then you are back at the piece.",
        picknext: "Then pick the first thing to see on yourself.",
      })[reason] ?? "",
    carryOver: "Your photos and try-ons carry over.",
    google: "Continue with Google",
    close: "Not now",
    working: "Signing you in",
    error: "We could not sign you in, so try again.",
    popupClosed: "The sign-in window was closed, so try again.",
    photoAlt: "Your photo",
    tileAlt: "Your first pose, small preview",
  },
  welcome: {
    title: "Pick three labels",
    sub: "Whatever they add shows up in Discover.",
    picked: "Selected",
    pickMore: (n: number) => `Pick ${n} more`,
    done: "Done",
    saving: "Saving",
    error: "We could not save that just now, so try again.",
    rowLabel: (name: string) => name,
    pieces: (n: number) => `${n} ${n === 1 ? "piece" : "pieces"}`,
  },
  tryOns: {
    title: "Your try-ons",
    sub: "Everything you have tried on, kept until you remove it.",
    gridLabel: "Your try-ons",
    openLabel: (name: string) => `Open your ${lower(name)} try-on`,
    poses: (n: number) => `↔ ${poseWord(n)}`,
    emptyTitle: "Nothing tried on yet",
    emptyBody: "Pick a piece and it comes back on you, in four poses.",
    emptyAction: (name: string) => `Try on the ${lower(name)}`,
    loading: "Loading your try-ons",
    guestNote:
      "Create an account to keep your try-ons. Guest try-ons are cleared after about 48 hours.",
    cardAlt: (name: string) => `${name}, front pose, preview`,
  },
  signup: {
    title: "Guests get one try-on",
    body: "Create an account to try on another piece. Your first set stays yours.",
    google: "Continue with Google",
    back: "Back to the pieces",
  },
  failure: {
    notYetTitle: (what: string) => `Not yet for ${lower(what)}`,
    notYetBody: (what: string) =>
      `We can't put ${lower(what)} on you yet. We'd rather say so than show you a guess.`,
    notReadyTitle: "We couldn't render this one honestly",
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
    internalBody:
      "Nothing was shown to you, and the problem is ours, not your photo. Try again.",
    tryAgain: "Try again",
    differentPhoto: "Use a different photo",
    toCatalogue: "Back to Discover",
    closestTitle: "Closest three we can put on you",
    closestLabel: (name: string) => `Try on ${name}`,
    pieceAlt: (name: string) => `${name}, the label's photo`,
  },
  you: {
    title: "You",
    guest:
      "You are using a guest session. Guest photos and try-ons are cleared after about 48 hours.",
    account: "You are signed in.",
    photosTitle: "Your photos",
    fullBody: "Full body",
    fullBodyHint: "Used for every piece. Tap a photo to make it the default.",
    count: (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`,
    noPhotos: "No photos yet. Add one and every piece can be seen on you.",
    manage: "Manage",
    closeManage: "Close",
    add: "+ Add",
    addTitle: "Add a photo",
    default: "Default",
    makeDefault: "Make default",
    makeDefaultLabel: (label: string) => `Make ${label} the default`,
    remove: "Remove",
    removeLabel: (label: string) => `Remove ${label}`,
    removed: (label: string) => `${label} removed.`,
    defaultUpdated: "Default photo updated.",
    added: "Photo added.",
    full: "You can keep up to 6 photos, so remove one to add another.",
    actionFailed: "We could not do that just now, so try again.",
    deleteAll: "Delete everything",
    deleting: "Deleting",
    deletedTitle: "Deleted",
    deletedBody: "Your photos and every try-on made from them are gone.",
    deleteError: "We could not delete that just now, so try again.",
    browse: "Back to the pieces",
    loading: "Checking your account",
    signInLine: "Sign in to keep your photos and try-ons.",
    signIn: "Sign in with Google",
    signedInAs: (who: string) => `Signed in as ${who}.`,
    signOut: "Sign out",
    tryOnsTitle: "Your try-ons",
    seeAllTryOns: "See your try-ons",
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
