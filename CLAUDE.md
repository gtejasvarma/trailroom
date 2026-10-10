# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is right now

Trailroom (trailroom.ai) — virtual try-on: one photo, four poses (Front, Three-quarter, Walking,
Seated), garments from labels the user follows.
**The experience being built is the two aligned prototypes in `mocks/`** (`Trailroom Prototype.dc.html`,
`Trailroom Desktop.dc.html`; ADR 0005). They win on flow, layout and copy, and the PRD (v0.7) agrees
with them except where §22.1 says the build differs (no fit sentences, consent by a line under the upload controls, no live selfie
claim, no email sent yet, an outfit does not also become two try-ons). The plan is `docs/BUILD_PLAN.md` §12, Phases A to H.
**The demonstration was Friday 9 October 2026 and has passed. V0 (Phases A, B and C) is built and deployed**
behind the password at `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app` (`a5b7918`, `f3ab209`,
`2f11325`), and real try-ons have been generated on the hosted site.
**Phases D, E and F are built, tested and pushed to `main`** (`328725a` lists, asks and the public vote
page; `0ef59a4` You and Studio, Compare, Buy; `1c52f77` outfits). Phase D is deployed. E and F wait
on a manual rules deploy and rollout by Tejas (`docs/DEPLOY.md`). **Phase G (the follow loop and real email)
and Phase H (hardening) are not started.** No email is sent anywhere yet.

Where things stand: M0 is done. M2 + M3 (the pipeline, the Cloud Workflow) are deployed and
carry over; their original screens and catalogue were replaced in Phases A to C. **M1 (the eval) is unfinished**: the QA gate in `packages/pipeline` is structural
only, and its identity, proportion, garment and cross-pose checks are empty slots until M1 supplies
them (ADR 0004). Known issue: `scripts/live-smoke.ts` imports `apps/web/src/server/consent`, which no
longer exists, so it does not run; `scripts/outfit-smoke.ts` is the working live script.

Firebase/GCP project: `virtual-tryon-tejas` (reused from an earlier attempt at this product — see
`docs/decisions/0001-reuse-firebase-project.md`). This is production. See Hard rules below.

## Commands

- `npm run verify` — prettier --check + tsc --noEmit across the repo. Must be green before any turn ends.
- `npm run format` — prettier --write across the repo.
- `runs/diag.sh` — local, git-ignored. **The first thing to run when a try-on fails on the deployed site:** it prints the latest job's per-pose reasons, the server-side error detail and the spend log.
- `npm test` — unit tests. `npm run test:emu` — tests against the Firebase emulators. `npm run test:e2e` —
  Playwright against a dev server and the emulators. Prefix the last two with `caffeinate -i` on a Mac.
  All tests use a fake render provider; nothing here calls the image model.

## Document map

| Path | What it is |
|---|---|
| `docs/PRD.md` | The PRD (v0.7) — source of truth for product behavior, one consistent document. §22 holds the decisions and their reasoning (§22.1 is the record; §22.2 says which phase built each journey). §6 data model, §13 unit economics, §16 architecture, §17 kill criteria. |
| `mocks/Trailroom Prototype.dc.html`, `mocks/Trailroom Desktop.dc.html` | **The visual specification.** The aligned, runnable prototypes (mobile, desktop): the target with the §22.1 decisions applied. Open directly in a browser; images in `mocks/assets/`, reference screenshots in `mocks/screens/`. Read the matching screens before writing any UI. |
| `docs/Design.md` | Tokens, type and motion. Derive every value from §11, do not invent tokens. Layouts come from the prototypes, not from here. |
| `docs/BUILD_PLAN.md` | §12 is the current plan (Phases A to H) and its three process rules. §1 to §11 are the earlier ladder and the reasoning behind M0 to M3. |
| `docs/decisions/` | ADRs — one file per irreversible call. Write one when you make a call like this. |
| `specs/` | One file per unit of work being built. |
| `mocks/support.js`, `mocks/Trailroom Desktop Designer.dc.html`, `mocks/Conversion Audit.dc.html` | The runtime that makes the `.dc.html` files run outside the Claude Design canvas. The Designer file is the reference for the deferred back office; the Audit is a 44-item conversion audit. `support.canvas.js` is the real Claude Design export — reference only, requires `window.React`, won't run standalone. |
| `packages/render/` | The one chokepoint for image-model calls: model/price table, the prompts (`edit-v1` for one piece, `outfit-v1` for two pieces in one image), the spend ledger interface, and a fake provider for tests (refused in production). |
| `packages/db/` | The one place that talks to Firestore and Cloud Storage: typed repositories and the Firestore-backed daily spend ledger. `merge.ts` moves a guest's things into an existing Google account at sign-in; `usage.ts` holds the daily try-on counts per uid, which removing a try-on never resets ("Delete everything" removes the sign-in, so the person returns under a new uid with a fresh count). |
| `packages/pipeline/` | M3: the render graph's nodes, the QA gate, the routing policy, and the inline orchestrator used by local dev and tests. |
| `packages/catalog/` | The demo catalogue and the copy rules. `assets/` holds the garment images that get copied to Cloud Storage; `assets/prototype/` holds the prototype's images (cleared by Tejas, ADR 0005) for the Phase A catalogue. |
| `workflows/render-pose-set.yaml` | M3: the Cloud Workflow that drives the graph in production by calling `/api/internal/pipeline/*`. |
| `firestore.rules`, `storage.rules` | Clients read their own job, pose set and consent; they write nothing; Storage is closed to clients. Lists, asks (with votes), inbox entries and purchases are server-only, with explicit denies. |
| `docs/DEPLOY.md` | The manual deploy runbook. Read before changing anything deploy-related. |
| `packages/render-eval/` | M1: the eval harness. `npm run eval:generate -- --dry-run` plans a run; drop `--dry-run` to generate into `runs/<run>/`. |
| `fixtures/` | Eval inputs: `manifest.json` (committed), `CONSENT.md`, images (git-ignored; repo is public). See ADR 0002. |
| `apps/web/` | The product: Next.js on Firebase App Hosting, behind the password (Phases A to D deployed; E and F built, awaiting rollout). `src/server/` holds the logic behind the route handlers; all UI strings live in `src/lib/copy.ts`. The only route outside the password gate is the public vote page `/ask/[token]` and the API under `/api/ask/[token]`. |
| `scripts/` | `outfit-smoke.ts` renders real outfits against the image model (spends money); `seed-catalog.ts`; `live-smoke.ts` is broken (see above). |
| `tools/label.html` | Standalone contact-sheet labeler for eval error analysis (BUILD_PLAN §2.2c) — `j`/`k` to navigate, `1`/`0` to label, writes JSONL. Open directly in a browser. |
| `archive/prototypes-2026-10-07/` | The verbatim extracted source of the two linked prototype artifacts. Provenance only; the aligned versions in `mocks/` are the spec. |
| `archive/` (rest), `archive/mocks-v0.6/` | Superseded docs and the earlier v0.6-edited mocks. Provenance only, not current guidance. |

## Hard rules — violating these is a bug, not a style preference

- **Never emit fit or size language.** No "hits mid-calf on you", no "runs small", no hem advice. We
  render how a piece looks; we make no claim about fit. (PRD Principle 3, and a legal posture — §15.)
- **Never alter body proportion.** No slimming, lengthening, smoothing, or "enhancing" — not a feature,
  not a default, not a model parameter. The proportion guard in the QA gate is non-negotiable. (Principle 2.)
- **Consent line on every upload surface.** Every surface that can take a photo shows, directly under
  the upload control, "By adding a photo you confirm you're 18 or over and agree to it being used to
  make your try-ons." The server records consent (version, time) with each upload and refuses an upload
  that does not carry the current consent version. No tick, no separate consent screen (§22.1 row 2;
  Tejas, 2026-10-07). Weaker evidence than a tick: it is a question for the legal review.
- **Never claim a check the product doesn't perform.** No copy about a live-selfie match, age
  estimation or any other safeguard unless the code does it; and in V0 no copy promises an email,
  because none is sent. (§22.1 rows 3 and 10.)
- **No render ships that failed QA.** No "show it anyway" flag, no debug bypass that can reach a user.
  (Principle 1, §10.3, C6.)
- **Every rendered image is shown with a visible AI label beside it**, never drawn on the image
  itself. No in-pixel label, for guests or anyone (Tejas, 2026-10-07, overriding PRD §15 — see
  ADR 0004). SynthID is present but is not the visible label.
- **Never train on user photos.** Opt-in only, and that path doesn't exist yet, so the answer is always no.
- **Never call an image model outside `packages/render`.** One chokepoint, so the cost meter and the
  daily render cap cannot be bypassed.
- **Never touch project `virtual-tryon-tejas` via `gcloud`/`firebase deploy`.** Production deploys are
  manual, run by Tejas. The `PreToolUse` guard blocks these; don't route around it.

## Design system — non-negotiable, from `docs/Design.md`

1. **Colorless surround.** Try-on imagery sits only on `--canvas` (white) or `--ink` (near-black) —
   never a tint or gradient. Accent color (teal) is for state/identity only, never a fill next to a garment.
2. **Place, layer, interrupt.** Prefer routed screens ("Place") over modals/sheets ("Layer") or
   system-popups ("Interrupt"). Exceptions: the sheets the prototypes use (§22.1 row 14), the OS share
   sheet, the OS photo picker, and the Google sign-in popup.
3. **Low stakes.** Discarding a try-on is a satisfying, visible gesture. Accounts keep try-ons until the
   person removes them; guests who never sign up are purged (§22.1 row 16). Nothing is broadcast without
   an explicit user act.

## Working conventions

- **Show it before building on it.** A UI phase ends with screenshots beside the prototype at 390 and
  1440 px, and the next phase waits until Tejas has seen them (BUILD_PLAN §12.1).
- Non-obvious product or design calls get written down with reasoning, matching PRD §19–21's style — an
  ADR in `docs/decisions/` for irreversible calls, inline reasoning otherwise.
- `archive/` is provenance, not reference — don't pull current guidance from it.
