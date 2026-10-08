# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is right now

Trailroom (trailroom.ai) — virtual try-on: one photo, four poses, garments from labels the user follows.
M0 (the workbench) is done. **M2 (the vertical slice) and M3 (the render graph) are built but not
deployed**, ahead of M1, by Tejas's call (ADR 0004). **M1 (the eval) is unfinished** per
`docs/BUILD_PLAN.md` §2: the QA gate in `packages/pipeline` is structural only, and its identity,
proportion, garment and cross-pose checks are empty slots until M1 supplies them. Check §1 (the
milestone ladder) before assuming what's being built.

Firebase/GCP project: `virtual-tryon-tejas` (reused from an earlier attempt at this product — see
`docs/decisions/0001-reuse-firebase-project.md`). This is production. See Hard rules below.

## Commands

- `npm run verify` — prettier --check + tsc --noEmit across the repo. Must be green before any turn ends.
- `npm run format` — prettier --write across the repo.
- `npm test` — unit tests. `npm run test:emu` — tests against the Firebase emulators. `npm run test:e2e` —
  Playwright against a dev server and the emulators. Prefix the last two with `caffeinate -i` on a Mac.
  All tests use a fake render provider; nothing here calls the image model.

## Document map

| Path | What it is |
|---|---|
| `docs/PRD.md` | The PRD (v0.6) — current source of truth for product behavior. §6 data model, §13 unit economics, §16 architecture, §17 kill criteria, §19 mock↔PRD discrepancies, §21 v0.6 decisions. |
| `docs/Design.md` | The design system of record. Read before writing any UI; derive every value from §11, do not invent tokens. |
| `docs/BUILD_PLAN.md` | The milestone ladder (M0–M5) and the reasoning behind each. |
| `docs/decisions/` | ADRs — one file per irreversible call. Write one when you make a call like this. |
| `specs/` | One file per unit of work being built. |
| `mocks/*.dc.html` + `mocks/support.js` | Four clickable prototypes and the runtime that makes them run outside the Claude Design canvas (open directly in a browser, needs network for pexels.com images). `support.canvas.js` is the real Claude Design export — reference only, requires `window.React`, won't run standalone. |
| `packages/render/` | The one chokepoint for image-model calls: model/price table, the prompt, the spend ledger interface, and a fake provider for tests (refused in production). |
| `packages/db/` | The one place that talks to Firestore and Cloud Storage: typed repositories and the Firestore-backed daily spend ledger. |
| `packages/pipeline/` | M3: the render graph's nodes, the QA gate, the routing policy, and the inline orchestrator used by local dev and tests. |
| `packages/catalog/` | The demo catalogue (five items) and the copy rules. `assets/` holds the garment images that get copied to Cloud Storage. |
| `workflows/render-pose-set.yaml` | M3: the Cloud Workflow that drives the graph in production by calling `/api/internal/pipeline/*`. |
| `firestore.rules`, `storage.rules` | Clients read their own job, pose set and consent; they write nothing; Storage is closed to clients. |
| `docs/DEPLOY.md` | The manual deploy runbook. Read before changing anything deploy-related. |
| `packages/render-eval/` | M1: the eval harness. `npm run eval:generate -- --dry-run` plans a run; drop `--dry-run` to generate into `runs/<run>/`. |
| `fixtures/` | Eval inputs: `manifest.json` (committed), `CONSENT.md`, images (git-ignored; repo is public). See ADR 0002. |
| `apps/web/` | M2: the vertical slice. Next.js on Firebase App Hosting. `src/server/` holds the logic behind the route handlers; all UI strings live in `src/lib/copy.ts`. |
| `tools/label.html` | Standalone contact-sheet labeler for eval error analysis (BUILD_PLAN §2.2c) — `j`/`k` to navigate, `1`/`0` to label, writes JSONL. Open directly in a browser. |
| `archive/` | Superseded docs. Provenance only, not current guidance. |

## Hard rules — violating these is a bug, not a style preference

- **Never emit fit or size language.** No "hits mid-calf on you", no "runs small", no hem advice. We
  render how a piece looks; we make no claim about fit. (PRD Principle 3, and a legal posture — §15.)
- **Never alter body proportion.** No slimming, lengthening, smoothing, or "enhancing" — not a feature,
  not a default, not a model parameter. The proportion guard in the QA gate is non-negotiable. (Principle 2.)
- **Consent and age gate blocks capture.** No code path opens a camera or picker before consent is
  accepted. Guests included. (Principle 8, §15.)
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
   system-popups ("Interrupt"). Exceptions: OS share sheet, OS photo picker, backgrounded push notifications.
3. **Low stakes.** Discarding a try-on is a satisfying, visible gesture. Generated try-ons are ephemeral
   by default. Nothing is broadcast without an explicit user act.

## Working conventions

- Non-obvious product or design calls get written down with reasoning, matching PRD §19–21's style — an
  ADR in `docs/decisions/` for irreversible calls, inline reasoning otherwise.
- `archive/` is provenance, not reference — don't pull current guidance from it.
