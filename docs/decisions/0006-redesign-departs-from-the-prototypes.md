# 0006 — The redesign departs from the prototypes

Status: accepted, 2026-10-11

## Decision

Six parts of the interface now differ from the two prototypes in `mocks/` on purpose. The
prototypes were not edited. For these six, and for the home page's two photographs, **this ADR and
PRD §22.1 rows 33 to 40 are the specification, and the prototypes are not.** For everything else
ADR 0005 stands: the prototypes win on flow, layout and copy.

## Context

On 2026-10-11 Tejas reviewed the live site and named six problems. His terms, kept close:

1. The first load was wrong: the page appeared without the hero and then the hero pushed the
   products down, and a returning visitor saw the hero flash.
2. The category row (photo tiles, bordered chips, a rule, and the boxed "Start with these" section
   with its DEMO chip) was heavy and repeated itself.
3. Too much sat on top of the photographs: a "Model shot" chip, count chips, arrows.
4. Saving was two steps for a thing people do constantly, and a guest could not do it at all.
5. The images were too small.
6. The moment a try-on finished was a queue screen turning into a result, with no sense of
   arrival.

He asked for a redesign using the frontend-design skill and Emil Kowalski's design-engineering
skills. He reviewed the result locally the same day and approved it for production.

## The decision, per point

1. **First load.** The home page is decided on the server from a cookie, `tr_hp` ("this browser has
   a photo"; it holds nothing personal). A new visitor's first paint includes the hero; a returning
   one never sees it flash. The client corrects the cookie once it knows who the person is. The
   hero is full-bleed on a phone and two columns on desktop, with no entrance animation. The divider
   glides once per page load, and a touch of the slider cancels the glide.
2. **Category row.** One quiet row of text tabs (Everything, Apparel, Jewellery, Accessories) on
   phone and desktop. The photo category tiles, the bordered chips, the rule under them and the
   boxed "Start with these" section with its DEMO chip are gone from Discover. The demo-catalogue
   notice at the foot of Discover stays, and so does the starters screen shown after an upload.
3. **Image chrome.** Carousels show dots only. The "Model shot" chip, the count chips and the
   visible arrows are removed. "On you" is the only chip, and only on the person's own renders. On
   desktop a mouse pointer scrubs through the frames; the keyboard's left and right arrows work;
   previous and next buttons appear only when focused.
4. **Favourites.** One tap on the heart saves the piece to a default list, Favourites, and a toast
   offers "Change", which opens the list sheet (for a guest, the account sheet, because a guest has
   no other list to change to). Favourites is created on first use, is shown first, cannot be
   renamed or deleted, holds up to 200 pieces, and does not count against the limit of 30 other
   lists. Guests may hold Favourites and only Favourites. It carries into the account at sign-in by
   both paths (a guest who signs in with an existing Google account, and a guest who links one) and
   is purged with the guest. The heart sits on the image.
5. **Larger images.** On desktop the grid is 2 columns, 3 from 1100 px and 4 from 1700 px, with 3:4
   images. A phone has one full-bleed 4:5 column. A card is the image, the name and price, the label
   (with the stock line only when stock is low) and one compact action.
6. **The reveal.** The first sight of a finished try-on, once per job per browser (remembered in
   `localStorage`), for a signed-in person: on a near-black stage the label's photograph is wiped
   into the person's Front render, the other poses rise in under it with the AI caption visible, and
   one button leads to the result. Any tap, click, Escape, Enter or Space skips to the end, and the
   same inputs then leave the stage. Reduced motion gets a crossfade. The result gained a
   press-and-hold control that swaps the render for the label's photograph while it is held.

Two further changes came with the redesign:

- **A hard-rule gap was closed.** The "on you" card on Discover and the hero did not carry the
  visible "AI-generated preview" text that every render must have beside it. They do now.
- **The hero's two photographs are the same piece.** Before, the "on her photo" side was a label's
  photograph of a different coat, although the copy said it was rendered. It is now a real render
  made by this product (`scripts/hero-proof.ts`, prompt `edit-v1`, Front) of the pink wrap top on
  the AI-generated fictional test person s01, cropped and otherwise untouched; the other side is
  the label's photograph of the same top. The files are `proof-label.jpg` and `proof-on-her.jpg` in
  `packages/catalog/assets/prototype/`. It cost about $0.04.

## What is given up

- The prototypes are no longer the visual specification for the **home page** (the hero and the
  category row), the **cards** (what sits on an image, the heart, the grid), the **heart** (it saved
  by opening a list sheet) and the **result's first view** (there was no reveal). A reader who opens
  the prototypes to see what the build should look like will see the old version of these four.
- Design.md Rule 2 ("Place, layer, interrupt") gets one more full-viewport layer, the reveal, and a
  toast with an action. It is a layer the person can leave at any moment, and it appears only after
  they asked for the try-on.
- The reference screenshots in `mocks/screens/` are further from the build than before.

## Consequences

- PRD §22.1 rows 33 to 40 record the decisions with reasoning; §7 C1, C2 and C11, §22.2 and
  §22.5 questions 7 and 8 are corrected where they described the old behaviour.
- `CLAUDE.md` says the prototypes win except where ADR 0006 and §22.1 say otherwise.
- `docs/Design.md` gains the easing tokens and the motion rules the redesign uses.
- A new composite index on `lists` (`isGuest`, `expiresAt`) is needed by the guest purge, which now
  removes a guest's Favourites. It must be deployed with the rules before the rollout
  (`docs/DEPLOY.md` step 4). There is no rules change in the redesign itself.
- The cookie `tr_hp` is a new thing a visitor's browser stores. It says only that this browser has a
  photo. No privacy copy claims otherwise, and none needs to change.
- The catalogue's photographs were also replaced, the same day, with sharper ones (PRD §22.1 row
  40). The owner copied all 33 files to Cloud Storage on 2026-10-11.
- The AI-label rule in `CLAUDE.md` is unchanged, and its reach now includes the hero and the
  "on you" cards.
