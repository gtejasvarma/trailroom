# 0004 — Build M2 and M3 before M1's exit gate

Status: accepted, 2026-10-06

**Later changes.** `0005-realign-to-the-prototypes.md` (2026-10-07) changed what is built on top of
this ADR, not its four calls. Where it changes something said below, a pointer says so: a guest
no longer sees the result at full size (account to open), the screens and the catalogue are
replaced, sheets are allowed where the prototype uses them, and no email is sent in V0.

## Decision

Build and deploy the vertical slice (M2) and the render graph (M3) now, with M1 (the eval) at
roughly day 3 of 10 and its exit gate unmet. Four calls follow from that.

1. **The slice ships with a minimal QA gate.** Deterministic checks only: an image came back, it
   decodes, it is the right size and aspect, it is not blank, it is not the input photo. The
   identity, proportion, garment-fidelity, artifact and cross-pose checks from PRD §10.3 exist as
   slots that report `skipped`.
2. **The image model is called with a Gemini API key**, through `packages/render`, with the key in
   Secret Manager. Not Vertex AI, which BUILD_PLAN §8.1 specifies.
3. **Graph nodes are route handlers on the one App Hosting service**, called by Cloud Workflows
   with OIDC. Not one Cloud Run service per node, which BUILD_PLAN §5 sketches.
4. **Model is Nano Banana 2.1 at 1K with a $5/day hard cap**, both config.

`0003-render-routing.md` stays reserved for the end of M1.

## Context

BUILD_PLAN §1 orders the ladder M1 → M2 → M3 because the product has a kill criterion nobody has
measured: whether one identity holds across four poses, evenly across strata. Tejas chose to build
the product shell first, to have a deployed system to show, and to finish M1 afterwards.

## Reasoning

- **Why this is survivable.** The slice is password-gated to Tejas and a few friends. Nothing the
  unmeasured bet could invalidate is hardcoded: pose list, model, tier and pose strategy are
  config, and the QA gate is an interface with empty slots. If M1 lands on two poses or on chained
  generation, that is a config and prompt change, not a rewrite.
- **Why a minimal gate does not break "no render ships that failed QA".** Every render still passes
  a gate before it is readable, and the honest-failure path is complete. What the gate cannot do
  yet is catch a render that looks like someone else or changes a body. The password circle is the
  mitigation, and the job record says which checks were skipped so the gap is visible.
- **Why the API key.** `packages/render` already works this way and two eval runs prove it. Vertex
  buys CMEK, residency and VPC-SC, which matter when strangers upload photos and don't matter for
  a handful of consenting friends. Paid-tier key, `store: false` on every call.
- **Why one service.** One deploy, one cold start, one set of secrets. The node boundary is the
  HTTP contract the Workflow calls, so moving a node to its own service later changes a URL.
- **Why Nano Banana 2.1.** Google's docs list it as the current workhorse image model at $0.0336
  per 1K image, half of Nano Banana 2. The `pilot-01` and `test-01` runs used Nano Banana 2, so
  identity quality on 2.1 is unmeasured.

## Amendment — 2026-10-07: no in-pixel AI label

Tejas decided that renders carry no label drawn on the image: it makes the product's one output
look worse. This overrode what PRD v0.6 said in §15 and §7 C1 ("in-pixel AI label baked into guest
renders"). PRD v0.7 (§15, §22.1 row 15) and the matching hard rule in `CLAUDE.md` now say the same
thing: a visible AI label beside every render, never on it.

What remains: a visible caption next to each render in the product, and the SynthID watermark
that every Nano Banana output already carries.

What this gives up, knowingly: the earlier PRD §7 C1 leaned on the in-pixel label to contain the
"screenshot leak" — a guest screenshotting an ungated render. (ADR 0005 shrinks the leak: a guest
now sees only tile-sized images and opens the full render with an account.) A screenshot or a saved image now carries no
human-readable sign that it is AI-generated; only SynthID, which needs a detector. Whether a
visible caption alone meets AI-disclosure rules where the product launches is a question for the
same legal review as BIPA, below.

## Amendment — 2026-10-07: what the review passes changed, and what they left

Three read-only reviews (privacy, cost, spec) ran against the finished build. Their findings were
fixed in the same session; the spec and `docs/DEPLOY.md` carry the detail. Calls worth recording:

- **Per-person limits exist now.** Guests get 2 try-on starts a day, signed-in users 5 (PRD §10.2
  Tier A). Without them one person behind the password could drain the daily cap. Failed sets
  count, and deleting your photo does not reset the count.
- **Spend is recorded conservatively.** A call that fails or dies mid-flight settles at its
  estimate, not zero, because Google may have billed it. The ledger can therefore read slightly
  high. It should never read low. *(Narrowed on 2026-10-08, see the amendment below: a provider
  rejection with a 4xx status settles at zero.)*
- **Google sign-in opens a popup.** Design rule 2 lists system popups as "Interrupt" and allows
  only the share sheet and the photo picker. The account sheet is sanctioned by PRD §21.1; the
  Google popup inside it is a third exception, accepted because a redirect flow loses the render
  the person is looking at. (ADR 0005 / PRD §22.1 row 14 later sanctioned the prototype's sheets
  generally; the Google popup stays a separate exception in `CLAUDE.md`.)

Known and not fixed:

- **Anonymous sign-in is free.** Nothing ties a guest to a device, so one person behind the
  password can create many guests, each with its own daily allowance. The daily cap still holds.
  App Check or a per-device limit is the fix, owed before the gate comes off.
- **The password gate's rate limit is per server instance** and trusts a forwarded-IP header.
  Cloud Armor is the real control.
- **Upload safety filters** (Design.md §12: "day one") are not built.

## Amendment — 2026-10-08: the first real run on the deployed site

The first try-on on the deployed site (Phase C) failed. Every image-model call was refused with
HTTP 402, because the API key in use was not on an account with billing for the image model. The
Cloud Workflow itself ran correctly from start to finish; what it reported was the failure. Three
things changed in Phase C because of it:

1. **A provider failure is not a quality failure.** A set whose every attempt failed on the
   provider's side now fails as `internal` ("something went wrong on our side"). It used to fail as
   `render_failed`, the screen that says we could not render the piece honestly, which blamed the
   garment for a fault that was ours.
2. **A rejected call costs nothing.** A provider rejection with a 4xx status was refused before any
   generation, so it settles at zero against the daily cap. Timeouts and 5xx responses still settle
   at the estimate. This narrows the conservative rule in the 2026-10-07 amendment and nothing
   else.
3. **Each failed model call is logged once, with its status.** The first run had to be diagnosed
   from the spend log and the per-pose reasons; the status is now in the server's logs too
   (`runs/diag.sh`, local and git-ignored, prints all three; `docs/DEPLOY.md`).

The key was replaced on 2026-10-08 with one verified by a single real image call; the secret is
`GEMINI_API_KEY` version 2. **As of 2026-10-09 no successful render has been observed on the
deployed site.** Seeing one is the first item of the smoke test.

## Owed before the password gate comes off

- [ ] App Check or a per-device guest limit; Cloud Armor in front of the gate
- [ ] Upload safety filters (Design.md §12)
- [ ] A legal view on AI-content disclosure with a caption beside the render and nothing drawn on it, and on consent by notice (a line under the upload controls instead of a tick, PRD §22.1 row 2, §22.5 question 6) under BIPA and similar statutes
- [ ] M1's exit gate, and the real scorers in the gate's empty slots
- [ ] The live-selfie face match (PRD §15; deferred, not dropped, PRD §22.1 row 3)
- [ ] BIPA reviewed by someone qualified (BUILD_PLAN §7)
- [ ] Vertex AI in place of the API key
- [ ] The three follow-ups in ADR 0001 (billing, leftover data, sole IAM owner)
- [ ] A successful real render observed on the deployed site, with the spend documents checked (`docs/DEPLOY.md` smoke test). Not done as of 2026-10-09.
- [ ] The full end-to-end suite run to green after the final Phase C fix (last full run: 234 of 235), and a camera upload shown to succeed, which the tests do not guarantee (the fake camera frame can be rejected for size)
- [ ] Automatic rollouts on push working, or the manual rollout step accepted as policy (`docs/DEPLOY.md`)
- [ ] The old Firebase Hosting site from the earlier attempt checked, and taken down if it is still up

The image-rights question that ADR 0005 first added here is answered (the owner cleared the
catalogue images, 2026-10-07) and is not owed.

## Consequence

The deployed product makes no quality claim the eval has not earned. Anyone reading the code or a
demo should be told that the gate is structural, not perceptual, until M1 lands.
