# Trailroom: try on anything. Requirements for the next four journeys

**Owner:** Tejas · **Status:** Draft 0.1 for the owner's review · **Date:** 12 October 2026

**One line:** Find a piece anywhere, on a store's site, in a screenshot, in your Instagram feed,
and see it on you before you buy it.

**What this document is.** `docs/PRD.md` (v0.7) describes the product that is live: one photo,
four poses, a catalogue of twelve invented pieces. This document is the requirements for what
comes next: four journeys that let a person try on a piece that is *not* in our catalogue. It
extends the main PRD and does not replace it. **Nothing here is decided.** A choice becomes a
decision when the owner agrees to it and it is written into `docs/PRD.md` §22.1. The thinking
that led here is in `docs/IDEAS.md`.

**How to read it.** §1 to §4 are the shared ground: the problem, the engine all four journeys
need, the price, and how people tell their friends. §5 to §8 are the four journeys, each answering
the same five questions. §9 is the phasing, with the gate between each phase. §10 to §12 are
measures, risks and what we are not building.

---

## 0. The verdict before the document

1. **The product today has a hole in the middle.** A person can see themselves in twelve pieces
   that do not exist. Nobody can try on the thing they are actually deciding whether to buy.
   Every journey here closes that hole from a different direction.
2. **All four journeys need one engine that does not exist yet:** take any picture of a garment
   and render it on the person. Build that once (§2). The journeys are four doors into it.
3. **Order: link or image first, then the Chrome extension, then sharing from Instagram.** The
   merchant plugin runs alongside as a question to OpenAI, not a build. The reasons are in §9.
4. **The quality baseline comes before any of it.** Whether a render holds up on a real store's
   product photo, or on a cluttered screenshot, is unknown. That is the first thing to measure
   (§9, Phase 0). If screenshots fail half the time, Journey 3 changes shape.
5. **The price only works if a try-on gets cheaper.** $20 for 100 four-pose try-ons leaves about
   15%. Rendering the Front pose first, and the others when the person asks, leaves about 60%
   (§3).
6. **This reverses two things in the main PRD,** and says so: revenue moves from affiliate links
   to a subscription, and the share surface (§9 there, "Phase 2") moves to the front.

---

## 1. The customer and the problem

### 1.1 Who

A person who buys clothes online and decides on a phone, most often in the evening, moving
between Instagram, a store's site and a group chat. She has bought things that looked right on
the model and wrong on her, and sent them back. She does not want a new place to shop. She wants
a faster, surer answer to one question about a piece she has already found.

### 1.2 The problem, in her words

*"I found this. I can't tell what it will look like on me."*

A product photo shows the piece on one body, lit and pinned by a stylist. She has a different
body, different colouring and her own things to wear it with. Today her options are to guess, to
order two and return one, or to ask a friend who is also guessing.

Trailroom already answers the question, for twelve pieces she will never buy. The problem this
document solves is narrower and more useful: **answer it for the piece in front of her, wherever
she found it, in under a minute.**

### 1.3 Why it is worth solving

- **Returns are the size of the problem.** Online clothing is returned at roughly 25 to 30%, the
  highest of any category, and a return on a $100 order costs the seller about $30 once shipping,
  handling and markdown are counted. Most of those returns are for how the piece turned out on
  the buyer.[^returns]
- **She decides on her phone.** Phones carry about 62% of online clothing revenue.[^mobile] The
  answer has to arrive where the decision is made.
- **She found it on social.** Over half of younger shoppers say social media inspired their last
  online fashion purchase, and Instagram is the platform they name most for finding new
  brands.[^social] The piece she wants is, more often than not, in a feed and not in a catalogue.
- **We can only charge for an answer about something she wants.** Nobody will pay to see
  themselves in an invented coat.

### 1.4 Why now

- **The models are good enough and cheap enough this year.** One render costs about four cents
  and returns in under twenty seconds, keeping the person's face and the garment's detail in the
  cases we have looked at. A year ago this needed a studio pipeline.
- **The rest is built.** Photo intake, consent, the render pipeline, the spend ledger, the
  quality gate with a face check, the reveal and the vote page all exist and are live.
- **The window is short.** Google has folded try-on into Search and Shopping, and store-side
  try-on apps are multiplying. The position still open is the shopper's side: one photo of her,
  usable on any piece from any store.

### 1.5 What stays true from the main PRD

The principles in `docs/PRD.md` §4 and the hard rules in `CLAUDE.md` hold for every journey here.
The ones that bite hardest:

- **Look, not fit.** We show how a piece looks on her. We never say how it will fit, what size to
  order or where a hem falls. This governs every sentence in this document, including the ads.
- **Trust beats wow.** A render that fails the quality gate is not shown. With unknown garment
  photos there will be more failures, and the honest-failure screen carries more weight.
- **A shared image is a garment source, never an identity source** (§9.5 of the main PRD). We
  never take a face from a screenshot. The only person rendered is the account holder, from her
  own photo.
- **Private first.** Nothing is broadcast without her doing it. There is no public feed of
  anyone's renders.
- **A visible AI label beside every render,** never drawn into it.

---

## 2. The shared engine: "bring your own piece"

Every journey ends at the same place: a garment the catalogue has never seen has to be rendered
on a person. This section is the requirement for that. It is built once, in Phase 1.

### 2.1 What it takes in

| Input | Example | How hard |
|---|---|---|
| A clean product photo, piece on a model | Most store product pages | Easiest. Close to what the catalogue has now. |
| A flat or ghost-mannequin product photo | Many stores' second image | Medium. No body to read the drape from. |
| A photo of a person wearing it, not a product shot | An Instagram post, a street photo | Hard. Posed, cropped, partly hidden. |
| A screenshot | Instagram, TikTok, a store's app | Hardest. The garment plus buttons, captions, other pieces. |

### 2.2 What it must do

1. **Find the garment.** Decide which piece in the image is meant. When there is more than one
   candidate (a jacket over a dress), ask her with a tap on the image. Do not guess silently.
2. **Describe it.** Produce the short plain description the render prompt needs ("pink crepe wrap
   top") and the garment category (top, bottom, dress, outerwear). Today these are written by
   hand for twelve pieces.
3. **Check the image before any model touches it** (main PRD §9.5): illegal-content matching,
   adult content, and whether the person in it appears to be a minor. Refuse and say why in one
   plain sentence.
4. **Render it on her,** through the existing pipeline and the one model chokepoint, under the
   same spend ledger and the same quality gate, including the face check.
5. **Say so when it cannot.** If the garment cannot be isolated well enough, show the honest
   failure screen: what went wrong, in plain words, and what would work ("a photo that shows the
   whole piece"). Offer the closest pieces we can render only if they are close.
6. **Keep the source.** Store the link she pasted with the try-on, so the result can send her
   back to the store to buy, and so we learn which stores people bring.

### 2.3 What a "piece" becomes

A new kind of record beside the catalogue: **a found piece.** It belongs to one person. It holds
the source link if there was one, the store's name, the image used, the description and category
the engine produced, and the price if the page stated it. It is private to her, deleted with her
account, and never shown to anyone else as catalogue.

### 2.4 Requirements that are new

- **Fetching a page safely.** The server will be fetching addresses typed by strangers. It must
  refuse private and internal addresses, follow few redirects, cap size and time, and fetch
  images only as images. This is a security requirement, not a nicety.
- **Stores that block us.** Many large retailers refuse automated fetches. When a link fails, the
  screen says so and offers "add a screenshot instead" in the same place. A blocked link is not
  an error page.
- **A garment check in the quality gate.** Today nothing checks that the rendered garment is the
  right one. With clean catalogue photos that was tolerable. With unknown photos it is the main
  way a render can be wrong. This is the next check the eval (M1) has to supply.

---

## 3. Price and the cost of a try-on

### 3.1 The offer to test

**$20 a month for 100 try-ons**, after a small number free. Signing in is already required to
start a try-on (the owner's decision of 2026-10-12), so every try-on belongs to an account.

### 3.2 Why a try-on has to get cheaper first

One render costs about $0.0375. Card fees on $20 are about $0.88.

| How a try-on is rendered | Cost of one | Cost of 100 | Left from $20 | Margin |
|---|---|---|---|---|
| Four poses, every time (today) | $0.150 | $15.00 | about $3 | about 15% |
| Front first, the other three when she taps | about $0.07 | about $7 | about $12 | about 60% |
| Front first, on the Lite model (quality untested) | about $0.065 | about $6.50 | about $12.50 | about 63% |
| Front live, other three by batch (arrive hours later) | $0.094 | $9.40 | about $9.70 | about 47% |

"About $0.07" assumes a third of try-ons are opened up to all four poses. That share is a guess
until it is measured.

**Requirement:** a found piece renders the **Front pose first.** The result shows it, with one
clear action, "See more poses", that renders the other three. Each try-on counts once against the
100 whether or not she opens the other poses. This is also faster: one image returns before four
would.

### 3.3 The free allowance

Five free try-ons for a new account. At Front-first cost that is about 20 to 35 cents a person,
which is the price of letting someone find out the product works on her. It is spent only after
sign-in.

### 3.4 What the paywall says

When the free try-ons are used: what she gets (100 try-ons a month, on any piece from anywhere),
the price, and nothing else. No countdown, no claim about scarcity. The moment to ask is right
after a result she liked, not before she has seen one.

### 3.5 Open on price

- Whether unused try-ons carry over. Carrying over is kinder and costs margin.
- Whether there is a smaller pack for someone with one decision to make ("10 try-ons, $4").
- What happens at 100. A second pack, or wait for next month. Never a silent overage.

---

## 4. How people tell their friends

The main PRD is right that renders are personal and people share them privately (§11.2 there).
The growth design follows from that. It does not fight it.

### 4.1 Three things can be shared, and they are different

| What she shares | Who sees what | What it asks the friend |
|---|---|---|
| **Her render** ("should I get this?") | The friend sees her in the piece. Built today: the ask and the vote page. | Vote. Then: "See it on you." |
| **The piece** ("try this on yourself") | The friend sees the store's photo and a button. Never her render. | Put it on *you*. |
| **An invitation** ("you get five") | Nothing of hers. | Start, with free try-ons for both. |

Sharing **the piece** is new and is the strongest of the three. It carries no picture of her, so
there is nothing to be shy about, and it hands the friend a reason to upload a photo: a specific
piece a friend chose for her.

### 4.2 The loop

1. She tries on a found piece and likes it.
2. The result offers, in this order: **Ask friends** (her render, private link, one-tap vote with
   no account) and **Send this piece to a friend** (no render, just the piece).
3. The friend opens the link on her phone. For an ask, she votes, then sees "Now put it on you"
   with that exact piece queued. For a sent piece, she lands on the same queue directly.
4. The friend adds a photo, signs in, and gets her free try-ons, with one more for the sender.

### 4.3 Requirements

- Every shared link carries the piece, so the friend's first try-on is that piece, not a blank
  start.
- The link preview in iMessage and WhatsApp shows the piece (and, for an ask, the render) as the
  image, with a title that is a question, not a brand slogan.
- Votes need no account and no install. This is already true and must stay true.
- Referral credit is given once, on the friend's first completed try-on, never for an install or
  a sign-up alone.
- **Exporting a render as an image** (to post it, or to drop into a chat that strips link
  previews) is an open decision (§11). The hard rule says the AI label is never drawn into the
  image and is always beside it. An exported file has no "beside".

---

## 5. Journey 1: paste a link, or add an image

*Phase 1. The first thing to build.*

### 5.1 What customer problem are we solving?

She has found a specific piece on a store's site, or has a screenshot of one, and cannot tell how
it will look on her. Trailroom can show her, but only for pieces in its own catalogue, which is
not where she shops.

### 5.2 Why is it worth solving, and why now?

- It is the whole product's missing middle (§0). Without it there is nothing to charge for.
- It is the engine every later journey needs (§2). Building it first means the extension and the
  share target are small additions.
- It works on a phone and a laptop with nothing to install, so it reaches the 62% who decide on a
  phone from day one.
- It answers, in days and for a few dollars, the two questions that decide everything else: does
  the render hold up on real product photos, and will anyone pay.

### 5.3 Where will she discover it?

**In the product**

| Place | What she sees |
|---|---|
| Home, for a new visitor | Under the hero's "Upload your picture", a second line: "Found something elsewhere? Try on any piece." |
| Home, for a returning person | The first thing on Discover: a single field, "Paste a link or add a screenshot", above the catalogue. This becomes the product's front door. |
| Every result | After the poses: "Try on something else you've found." |
| The honest-failure screen | "Try a different photo of it" returns to the same field. |
| Navigation | A persistent "+" on the phone tab bar and the desktop header. |

The field accepts a link by paste, and a picture from the camera roll or by drag and drop. It
reads the clipboard only when she taps "Paste", never on its own.

**In Instagram ads**

- **The hook:** a screen recording, fifteen seconds. A store page with a dress. Copy the link.
  Paste. The dress, on a real person, in her own hallway.
- **The line:** "Found it somewhere? See it on you first." Never "see if it fits".
- **The button:** "Try it on" to a landing page that is the paste field itself, with a sample
  link already filled in so one tap shows the idea before any sign-up.
- **Who:** people who follow fashion retailers and labels, lookalikes of people who completed a
  first try-on.
- **What the ad must not do:** say "AI", "virtual" or "avatar" in the headline (main PRD §11.4),
  make any claim about fit or size, or address the viewer's body ("for your shape"), which
  breaks both our rule and the ad platform's.

### 5.4 How does the product solve it, and how is her life better?

**The flow**

1. She pastes a link, or adds a screenshot.
2. For a link: within a couple of seconds the screen shows the store's name, the piece's name and
   its photos, and asks "Which photo shows it best?" with the clearest one chosen for her.
3. For an image: the screen shows it with the garment outlined, and "Is this the piece?" If there
   are two candidates she taps the one she means.
4. If she has no photo of herself yet, she adds one here, with the consent line. If she is not
   signed in, the account sheet rises here, and the try-on starts by itself once she is.
5. The Front pose renders. The reveal plays: the store's photo wipes into her.
6. The result shows the render, "AI-generated preview" beside it, **See more poses**, **Ask
   friends**, **Send this piece to a friend**, and **Go to the store**, which opens the page she
   came from.

**What is better for her**

- She gets an answer about the piece she is deciding on, in under a minute, without leaving the
  decision.
- She can hold three candidates side by side on the same photo of herself, in the same light
  (Compare, already built), which no store offers across stores.
- She orders fewer things to send back.
- It goes with her: the same photo works on every store, with no account at each one.

**Failure cases the design must cover**

| Case | What she sees |
|---|---|
| The store blocks our fetch | "We couldn't open that page. Add a screenshot of it instead." Same screen, one tap. |
| The link is not a product page | "That page doesn't look like a single piece. Open the piece's own page and copy that link." |
| The garment cannot be isolated | The honest-failure screen, with what would work. |
| Not clothing we render (shoes, bags today) | "We can't show that kind of piece yet." No waitlist promise unless one exists. |
| The image fails the safety check | One plain sentence. No try-on, no count against her allowance. |
| The render fails the quality gate | The existing partial and failure rules. A failed try-on is not counted. |

### 5.5 How do we use it to get her to share?

- **"Send this piece to a friend" is on every result,** and is the default for a piece she did not
  love ("not for me, but it's so you"). It costs her nothing to send, because it carries no image
  of her.
- **"Ask friends" on a second candidate.** When she has tried two found pieces in one sitting, the
  next action offered is "Can't decide? Ask friends", with both in it.
- **The store link is a reason to come back to us, not only to leave.** After "Go to the store",
  the next visit asks once "Did you get it?" and offers a single share: "Tell the friend who
  voted."
- **Measure:** shares per completed try-on, friends who open a shared piece, friends who complete
  a first try-on, and the resulting new accounts per active person per month.

### 5.6 What it needs

The engine in §2, Front-first rendering (§3.2), the found-piece record (§2.3), the paste field on
Discover, the paywall (§3.4), "Send this piece" links (§4), and analytics events for every step
of the flow. No analytics exist in the product today.

### 5.7 It is working if

- Six in ten pasted links end in a render she is shown (the rest split between blocked stores,
  the honest failure and the quality gate).
- Half of the people who see one render try a second piece in the same sitting.
- At least one in twenty people who use up the free try-ons pays.

---

## 6. Journey 2: the Chrome extension

*Phase 2. Starts only if Phase 1 shows people bringing links from a laptop.*

### 6.1 What customer problem are we solving?

On a laptop, with a store open and a cart half full, copying a link, opening another tab, pasting
and waiting is enough friction that she will not do it for the fourth piece. And she is usually
choosing between several pieces on the same site, not one.

### 6.2 Why is it worth solving, and why now?

- Laptop sessions are fewer than phone sessions but they are where larger baskets are built and
  where people compare. Desktop converts at roughly twice the rate of mobile.[^mobile]
- The extension turns "go to Trailroom" into "Trailroom is already here", at the exact moment of
  the decision.
- It needs no deal with any store.
- **Why not first:** it works only in Chrome on a computer (Chrome on Android has no extensions),
  it asks for permission to read pages, which some people refuse, and it has to be kept working
  as each store changes its site. It is an accelerator for people who already use the link flow,
  not a way to find them.

### 6.3 Where will she discover it?

**In the product**

| Place | What she sees |
|---|---|
| A result on a laptop, after a pasted link from a supported store | "Shopping on this laptop? Add Trailroom to Chrome and skip the copy and paste." |
| The paste field, on a laptop | A quiet line under it: "Or try on from the store's page." |
| Her account page | "Add to Chrome", with the list of stores it works on. |
| The Chrome Web Store listing | Its own page; first image is the nudge on a real store's product page. |

**In Instagram ads**

Instagram is on her phone and the extension is on her laptop, so an ad cannot install it. Two
honest options, and the second is better:

- An ad that ends "Send the link to your laptop", which emails her a link. This needs email, which
  is built and switched off.
- **Do not advertise the extension on Instagram.** Advertise the link flow there (§5.3), and let
  the product offer the extension to the people who turn up on a laptop. If paid reach is wanted
  for the extension itself, use desktop placements.

### 6.4 How does the product solve it, and how is her life better?

**The flow**

1. She is on a product page of a supported store. A small, quiet Trailroom mark sits at the edge
   of the product photo: "Try it on". It does not cover the photo, animate, or appear on pages
   that are not product pages. She can turn it off for a site in one click.
2. She clicks. A side panel opens beside the page, not over it. It shows the piece, taken from the
   page she is already looking at, so there is nothing for a store to block.
3. On a page with several pieces (a category page, a "complete the look" row), the panel lists
   them: "Try on 4 pieces from this page", each selectable.
4. She confirms. The renders run in the background. She keeps shopping. The mark shows a small
   count.
5. When they are ready, the browser notifies her, and the panel shows her in each piece beside the
   store's photo. If she has closed the tab, the results are in Trailroom and, once email is
   switched on, in her inbox with the images.

**What is better for her**

- No copy, no paste, no second tab.
- Several pieces from one page at once, compared on the same photo of her.
- She can leave. The work finishes without her and tells her when it is done.

**What it must respect**

- It reads a page only when she clicks, never in the background, and never pages that are not
  shops. The permission it asks for says exactly this.
- A batch counts one try-on for each piece and shows the count before she confirms.
- Notifications are sent only for renders she asked for. Email is opt-in, as already built.

### 6.5 How do we use it to get her to share?

- **The side panel has "Send this piece to a friend"** on each result, which opens the same link
  flow on the friend's phone.
- **A compare link.** "Which of these three?" from a batch becomes one ask with three pieces,
  which is the vote page's strongest form.
- **The Web Store listing is itself a channel:** ratings and a short, honest description.
- **Measure:** installs per laptop visitor offered it, pieces tried per session against the link
  flow, and asks created from batches.

### 6.6 What it needs

The engine and everything in Journey 1. A browser extension with a side panel and a
per-store reader for the first ten stores people actually bring (chosen from Phase 1's data, not
guessed). Browser notifications. Email switched on for the "you've left" case. A review by the
Chrome Web Store, which takes days and can refuse broad permissions.

### 6.7 It is working if

- People with the extension try twice as many pieces per session as people pasting links.
- Fewer than one in ten turn the nudge off for a site in the first week.
- Paid conversion among extension users is higher than among link users.

---

## 7. Journey 3: share from Instagram

*Phase 3. The cheap Android version can come earlier; the iPhone version needs a native app.*

### 7.1 What customer problem are we solving?

She sees a piece in her feed, on a creator, in a story, in an ad. There is often no link, or the
link goes to a brand's home page. By the time she finds the piece on a store's site the impulse
is gone. She has a picture in front of her and nowhere to take it.

### 7.2 Why is it worth solving, and why now?

- It is where the wanting happens. Instagram is the place younger shoppers most often name for
  finding new brands.[^social]
- It is the only journey where a session starts because of something she saw, not because we
  reminded her (main PRD §9.1).
- Each share tells us what people want: this label, this piece, today.
- **Why not first:** it is the hardest picture to work from (§2.1), a web app cannot appear in the
  iPhone share sheet at all, and the main PRD's own bar for starting is a measured eval on real
  screenshots (§9.6 there). Starting before the engine is proven on easy pictures would be
  building the hardest case first.

### 7.3 Where will she discover it?

**In the product**

| Place | What she sees |
|---|---|
| The paste field (from Phase 1) | "…or add a screenshot." This already serves the journey, with two extra taps. |
| After her second try-on, on Android | "Add Trailroom to your home screen to share screenshots straight to it." Installed, it appears in the share sheet. |
| After her second try-on, on iPhone | "Screenshot it, then open Trailroom: your latest screenshot is ready to try." One tap opens the photo picker on recent screenshots. The honest version of what a web app can do there. |
| A first-run tip on the result | A three-second loop of the gesture. |

**In Instagram ads**

This is the journey Instagram ads are made for, because the ad can show the gesture inside the app
she is in.

- **The hook:** a story or Reel that looks like the feed. A creator in a coat. A screenshot. The
  share sheet. The coat on a different, ordinary person in her own room.
- **The line:** "Screenshot it. See it on you."
- **The button:** "Try it on", to a page that asks for a screenshot first and an account second.
- **A second creative,** for trust: the label's photo beside a real person's render, including one
  honest miss (main PRD §11.5).
- The same limits as §5.3 on words and claims. The person in the "before" picture must have agreed
  to be in the ad; a stranger's post is not ad material.

### 7.4 How does the product solve it, and how is her life better?

**The flow**

1. She screenshots a post, or shares an image from it.
2. On Android with Trailroom installed: Trailroom is in the share sheet. On iPhone, and for
   everyone else: she opens Trailroom and taps "Use my latest screenshot".
3. The screen shows the screenshot with the garments it found outlined. She taps the piece she
   means. Buttons, captions and other people are ignored.
4. The safety checks run (§2.2). The person in the screenshot is never rendered and never used as
   an identity. Only her own photo is.
5. Front renders. The result offers the same actions as Journey 1, and one more: **Find it**,
   which searches for the piece by its description, because a screenshot has no store to go back
   to. If we cannot find it we say so.

**What is better for her**

- The picture she already has becomes the answer, in the minute she still wants the piece.
- She does not have to hunt for a product page first.
- She learns whether it is worth hunting for.

**What it must respect**

- Screenshots are kept only as long as it takes to find the garment, then deleted (main PRD
  §9.5).
- A render from a screenshot will be wrong more often. The result says "from a screenshot, so
  details may differ" beside the AI label, and the failure screen does more of the work.

### 7.5 How do we use it to get her to share?

- **It is already half a share.** She took the screenshot to show someone. "Ask friends" on this
  result is the natural next tap, and the vote page shows the screenshot's piece beside her
  render.
- **"Send this piece to a friend"** carries the garment image, so the friend can try the same
  piece from the same post.
- **Back to Instagram, by her choice only.** If image export is allowed (§11), a result can be
  saved as a card she can post to her story or send in a message. Nothing is posted for her.
- **Creators.** A creator's audience screenshotting her outfit is the loop working. Give creators
  a link that opens Trailroom with the pieces from one post queued, and a share of what their
  links bring.
- **Measure:** share-sheet try-ons per active person per week, the share that reach a shown
  render, asks per screenshot try-on, and "Find it" taps that reach a store.

### 7.6 What it needs

The engine, hardened on screenshots. A garment-outline step with tap-to-choose. The safety
classification. An installable web app with a share target (Android). For iPhone: either the
"latest screenshot" shortcut only, or a native app with a share extension, which is a separate
and much larger decision. An eval set of real screenshots.

### 7.7 It is working if

- At least six in ten screenshots end in a render she is shown. Under five in ten, the journey
  stays as "add a screenshot" inside Journey 1 and no more is built.
- People who use it come back without being reminded, at a higher weekly rate than people who
  only paste links.

---

## 8. Journey 4 (alongside): a plugin for stores, with "Sign in with ChatGPT"

*Not a build yet. A question to OpenAI and a test, run beside the phases above.*

### 8.1 What customer problem are we solving?

**The store's:** shoppers cannot picture a piece on themselves, so fewer buy and more send things
back. A return on a $100 order costs the store about $30.[^returns] Try-on apps exist for stores,
but the store pays for every image whether or not it leads to a sale.

**The shopper's:** the same question as everywhere else in this document, and a new account at
every store that offers an answer.

### 8.2 Why is it worth solving, and why now?

- The store has the budget and a number that moves: conversion up, returns down. A store will pay
  a monthly fee for that where a shopper hesitates over $20.
- "Sign in with ChatGPT" lets a person use her own ChatGPT allowance inside another product. If
  that covers images, the cost of a try-on moves off the store and off us. That would remove the
  one constraint every section of this document works around.
- It is new. Being early in a new sign-in system is worth more than being late in a crowded app
  store.
- **Why not a build yet:** it is a programme one applies to. The launch partners were mostly
  developer tools. It is not confirmed that a shopping app would be accepted, or that image
  generation is covered. It would mean rendering on OpenAI's image model, whose handling of faces
  and garments we have not tested. And store try-on apps are already numerous at $20 to $200 a
  month.

### 8.3 Where will they discover it?

**The store owner**

| Place | What they see |
|---|---|
| Their platform's app store | A listing: what it does, a live demo on a sample store, the price. |
| Their own shoppers | Once Journeys 1 and 2 run, we know which stores people bring most. Those owners get a short note: "People tried on 340 of your pieces last month. Here is what they tried." This is the warmest introduction we will ever have, and it needs no ad. |
| Instagram ads | Weak for reaching store owners. If used: a short clip of a product page with the button, aimed at people who run online stores, ending in a demo booking. Not the first channel. |

**The shopper**

| Place | What she sees |
|---|---|
| The store's product page | A "See it on you" button beside the photos. |
| Trailroom itself | "Works on these stores" in her account. Her photo is already there. |
| Instagram ads | None of ours. The store's own ads can show the button. |

### 8.4 How does the product solve it, and how is life better?

**The flow for a shopper**

1. On a product page, she taps "See it on you".
2. First time: she signs in (with ChatGPT if that route exists, or with her Trailroom account) and
   adds a photo. Every time after, on any store with the plugin: one tap.
3. The Front pose renders in a panel on the page. She can ask for more poses, or add the piece to
   her cart.

**For the store:** more of the people who look, buy, and fewer send it back. Install is a few
clicks, the button takes the store's own product photos, and a dashboard shows try-ons, add-to-cart
after a try-on, and which pieces people tried and did not buy.

**For the shopper:** one photo, kept in one place she controls, working across stores.

**What it must respect**

- The store never receives her photo or her renders. It learns counts, not people.
- The consent she gave is to Trailroom, and the screen says who holds the photo.
- No fit or size claim, however much a store asks for one.

### 8.5 How do we use it to grow?

- **Every store's traffic becomes ours.** A shopper who adds a photo on one store has a Trailroom
  account, and can use the link flow everywhere else.
- **"See it on you, by Trailroom"** on the button and the panel is a quiet, constant introduction.
- **Stores ask for it.** A shopper who has used it on one store misses it on the next. Give her a
  one-tap "Ask this store to add it", which sends the store's owner the note in §8.3.
- **Measure:** shoppers who first met Trailroom on a store and later used it elsewhere; stores
  installed per month; a store's conversion with and without the button.

### 8.6 What to do now

1. Fill in OpenAI's developer interest form. Ask directly: is a consumer shopping app eligible, and
   is image generation covered by a person's plan?
2. With an OpenAI API key, render the baseline set (§9, Phase 0) on OpenAI's image model and
   compare it with ours on face and garment.
3. Decide after both answers. If either is no, the store plugin can still be built with the store
   paying for images, and it then competes on quality and price alone.

---

## 9. Phasing, and the gate between each phase

| Phase | What ships | The gate to pass before the next phase |
|---|---|---|
| **0. The baseline** (M1, small version) | No feature. A test set of about a dozen real garment pictures of each kind in §2.1, rendered on about ten people, labelled by the owner with a second reader. A baseline share of acceptable renders by kind of picture and by pose, a calibrated face check, and a first garment check. | Clean product photos: at least 7 in 10 acceptable. If under 5 in 10, stop and fix the engine before building a journey on it. |
| **1. Paste a link or add an image** | The engine (§2), Front-first (§3.2), the paste field, found pieces, "Send this piece", the paywall, analytics. | §5.7. And enough laptop use to justify Phase 2: at least a quarter of pasted links coming from a computer. |
| **2. The Chrome extension** | The extension for the ten most-brought stores, the side panel, batches, notifications. Email switched on. | §6.7. |
| **3. Share from Instagram** | The installable web app with a share target on Android, the "latest screenshot" shortcut on iPhone, garment outline and tap-to-choose, safety classification. | §7.7 decides whether a native app is worth building. |
| **Alongside: stores and ChatGPT sign-in** | The form, the model comparison, then a decision (§8.6). | Both answers from OpenAI and the comparison. |

**Why this order**

1. **The link flow builds the engine the other three need,** on the easiest pictures first.
2. **It is the only one that reaches a phone on day one** with nothing to install.
3. **Each later phase is chosen by what the earlier one measured:** which stores people bring
   decides the extension's first ten; how screenshots fare decides whether Instagram sharing is a
   feature or a native app; where people come from decides which store owners to write to.
4. **The cost of being wrong rises down the list.** The link flow is days. The extension is a
   store review and upkeep. A native app is a new product.

**Already done, and assumed here:** an account is required to start a try-on; the face check is
live at 50%; two or three good poses are shown.

---

## 10. What we will measure

There is no analytics in the product today. Phase 1 adds it, with no personal data in the events
beyond the account id.

| Question | Measure |
|---|---|
| Does the engine work? | Share of brought pieces that end in a shown render, by kind of picture and by store. |
| Is it good? | The owner's labelled baseline, re-run on every model or prompt change. Face-check pass rate by pose. |
| Do people want it? | Pieces tried per person per week. Second try-on in the same sitting. Return visits without a reminder. |
| Will they pay? | Share of people who use the free try-ons and pay. Months kept. Try-ons used of the 100. |
| Does it spread? | Shares per try-on, by kind (ask, piece, invitation). New accounts per active person per month. |
| Does it pay? | Render cost per paying person per month against $20. The share of try-ons opened to four poses. |

**Stop and rethink if,** after 500 people have used the free try-ons in Phase 1: fewer than 1 in
50 pay, or fewer than half of pasted links end in a shown render, or the render cost per paying
person is above $10 a month.

---

## 11. Risks and open questions

**For a lawyer, before Phase 1 goes public**

1. **Using a store's photographs.** We fetch a product photo and make a private picture for one
   person. That is not republishing, but it is a question of copyright and of each store's terms,
   and fetching pages a store has tried to block is a second question.
2. **Screenshots of other people.** The person in the screenshot did not agree to anything. We use
   the image only to find a garment and delete it. Whether that is enough is a legal question.
3. **Face comparison** is treated as biometric data under some laws (ADR 0007). It now runs on
   every render.
4. **A subscription** brings consumer rules of its own: clear price, easy cancelling, refunds.
5. **The consent line** was written for "your try-ons". It may need to name found pieces and
   sharing.

**For the owner to decide**

6. **May a render be exported as an image?** The hard rule keeps the AI label beside the image and
   out of its pixels. A saved file has no "beside". Options: no export; export as a card with the
   label in a caption strip under the image; export bare. This needs a decision and an entry in
   §22.1 either way.
7. **Does "Find it" exist** for screenshots (§7.4)? It is useful and is its own piece of work.
8. **Affiliate links.** "Go to the store" could carry one. That is revenue on top of the
   subscription, and a reason to disclose it.
9. **What happens to the catalogue** of twelve pieces. Keep it as the demonstration for a new
   visitor, or retire it once found pieces work.
10. **A native app,** which only §7 can justify.

**Risks to the plan**

| Risk | What we do about it |
|---|---|
| Renders are poor on unknown pictures | Phase 0 measures it before anything is built on it. |
| Large stores block us | The screenshot fallback, and the extension, which reads the page in her own browser. |
| A try-on costs more than planned (retries, four-pose opens) | Front-first, a retry cap, the Lite model if it passes the baseline. |
| People try the free five and leave | The paywall follows a result they liked. If it still fails, the price or the product is wrong, and §10 says when to stop. |
| The ad platform refuses the creative | No claims about the viewer's body, no before-and-after of a body, no "AI" hook. Use the label's photo against a consenting person's render. |
| OpenAI's programme is not open to us | Nothing depends on it. The store plugin can charge the store. |
| The server fetches something it should not | §2.4. Treated as a security requirement and tested as one. |

---

## 12. What we are not building

- A fit or size recommendation, in any journey, for any store.
- A public feed of renders, or any way a render is posted without her doing it.
- Rendering anyone but the account holder. No "put this on my friend".
- Shoes, bags, jewellery and accessories from found pieces. Clothing first.
- A marketplace or checkout. She buys at the store.
- A native app, until §7.7 says a web app is not enough.
- The store plugin, until §8.6 is answered.
- Reading her clipboard, her camera roll or a web page without a tap that asks for it.

---

[^returns]: Online clothing return rates of roughly 25 to 30%, the highest of any category, and a
    fully loaded cost near $30 per $100 returned: [Ringly, ecommerce return statistics
    2026](https://ringly.io/blog/ecommerce-return-statistics-2026); [ShipNetwork, return rates by
    industry](https://www.shipnetwork.com/post/return-rates-by-industry); [Eightx, the real cost of
    returns](https://eightx.co/tools/real-cost-of-returns-calculator). These are secondary sources
    found on 2026-10-12 and not checked against the original studies. Much of the cited cause is
    "fit", which this product does not claim to address; it addresses how a piece looks.
[^mobile]: Phones at about 62% of online clothing revenue in 2026, and desktop converting at about
    twice the rate of mobile: [Eightx, mobile revenue share by vertical
    2026](https://eightx.co/blog/average-ecommerce-mobile-revenue-share-by-vertical-2026);
    [Branvas, the mobile vs desktop conversion gap](https://branvas.com/blogs/news/mobile-vs-desktop-conversion-rate-gap).
    Secondary sources, not verified.
[^social]: Over half of Gen Z shoppers found inspiration for their last online fashion purchase on
    social media, and Instagram is the platform they name most for discovering brands:
    [MarketingCharts](https://www.marketingcharts.com/industries/retail-and-e-commerce-110385);
    [Cropink, Gen Z social media usage](https://cropink.com/gen-z-social-media-usage-statistics).
    Secondary sources, not verified.
