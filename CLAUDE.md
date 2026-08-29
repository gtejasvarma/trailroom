# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is right now

Trailroom (trailroom.ai) — virtual try-on: one photo, four poses, garments from labels the user follows.
M0 (the workbench) is done; next up is **M1 (the eval)** per `docs/BUILD_PLAN.md` §1 — measuring
cross-pose identity consistency before building the product feed/loop. Check §1 (the milestone ladder)
before assuming what's being built.

Firebase/GCP project: `virtual-tryon-tejas` (reused from an earlier attempt at this product — see
`docs/decisions/0001-reuse-firebase-project.md`). This is production. See Hard rules below.

## Commands

- `npm run verify` — prettier --check + tsc --noEmit across the repo. Must be green before any turn ends.
- `npm run format` — prettier --write across the repo.

## Document map

| Path | What it is |
|---|---|
| `docs/PRD.md` | The PRD (v0.6) — current source of truth for product behavior. §6 data model, §13 unit economics, §16 architecture, §17 kill criteria, §19 mock↔PRD discrepancies, §21 v0.6 decisions. |
| `docs/Design.md` | The design system of record. Read before writing any UI; derive every value from §11, do not invent tokens. |
| `docs/BUILD_PLAN.md` | The milestone ladder (M0–M5) and the reasoning behind each. |
| `docs/decisions/` | ADRs — one file per irreversible call. Write one when you make a call like this. |
| `specs/` | One file per unit of work being built. |
| `mocks/*.dc.html` + `mocks/support.js` | Four clickable prototypes and the runtime that makes them run outside the Claude Design canvas (open directly in a browser, needs network for pexels.com images). `support.canvas.js` is the real Claude Design export — reference only, requires `window.React`, won't run standalone. |
| `packages/render-eval/` | M1: the eval harness. |
| `apps/web/` | M2: the vertical slice. |
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
- **Every rendered image carries a visible AI label**, and guest renders carry an in-pixel one too.
  SynthID is present but is not the visible label. (§15.)
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
