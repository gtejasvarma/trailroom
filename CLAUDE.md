# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is right now

Trailroom (trailroom.ai) — virtual try-on: one photo, four poses (Front, Three-quarter, Walking,
Seated), garments from labels the user follows.
**The experience being built is the two aligned prototypes in `mocks/`** (`Trailroom Prototype.dc.html`,
`Trailroom Desktop.dc.html`; ADR 0005). They win on flow, layout and copy, and the PRD (v0.7) agrees
with them except where §22.1 says the build differs (no fit sentences, consent by a line under the upload controls, no live selfie
claim, no email sent, an outfit does not also become two try-ons). **The exception that matters most is the
2026-10-11 redesign (ADR 0006, PRD §22.1 rows 33 to 40), asked for and approved by the owner after he reviewed
the live site: the home page's first load and hero, the category row, what sits on an image, the heart and
Favourites, the image size and the reveal of a finished try-on no longer follow the prototypes. For those
six, the ADR and the rows are the specification.** The prototypes were not edited, so they show the old version
of those parts. The plan is `docs/BUILD_PLAN.md` §12, Phases A to H.
**The demonstration was Friday 9 October 2026 and has passed. V0 (Phases A, B and C) is built and deployed**
(behind the password when deployed) at `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app` (`a5b7918`, `f3ab209`,
`2f11325`), and real try-ons have been generated on the hosted site. On 2026-10-11 the owner connected
`trailroom.ai` to the same App Hosting backend (`docs/DEPLOY.md`, "Custom domain"); the `hosted.app`
address must keep working, because the Workflow and Scheduler call it.
**Phases A to G, the security fixes and the redesign are built and on `main`** (`328725a` lists, asks and the public
vote page; `0ef59a4` You and Studio, Compare, Buy; `1c52f77` outfits; `4ea213f` the fixes of the security review of
D to F; `a05f1ce` the follow loop; the redesign of 2026-10-11 on top of `fb4d8d6`). A to D are deployed. E, F, G, the
security fixes and the redesign wait on one manual rules-and-indexes deploy and one manual rollout by Tejas
(`docs/DEPLOY.md`); the redesign adds one composite index (`lists`: `isGuest`, `expiresAt`) and no rules change.
**The password comes off at that rollout** (owner's decision, 2026-10-11; PRD §22.1 row 41; ADR 0004, amendment): `GATE` is `"off"` in `apps/web/apphosting.yaml`, and after the rollout the site is open to anyone and indexable by search engines. This was accepted with the following still open and not done: M1 (the QA gate is structural and cannot tell whether a render looks like the person or changed their body), strangers using up the day's render budget (bounded by `DAILY_CAP_USD` of 5 and the per-person limits; real visitors are then told the service is at capacity until the next UTC day), anyone uploading a photograph of anyone including a minor (only the consent line, no check), in-memory per-instance attempt limits with the proxy-hop check not yet run on the hosted site (DEPLOY smoke test step 19, required straight after the rollout), and no legal review. M1 is now the most urgent open item. The gate code, its secrets and its tests stay; local development and the test suites run with the gate on (they do not set `GATE`); only exactly `GATE=off` opens the site, so putting the password back is changing `GATE` (or deleting the entry) and one rollout (`docs/DEPLOY.md`, "The password gate"). `/api/internal/*` is unchanged (OIDC).
The catalogue's photographs were replaced with sharper ones on 2026-10-11 and the owner copied all 33 files to
Cloud Storage. **Phase G ships with two switches, both off, because the owner has not decided either:**
`EMAIL_TRANSPORT` (default `none`: nothing is sent, nothing is recorded, and the product shows no email controls or
sentences; no real provider transport exists yet, so no email is sent anywhere) and `ARRIVALS_BUFFER` (default `off`:
no code path renders anything a person did not ask for; on, it pre-renders up to five Front cards per signed-in
account under the daily cap and a separate `ARRIVALS_DAILY_USD` ceiling, and needs a cost review before it is
switched on). Phase G's checkpoint is **not met**: nothing has been published on the hosted site, the buffer has
never run with the real image model, and no real email has been sent. Phase H (hardening) is partly done (the
security review and its fixes); the rest is not started.

Where things stand: M0 is done. M2 + M3 (the pipeline, the Cloud Workflow) are deployed and
carry over; their original screens and catalogue were replaced in Phases A to C. **M1 (the eval) is unfinished**: the QA gate in `packages/pipeline` is structural
only, and its identity, proportion, garment and cross-pose checks are empty slots until M1 supplies
them (ADR 0004). Known issue: `scripts/live-smoke.ts` imports `apps/web/src/server/consent`, which no
longer exists, so it does not run; `scripts/outfit-smoke.ts` is the working live script.

Firebase/GCP project: `virtual-tryon-tejas` (reused from an earlier attempt at this product — see
`docs/decisions/0001-reuse-firebase-project.md`). This is production, and from the next rollout the site is open to the public (no password). See Hard rules below.

## Commands

- `npm run verify` — prettier --check + tsc --noEmit across the repo. Must be green before any turn ends.
- `npm run format` — prettier --write across the repo.
- `runs/diag.sh` — local, git-ignored. **The first thing to run when a try-on fails on the deployed site:** it prints the latest job's per-pose reasons, the server-side error detail and the spend log.
- `npm test` — unit tests. `npm run test:emu` — tests against the Firebase emulators. `npm run test:e2e` —
  Playwright against a dev server and the emulators. Prefix the last two with `caffeinate -i` on a Mac.
  All tests use a fake render provider; nothing here calls the image model. `test:e2e` runs two Playwright
  projects: the main one, and `g-buffer.spec.ts` against a second dev server on port 3102 with
  `ARRIVALS_BUFFER=on` and `EMAIL_TRANSPORT=log` (its build directory is `.next-buffer`, set by `NEXT_DIST_DIR`).

## Document map

| Path | What it is |
|---|---|
| `docs/PRD.md` | The PRD (v0.7) — source of truth for product behavior, one consistent document. §22 holds the decisions and their reasoning (§22.1 is the record; §22.2 says which phase built each journey). §6 data model, §13 unit economics, §16 architecture, §17 kill criteria. |
| `mocks/Trailroom Prototype.dc.html`, `mocks/Trailroom Desktop.dc.html` | **The visual specification, except where ADR 0006 and PRD §22.1 rows 33 to 40 say otherwise.** The aligned, runnable prototypes (mobile, desktop): the target with the §22.1 decisions applied. Open directly in a browser; images in `mocks/assets/`, reference screenshots in `mocks/screens/`. Read the matching screens before writing any UI. They were not edited for the 2026-10-11 redesign, so for the home page (hero, category row), the cards (what sits on an image, the heart, the grid) and the result's first view (the reveal) they show the old version and the ADR wins. |
| `docs/Design.md` | Tokens, type and motion. Derive every value from §11, do not invent tokens. Layouts come from the prototypes (and from ADR 0006 where it departs from them), not from here. |
| `docs/BUILD_PLAN.md` | §12 is the current plan (Phases A to H) and its three process rules. §1 to §11 are the earlier ladder and the reasoning behind M0 to M3. |
| `docs/decisions/` | ADRs — one file per irreversible call. Write one when you make a call like this. |
| `specs/` | One file per unit of work being built. |
| `mocks/support.js`, `mocks/Trailroom Desktop Designer.dc.html`, `mocks/Conversion Audit.dc.html` | The runtime that makes the `.dc.html` files run outside the Claude Design canvas. The Designer file is the reference for the deferred back office; the Audit is a 44-item conversion audit. `support.canvas.js` is the real Claude Design export — reference only, requires `window.React`, won't run standalone. |
| `packages/render/` | The one chokepoint for image-model calls: model/price table, the prompts (`edit-v1` for one piece, `outfit-v1` for two pieces in one image), the spend ledger interface, and a fake provider for tests (refused in production). |
| `packages/db/` | The one place that talks to Firestore and Cloud Storage: typed repositories and the Firestore-backed daily spend ledger. `merge.ts` moves a guest's things into an existing Google account at sign-in; `usage.ts` holds the daily try-on counts per uid, which removing a try-on never resets ("Delete everything" removes the sign-in, so the person returns under a new uid with a fresh count). |
| `packages/pipeline/` | M3: the render graph's nodes, the QA gate, the routing policy, and the inline orchestrator used by local dev and tests. `published-catalog.ts` publishes pieces to Firestore and Cloud Storage and changes their prices; `script-guard.ts` makes operational scripts refuse a real project unless given its exact id. |
| `packages/catalog/` | The demo catalogue and the copy rules. `assets/` holds the garment images that get copied to Cloud Storage; `assets/prototype/` holds the prototype's images (cleared by Tejas, ADR 0005) for the Phase A catalogue. |
| `workflows/render-pose-set.yaml` | M3: the Cloud Workflow that drives the graph in production by calling `/api/internal/pipeline/*`. |
| `firestore.rules`, `storage.rules` | Clients read their own job, pose set and consent; they write nothing; Storage is closed to clients. Lists, asks (with votes), inbox entries, purchases, published pieces and their events, arrivals, and email preferences, sent-keys and unsubscribe tokens are server-only, with explicit denies. |
| `docs/DEPLOY.md` | The manual deploy runbook. Read before changing anything deploy-related. |
| `packages/render-eval/` | M1: the eval harness. `npm run eval:generate -- --dry-run` plans a run; drop `--dry-run` to generate into `runs/<run>/`. |
| `fixtures/` | Eval inputs: `manifest.json` (committed), `CONSENT.md`, images (git-ignored; repo is public). See ADR 0002. |
| `apps/web/` | The product: Next.js on Firebase App Hosting, open to the public from the next rollout (the password gate is switched off by `GATE=off` in `apphosting.yaml`; it was on for Phases A to D, which are deployed; E, F, G and the 2026-10-11 redesign built, awaiting rollout). `src/server/` holds the logic behind the route handlers (`arrivals.ts` the buffer and the new-arrivals shelf, `follow-config.ts` the two switches, `email/` the transports, templates and the email step); all UI strings live in `src/lib/copy.ts`. Outside the password gate, besides `/gate` and the OIDC-checked `/api/internal/*`: the public vote page `/ask/[token]` with the API under `/api/ask/[token]`, and the unsubscribe page `/unsubscribe/[token]` with `POST /api/unsubscribe/[token]` (`src/lib/gate-paths.ts`). |
| `scripts/` | `hero-proof.ts` renders the home page hero's proof photograph (one real render of a catalogue piece on the fictional test person s01, `edit-v1`, Front, about $0.04, ceiling $0.15; spends money); `upscale-catalog.ts` restores the small pose-set photographs at 896 x 1200 through `packages/render` (about $0.04 each, ceiling $1.50; reads the untouched originals from `runs/upscale/original/`, writes to `runs/upscale/out/`, both git-ignored; spends money); `outfit-smoke.ts` renders real outfits against the image model (spends money); `seed-catalog.ts`; `publish-piece.ts` publishes a piece to a label or changes a published piece's price (emulators by default; a real project only with `--allow-real-project <exact project id>`, and production runs are Tejas's to do by hand); `follow-loop-once.ts` runs the scheduled follow-loop step once against the emulators; `live-smoke.ts` is broken (see above). |
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
  itself. This covers the home page hero's "on her photo" render and the "on you" card on Discover
  (a gap in this rule was found and closed in the 2026-10-11 redesign). No in-pixel label, for guests or anyone (Tejas, 2026-10-07, overriding PRD §15 — see
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
   system-popups ("Interrupt"). Exceptions: the sheets the prototypes use (§22.1 row 14), the reveal of a
   finished try-on (ADR 0006; skippable at any point), the OS share sheet, the OS photo picker, and the
   Google sign-in popup.
3. **Low stakes.** Discarding a try-on is a satisfying, visible gesture. Accounts keep try-ons until the
   person removes them; guests who never sign up are purged (§22.1 row 16). Nothing is broadcast without
   an explicit user act.

## Working conventions

- **Show it before building on it.** A UI phase ends with screenshots beside the prototype at 390 and
  1440 px, and the next phase waits until Tejas has seen them (BUILD_PLAN §12.1).
- Non-obvious product or design calls get written down with reasoning, matching PRD §19–21's style — an
  ADR in `docs/decisions/` for irreversible calls, inline reasoning otherwise.
- `archive/` is provenance, not reference — don't pull current guidance from it.
