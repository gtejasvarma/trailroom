# Trailroom

Try fashion products without leaving your couch. One photo of you, and every piece
from the labels you follow comes back on your body — in four poses (Front, Three-quarter,
Walking, Seated) — before you buy.

**Where it stands (2026-10-12).** The demonstration on Friday 9 October has passed. Phases A to G, the fixes of a security review and a redesign of 2026-10-11 are built, tested, on `main` and **rolled out** (commit `9d5694d`, completed 2026-10-11). **The site is live and public at `https://trailroom.ai`, with no password** (the `hosted.app` address, `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`, keeps working and must). The owner removed the shared password in the same release as the redesign: `GATE` is `"off"` in `apps/web/apphosting.yaml` and the site can be indexed by search engines. That was accepted with the eval (M1), a guest-abuse control, upload safety filters and the legal review still open; putting the password back is changing `GATE` and one rollout (`docs/DEPLOY.md`, "The password gate"; `docs/decisions/0004-m2-m3-ahead-of-m1.md`, amendment of 2026-10-11). Real try-ons have been generated on the hosted site. Whether `trailroom.ai` has been added to Firebase Authentication's authorised domains (Google sign-in needs it) is not recorded here; check `docs/DEPLOY.md`, "Custom domain".
The redesign (`docs/decisions/0006-redesign-departs-from-the-prototypes.md`) follows the owner's review of the live
site and departs from the prototypes in six places, listed below.
**Two more changes, asked for by the owner on 2026-10-11, were rolled out on 2026-10-12 (commit `847e9ba`):** the "Pick three labels" step is gone (after uploading and signing up a person lands on "Your photo is in", four pieces to try on, one tap each; following stays on label and product pages), and the QA gate has a face check (a small Python service, `services/face-match/`, compares the face in each render with the person's photo; a poor match is not shown) with a new set rule: a four-pose try-on completes with two or three poses and fails with none or one. The owner deployed the face service on 2026-10-12 (a private Cloud Run service, `trailroom-face-match`) and the check is **on** in production with a minimum of 50%; one real four-pose try-on after the rollout passed all four poses, but that the identity result was recorded as passed is **not yet confirmed**. Its match score is uncalibrated (`docs/decisions/0007-face-check-in-the-qa-gate.md`).
**One more change, decided by the owner on 2026-10-12, is on `main` after the next commit and is not rolled out: an account is required to start any render** (PRD §22.1 row 44). A guest can browse, save to Favourites and upload a photo, but cannot start a try-on; pressing "Try it on" asks for a Google account, and once signed in the try-on starts by itself. The limit of two guest starts a day is gone (signed-in people get 5 a day). A try-on a guest made before this change still shows tiles and opens after sign-in until the guest is purged, about 48 hours after capture.
Phase G (the follow loop) ships with two switches, both off because they are undecided: email (nothing is sent
or shown) and the "arrives on you" buffer (nothing is rendered that a person did not ask for). Its checkpoint
is not met: nothing has been published on the hosted site, the buffer has never run with the real image model,
and no real email has been sent. Phase H (hardening) is partly done; the rest is not started.
**Being built, decided by the owner on 2026-10-17, not on `main`:** the result of a finished try-on becomes **the mirror** (`docs/decisions/0008-the-mirror.md`; PRD §22.1 rows 45 and 46): a light screen around the picture that comes into focus, turns once on its own and then turns as the person drags, with the choices Not for me, Ask a friend and Love it. It replaces the reveal described below. **Buy is hidden everywhere behind one switch until the owner turns it back on**, and the demonstration checkout with it.

What a visitor can do (the site is open to the public; the parts marked "redesign" were rolled out with `9d5694d`): a new visitor's first screen is the hero, a slider between a label's photograph of a piece and a real
render of the same piece on a fictional test person, labelled as an AI-generated preview; a visitor who already
has a photo goes straight to the feed (redesign). Browse Discover, which is one row of text tabs (Everything,
Apparel, Jewellery, Accessories) over large photographs, a column on a phone and two to four on a wide screen,
each with a heart that saves the piece to Favourites in one tap, as a guest too (redesign) (**without an account a visitor can browse, save to Favourites and upload a photo; starting a try-on needs an account**); product and
label pages with Follow; add several photos, by upload or the in-page camera, with a consent line under
the upload controls; start a try-on (this needs a Google account since 2026-10-12: a visitor without one is asked to sign in first, and the try-on then starts by itself) and keep browsing while it renders (a chip on every screen and a
ready toast); see a finished try-on for the first time as a short reveal, the label's photograph wiped into
you, then open a four-pose result with the AI caption, with a control to hold and see the
label's photograph (redesign) (a guest who signs in with an existing Google account has their photos, finished
try-ons and follows merged into it; a guest who made a try-on before 2026-10-12 sees tile-sized images only until they sign in); keep Favourites and named lists, ask friends from a list through a link that shows only
the pieces in the ask (the vote page needs no account; nor does the unsubscribe page, and neither is indexed), and read the votes in the app;
use You (phone) and Studio (desktop) with real counts and "Delete everything"; compare up to four tried
pieces on a wide screen; "Buy", which opens a demonstration checkout that takes no payment; and "Wear it
with", which renders two pieces together as one outfit image (the Front view) (in the current catalogue only the coat
pairs with anything); see a "New from labels you follow" section at the top of Discover when a followed label has published a piece (none has on the hosted site yet; pieces are published by a script, `scripts/publish-piece.ts`). **No email is sent or promised.** Jewellery and accessories cannot be tried on yet.
**Not done:** the quality checks of the eval (M1). The gate is structural except for the face check, which is on in production since 2026-10-12 and is uncalibrated; it still cannot tell whether a render changed a person's body or got the garment right. That is the most urgent open item, because the password is gone. **Next:** the owner rolls out the account requirement (`docs/DEPLOY.md`, "Rolling out"), and the identity result on a real job is confirmed with `bash runs/diag.sh` (`docs/DEPLOY.md`, "The face-match service"); the owner's two decisions (whether to send email, and whether to switch the
buffer on) and, for email, a provider key and sending address; then the rest of hardening (Phase H)
(`docs/BUILD_PLAN.md` §12).

## Running it locally

Local renders are coloured test images from a fake provider (nothing calls the image model), and local
Google sign-in is the emulator's simulated one.

```bash
npm ci
npm run test:e2e        # the suite, against a dev server and the emulators
npm run emulators:exec -- "cd apps/web && GATE_PASSWORD=local GATE_COOKIE_SECRET=local-only-cookie-secret RENDER_PROVIDER=fake ORCHESTRATOR=inline NEXT_PUBLIC_USE_EMULATORS=1 GOOGLE_CLOUD_PROJECT=demo-trailroom npx next dev --port 3000"
```

The last command previews the app at `http://localhost:3000`; the gate password is `local` (local development and the tests run with the password gate on; only the hosted site sets `GATE=off`).

## What's here

| Path | What it is |
|---|---|
| `docs/PRD.md` | **The PRD** (v0.7), one consistent document. §22 holds the decisions and their reasoning; §19 is the register of the original mock-vs-PRD audit. |
| `docs/Design.md` | **The design system of record.** Colour, type, space, motion, components, anti-patterns. Derive every value from §11 and do not invent tokens. |
| `docs/BUILD_PLAN.md` | How the PRD becomes shipped code. §12 is the current plan (Phases A to H; A to G, the 2026-10-11 redesign, the label-step removal and the face check are rolled out; the account requirement awaits a rollout). |
| `docs/SYSTEM.md` | How the whole system works, with diagrams: start here to understand or explain it. |
| `docs/DEPLOY.md` | The manual deploy runbook (Tejas runs it; agents do not deploy). |
| `docs/IDEAS.md` | Directions under consideration, with a recommendation. Nothing in it is decided. |
| `docs/PRD_TRY_ON_ANYTHING.md` | A draft of requirements for the next four journeys. Nothing in it is decided. |
| `docs/decisions/` | ADRs — one file per irreversible call (infra, vendor, architecture, scope). |
| `specs/` | Units of work — one spec file per increment being built. |
| `mocks/` | The two aligned, runnable prototypes (the visual specification, except for the six parts the 2026-10-11 redesign changed, ADR 0006), their images and screenshots, and two reference files. |
| `packages/`, `apps/web/`, `workflows/` | The render chokepoint, database layer, pipeline, catalogue, eval harness, and the Next.js app. |
| `services/face-match/` | The face check the QA gate calls: a small private Python service (deployed 2026-10-12 as `trailroom-face-match`, on in production; `docs/decisions/0007-face-check-in-the-qa-gate.md`). |
| `archive/` | Superseded documents and mocks, and the verbatim source of the two linked prototype artifacts. Provenance, not guidance. |

## Running the prototypes

Open `mocks/Trailroom Prototype.dc.html` (mobile) or `mocks/Trailroom Desktop.dc.html` (desktop)
directly in a browser. Images are in `mocks/assets/`; reference screenshots are in `mocks/screens/`.
They are the target prototypes with the PRD §22.1 decisions applied (no fit sentences, a consent line
under the upload controls, Google sign-in only, no promise of email). **They were not edited for the redesign of
2026-10-11**, so for the home page (hero and category row), the cards (what sits on an image, the heart, the grid)
and the result's first view (the reveal) they show the old version; ADR 0006 and PRD §22.1 rows 33 to 40 are the
specification for those. The reference screenshots in `mocks/screens/` still show the prototype's two-step onboarding and its email promises, which V0 does not have.

- `mocks/Trailroom Desktop Designer.dc.html` — the designer back office, a reference for a deferred
  milestone.
- `mocks/Conversion Audit.dc.html` — a 44-item audit of an earlier prototype.
- `mocks/support.js` is a standalone runtime written for this repo so `.dc.html` files run outside
  the Claude Design canvas. `mocks/support.canvas.js` is the real canvas export, reference only.

The two linked prototype artifacts the product was aligned to, and their extracted source, are
listed in `archive/prototypes-2026-10-07/README.md`.

## Where the decisions live

Every non-obvious call is written down with its reasoning, so it can be re-litigated with the
argument in view:

- **PRD §22** — the v0.7 realignment: the decisions in §22.1 (rows 33 to 40 are the 2026-10-11 redesign; row 44 is the account requirement of 2026-10-12), V0, and what is not being built
- **PRD §19–21** — the original audit, the imported design documents, and the signup and result
  decisions as they stand now
- **`docs/decisions/`** — ADRs, including 0004 (build order, QA gate), 0005 (realign to the
  prototypes) and 0006 (the redesign departs from the prototypes)
