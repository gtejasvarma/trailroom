# 0004 — Build M2 and M3 before M1's exit gate

Status: accepted, 2026-10-06

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
look worse. This overrides PRD §15 and §7 C1 ("in-pixel AI label baked into guest renders") and
the matching hard rule in `CLAUDE.md`, which now reads: a visible AI label beside every render,
never on it.

What remains: a visible caption next to each render in the product, and the SynthID watermark
that every Nano Banana output already carries.

What this gives up, knowingly: PRD §7 C1 leaned on the in-pixel label to contain the "screenshot
leak" — a guest screenshotting an ungated render. A screenshot or a saved image now carries no
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
  high. It should never read low.
- **Google sign-in opens a popup.** Design rule 2 lists system popups as "Interrupt" and allows
  only the share sheet and the photo picker. The account sheet is sanctioned by PRD §21.1; the
  Google popup inside it is a third exception, accepted because a redirect flow loses the render
  the person is looking at.

Known and not fixed:

- **Anonymous sign-in is free.** Nothing ties a guest to a device, so one person behind the
  password can create many guests, each with its own daily allowance. The daily cap still holds.
  App Check or a per-device limit is the fix, owed before the gate comes off.
- **The password gate's rate limit is per server instance** and trusts a forwarded-IP header.
  Cloud Armor is the real control.
- **Upload safety filters** (Design.md §12: "day one") are not built.

## Owed before the password gate comes off

- [ ] App Check or a per-device guest limit; Cloud Armor in front of the gate
- [ ] Upload safety filters (Design.md §12)

- [ ] A legal view on AI-content disclosure without an in-pixel label

- [ ] M1's exit gate, and the real scorers in the gate's empty slots
- [ ] The live-selfie face match (PRD §15)
- [ ] BIPA reviewed by someone qualified (BUILD_PLAN §7)
- [ ] Vertex AI in place of the API key
- [ ] The three follow-ups in ADR 0001 (billing, leftover data, sole IAM owner)

## Consequence

The deployed product makes no quality claim the eval has not earned. Anyone reading the code or a
demo should be told that the gate is structural, not perceptual, until M1 lands.
