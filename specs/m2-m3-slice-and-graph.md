# Spec — M2 + M3: the vertical slice and the render graph

Status: built 2026-10-07, not yet deployed. **Its screens and catalogue are superseded** by PRD v0.7 §22 and BUILD_PLAN §12 (ADR 0005); everything below the screens carries over. Owner: Tejas. Branch: `m2-m3-build`.
Implements `docs/BUILD_PLAN.md` §8 (M2) and §9 (M3). PRD sections: §4, §6, §7 C1 Path B, §7 C6,
§10.2–10.4, §15, §16, §21.1–21.2. Design: `docs/Design.md` §1, §2, §8, §9, §11.

## 1. What changes for a user

> **Superseded by PRD v0.7 §22.** This describes the M2 build, which is deployed first. The consent
> screen, the dismissible account prompt and the visible full-size guest result below are replaced:
> consent is a line under the upload controls (no tick, no screen; amended 2026-10-07, PRD §22.1 row 2), and a guest opens the result with an account (§22.1 rows
> 2 and 4). Phase C of BUILD_PLAN §12 rewrites these screens.

A person behind a shared password opens a product page, taps **Try it on**, accepts a consent and
age gate, uploads one photo, and watches four pose tiles fill in. They land on a result screen with
four renders, each with an AI caption beside it, and a dismissible account prompt. When a render can't be shown honestly,
they get a screen that says so and offers the closest three pieces instead. Nothing else from the
PRD exists yet.

## 2. Decisions taken for this build (2026-10-06)

| Decision | Choice | Why |
|---|---|---|
| Build order | M2 + M3 now, M1 finished later | Tejas's call. The four-pose bet is unmeasured, so pose list, model and pose strategy are config, never constants in app code. |
| Prompt | `edit-v1` from `packages/render-eval/src/prompt.ts`, verbatim | Tejas's call. Poses are the prompt's four: `front`, `three-quarter`, `walking`, `seated`. (PRD v0.7 now names the same four, §22.1 row 6; M1 still decides whether the set holds.) |
| Model | Nano Banana 2.1 (`gemini-nano-banana-2.1`), 1K, 3:4 | Current workhorse model per Google's docs, half the per-image price of Nano Banana 2. Config: `RENDER_MODEL`. |
| Daily cap | $5.00/day, hard stop | About 30 Pose Sets. Config: `DAILY_CAP_USD`. Refuses, never warns. |
| Model access | Gemini API key in Secret Manager, through `packages/render` | Already proven by the eval runs. Vertex AI (BUILD_PLAN §8.1) is owed before anyone outside the password circle uploads a photo. |
| QA gate | Minimal deterministic gate plus the full honest-failure path | The identity, proportion, garment and cross-pose scorers come out of M1. Their slots exist in the gate and report `skipped`. Acceptable only because the slice is password-gated. |
| Graph nodes | Route handlers on the one App Hosting service, called by Cloud Workflows with OIDC | BUILD_PLAN §5 says one Cloud Run service per node. One service is one deploy and one cold start; the node boundary is the HTTP contract, so splitting later is a routing change. |
| Genkit, Cloud Tasks | Not used | Genkit's value here was sharing evaluators with M1, which has none yet. Workflows covers the job queue. |
| Monorepo | npm workspaces + Turborepo | App Hosting documents Turborepo and Nx monorepos only. |
| AI label | A visible caption beside each render; nothing drawn on the image | Tejas's call, 2026-10-07: an in-pixel label makes the output look worse. Overrides PRD §15; see ADR 0004. |
| Catalogue | Five hardcoded demo items from Wikimedia Commons (CC0, public domain, CC BY) | VITON-HD is non-commercial and CC BY-SA would bind the renders. Labels and prices are invented and marked as demo data. |

`docs/decisions/0004-m2-m3-ahead-of-m1.md` records the build order, model access, QA gate, graph nodes, model and cap, and the AI-label change as an ADR.

**Deferred with a dated gate:** the live-selfie face match (PRD §15) is not in this build. The
password gate stays on until it is, and until BIPA has been looked at (BUILD_PLAN §7).

## 3. Out of scope

> **Scope has changed.** This list is what M2 left out. PRD v0.7 §22.3 and BUILD_PLAN §12 are the
> current scope: Discover, Lists, Asks, Compare and the rest of the prototype are now built in
> Phases A to H (V0 for Friday 9 October 2026 is A to C); the live selfie, jewellery try-on, the
> designer back office, a native app and sending email stay out or deferred. The camera is built in
> Phase B.

Discover feed, buffer, Lists, Asks, Compare, designer back office, email, camera capture and the
camera-roll scan (upload only), search, Path A, Buy links, the live selfie, VLM capture-quality and
"what are they wearing" analysis, Vertex AI, iOS.

## 4. Architecture

```
Browser ── password cookie ── Next.js on Firebase App Hosting (apps/web)
   │  Firebase Auth (anonymous = Guest Session)        │
   │  Firestore listener: own job doc only             ├─ /api/*            user-facing, ID-token auth
   └───────────────────────────────────────────────────┤
                                                       ├─ /api/internal/*   graph nodes, OIDC auth
   Cloud Workflows `render-pose-set` ──── OIDC ────────┘
   Cloud Scheduler `purge-guests` ─────── OIDC ────────┘

packages/render     the only image-model caller: price table, spend meter, daily ledger, prompt
packages/db         the only Firestore/Storage caller: typed repositories
packages/pipeline   node logic, QA gate, routing policy, inline orchestrator
```

### 4.1 Data model (Firestore)

| Path | Written by | Client read | Notes |
|---|---|---|---|
| `consents/{uid}` | server | owner | version, acceptedAt, age attestation. |
| `photos/{uid}` | server | none | storage path, dimensions, `identityVersion`, `expiresAt`. |
| `jobs/{jobId}` | server | owner | status, per-pose status and attempt, failure reason. The queue screen listens to this. |
| `poseSets/{uid}_{identityVersion}_{itemId}` | server | owner | the cache key from PRD §10.3 as the doc ID. |
| `spend/{yyyy-mm-dd}` | server | none | committed and pending cents, UTC day. |
| `spendLog/{id}` | server | none | one line per model call: model, pose, cents, job. |

Clients write nothing. Every write goes through a route handler.

### 4.2 Storage

All objects are private; storage rules deny every client read and write. A person's images reach
the browser only through `/api/renders/...`, which checks ownership per request. Garment images
are served to anyone past the password gate through `/catalog/<file>`.

- `catalog/<file>.jpg` — garment images, copied from `packages/catalog/assets/` at deploy
  (`docs/DEPLOY.md` step 3). Read by the render step and by the product pages.
- `photos/{uid}/base.jpg` — the upload, re-encoded, EXIF stripped.
- `staging/{jobId}/{pose}-{attempt}.png` — a raw render before QA. Never served.
- `renders/{uid}/{poseSetId}/{pose}.jpg` — passed QA, no pixels drawn on it. The only
  prefix the image route will read.

### 4.3 The graph

```
start (user route): consent? photo? readiness? guest cap? cache hit? ─ any no ─> refuse / reuse
  └─ prepare
       └─ PARALLEL ×poses
            render(attempt 1) ─> qa ── pass ─> publish tile
                                  └─ fail ─> render(attempt 2) ─> qa ── pass ─> publish
                                                                    └─ fail ─> pose failed
       └─ finalize: 4 passed ─> complete
                    3 passed ─> complete_partial (labelled as three poses)
                    ≤2 passed ─> failed: honest failure, published tiles withdrawn
  render node: spend ceiling ─> that pose ends; after the join the job is failed(capacity), no retry
  workflow error handler ─> fail-job
```

The routing policy is one pure function in `packages/pipeline`. Two drivers run the same node
functions: the Cloud Workflow (deployed) and an inline orchestrator (local dev and tests).
Nodes are idempotent on `(jobId, pose, attempt)` so a Workflows retry never spends twice.

### 4.4 The QA gate

Runs on every image before it leaves `staging/`. Each check returns `pass`, `fail` with a reason
code, or `skipped`.

| Check | Status in this build |
|---|---|
| Model returned an image and was not blocked | enforced |
| Decodes, at least 768 px on the short side, aspect within 2% of 3:4 | enforced |
| Not blank or near-uniform (luminance variance floor) | enforced |
| Not a byte-identical copy of the input photo | enforced |
| Identity cosine vs base photo | `skipped` — M1 |
| Proportion delta vs base photo | `skipped` — M1 |
| Garment fidelity (VLM) | `skipped` — M1 |
| Artifact detection (VLM) | `skipped` — M1 |
| Cross-pose consistency (set level) | `skipped` — M1 |

`skipped` is recorded on the job and shown on the internal status line, so nobody mistakes this
gate for the PRD §10.3 gate.

## 5. Hard rules, and the test that holds each one

| Rule (CLAUDE.md) | Mechanism | Test |
|---|---|---|
| No fit or size language | Copy lives in one module | Unit test scans every UI string and prompt-adjacent copy for a banned-phrase list |
| Never alter body proportion | Prompt is `edit-v1` verbatim; no enhancement parameter exists | Snapshot test on the prompt; grep test for slim/smooth/enhance parameters |
| Consent blocks capture | Upload route refuses without `consents/{uid}`; the file input is not rendered before consent | API test (403), e2e test (no `input[type=file]` in the DOM pre-consent) |
| No render ships that failed QA | The image route reads only `renders/`; only the publish step writes there, and only after a pass | Unit test on publish; integration test that a failed pose is never readable |
| Visible AI label beside every render, never on it | Caption under every tile and under the result; publish only transcodes | e2e test for the caption; test that the published image matches the staged one within transcode tolerance |
| Never train on user photos | `store: false` on every call; consent copy says so | Unit test asserts the request field |
| Image models only via `packages/render` | Single import site | Test greps the repo for `@google/genai` outside `packages/render` |
| No agent deploys | Deploy is a runbook, `docs/DEPLOY.md` | Guard hook (not under test) |

## 6. Phases

Each phase is built by one Sonnet 5.5 subagent, sequentially (the phases share files). A phase is
done when its gate is green: `npm run verify`, `npm test`, `npm run test:emu`, `npm run build`
and `npm run test:e2e`. Most of the evidence below lives in the emulator and e2e suites, which
`npm test` alone does not run.

### Phase 0 — Workspace and walking skeleton

Build: npm workspaces + Turborepo; `apps/web` as Next.js (App Router, TypeScript, Tailwind with the
tokens from Design.md §11); Vitest; Playwright; `firebase.json` with Auth, Firestore and Storage
emulators under project `demo-trailroom`; `apphosting.yaml`; the password gate (middleware, signed
cookie, `/gate` page); root `tsc` and prettier covering `.tsx`.

Tests:
- Unit: gate cookie signs and verifies; a tampered or expired cookie fails; the comparison is constant-time.
- e2e: no cookie redirects to `/gate`; wrong password stays with an error; right password reaches `/`; `/api/*` returns 401 without the cookie; `/api/internal/*` is exempt from the cookie (it has its own auth).
- Build: `next build` succeeds; `npm run verify` is green; `npm run eval:generate -- --dry-run` still works.

### Phase 1 — The render chokepoint

Build: add Nano Banana 2.1 to the price table after re-reading Google's pricing and
image-generation pages (per the `gemini-api-dev` skill); an async `SpendLedger` interface beside
the in-memory `SpendMeter`; a fake provider inside the chokepoint for tests, which refuses to run
when `NODE_ENV=production`; `prompt.ts` moved into `packages/render` with a re-export left in
`render-eval`; a generic `wearing` for user photos.

Tests:
- Reservation refuses when committed + pending + estimate exceeds the ceiling; settle is idempotent; twenty concurrent reservations never overshoot.
- Cost arithmetic per model against hand-computed values.
- The fake provider throws under `NODE_ENV=production`.
- The request carries `store: false`, 1K, the configured aspect ratio, and garment-then-person image order.
- Prompt snapshot for all four poses × four categories; `PROMPT_VERSION` unchanged.
- A blocked or image-less response still settles the input-token cost.

### Phase 2 — Data and security rules

Build: `packages/db` (typed repositories over `firebase-admin`), the Firestore-backed daily ledger
using transactions, `firestore.rules`, `storage.rules`, the demo catalogue module and its images
with credits.

Tests (Firestore, Storage and Auth emulators):
- Rules: an owner reads their own job, pose set and consent; another user cannot; nobody reads `photos`, `spend` or `spendLog`; no client write succeeds on any collection; every storage read and write is denied.
- Ledger: thirty concurrent reservations against a $1 ceiling admit exactly the number that fit; the day rolls over at UTC midnight; a settle after a crash-and-retry does not double count.
- Pose-set doc ID is the cache key and a second create for the same key fails.
- Catalogue: every item has a licence, a credit and a readiness score; no item uses a CC BY-NC or CC BY-SA source.

### Phase 3 — The pipeline

Build: `packages/pipeline` — the node functions (`prepare`, `renderPose`, `qaPose`, `publishPose`,
`finalizeSet`, `failJob`), the QA gate, the routing policy and
the inline orchestrator.

Tests:
- Each QA check against synthetic images: passes a good one; fails undersized, wrong-aspect, blank, undecodable and copy-of-input, each with its reason code.
- Routing policy over all sixteen pass/fail combinations of four poses.
- Retry: a pose that fails once is rendered exactly once more; one that fails twice is not rendered a third time.
- Idempotency: calling `renderPose` twice with the same `(jobId, pose, attempt)` makes one model call and one ledger entry.
- Spend ceiling mid-set ends the job as `failed(capacity)` and no tile from that job stays published.
- Publish: the output matches the staged render within JPEG transcode tolerance, with the same dimensions. Nothing is drawn on it, resized or warped.
- Invariant: across a randomised run of pass/fail outcomes, no object exists under `renders/` whose pose is not recorded as passed.
- Integration on the emulators with the fake provider: happy path, partial set, failed set.

### Phase 4a — User-facing API

Build: `/api/consent`, `/api/photo` (upload, delete), `/api/try-on` (start), `/api/renders/[...]`
(image proxy), ID-token verification, upload validation (type, size, minimum resolution, EXIF
strip), the guest cap, cache reuse, readiness gating.

Tests (emulators, fake provider):
- Upload without consent is 403; with consent it stores a stripped re-encode.
- Rejects non-images, files over the size limit, and photos below the minimum resolution, each with a specific reason.
- A second try-on by a guest is refused with `signup_required` and spends nothing.
- The same user and item returns the existing pose set and spends nothing.
- An item below the readiness threshold is refused before any model call.
- User B gets 404 on user A's render; `staging/` and `photos/` are never reachable through the route.
- Delete removes the photo, renders and docs.

### Phase 4b — The screens

> **Superseded by BUILD_PLAN §12 Phases A to C.** These are the M2 screens. The product list, the
> consent and age gate screen, the account sheet that dismisses and the five-item demo catalogue are
> replaced by the prototype's screens, a consent line under the upload controls (no tick, PRD §22.1 row 2 as amended 2026-10-07; the consent rows and tests below describe the superseded M2 gate), account-to-open, and
> the prototype's catalogue (PRD §22.1 rows 2, 4, 8). The tests below describe the M2 build only.

Build: product list (plain entry point), product page, consent and age gate, upload, queue with
filling tiles, result, honest failure with closest three, account sheet (anonymous account linked
to Google), credits page. All copy in one module.

Tests:
- e2e happy path with the fake provider: product → Try it on → consent → upload → four tiles fill → result.
- e2e consent: no file input exists before consent; declining returns to the product page.
- e2e partial set: three tiles and the three-pose label.
- e2e failed set and e2e unready item: the honest-failure screen, three alternatives, one tap into each.
- e2e capacity: the capacity message, with no retry loop.
- e2e account sheet: dismissible; the renders stay full size behind it; Save is locked for a guest.
- Every render has the AI caption beside it, not over it; the caption under the result is the "preview, not a fitting" line.
- Copy lint for fit, size and body-judgment language.
- Axe accessibility check on each screen; keyboard reachability of the primary action.
- Design lint: no colour outside the Design.md §11 tokens in app styles.

### Phase 5 — The graph (M3)

Build: `/api/internal/pipeline/*` node endpoints with OIDC verification;
`workflows/render-pose-set.yaml`; the Workflows trigger behind `ORCHESTRATOR=workflows|inline`;
`/api/internal/purge` for expired guest sessions.

Tests:
- OIDC: missing token, wrong audience, wrong service account and expired token are each 401; a valid one passes.
- Contract: the YAML parses; every HTTP step targets a registered node route with the body that route's schema accepts; every step has a retry policy; the parallel branch covers the configured poses; an error handler calls `fail-job`.
- Parity: driving the node endpoints over HTTP in graph order produces the same job document as the inline orchestrator, for the happy, partial and failed cases.
- Replay: every node endpoint called twice returns the same result and spends once.
- Inline orchestrator refuses to start under `NODE_ENV=production`.
- Purge deletes only guest sessions past `expiresAt`, and their storage objects.

Cloud Workflows has no local emulator. Two tests stand in for one, and neither executes the
YAML: the contract test checks its shape against the app's routes, and the parity test drives the
real endpoints through a TypeScript port of the YAML's branch logic. A typo in the YAML's
expressions can pass both. The first real execution is step 12.5 of `docs/DEPLOY.md`.

### Phase 6 — Review, live smoke and runbook

Build: three read-only review passes (privacy, cost, spec) and fixes for what they find; one live
Pose Set through the inline pipeline against the real model with a $0.25 ceiling, using the
AI-generated fixture person; `docs/DEPLOY.md`; ADR 0004; CLAUDE.md document map.

Tests: the whole suite from a clean install; `next build`; the live smoke confirms the model ID,
the price arithmetic against reported tokens, and that four images come back.

## 7. Open questions

- Fourth pose: `seated` (prompt; PRD v0.7 now names it too). M1 decides whether the set holds.
- Whether Nano Banana 2.1 holds identity as well as Nano Banana 2 did in `pilot-01`. Unmeasured.
- Region for App Hosting and Workflows. The runbook assumes `us-central1`.
