# Trailroom

Try fashion products without leaving your couch. One photo of you, and every piece
from the labels you follow comes back on your body — in four poses — before you buy.

## What's here

| Path | What it is |
|---|---|
| `docs/PRD.md` | **The PRD** (v0.6). §19 is the mock↔PRD discrepancy register, §20 records the imported design docs, §21 holds the v0.6 decisions and their reasoning. |
| `docs/Design.md` | **The design system of record.** Colour, type, space, motion, components, anti-patterns. Read before writing any UI; derive every value from §11 and do not invent tokens. |
| `docs/BUILD_PLAN.md` | How the PRD becomes shipped code: the milestone ladder, the eval-first argument, render-engine cost routing. |
| `docs/decisions/` | ADRs — one file per irreversible call (infra, vendor, architecture). |
| `specs/` | Units of work — one spec file per increment being built. |
| `mocks/` | Four interactive prototypes plus the runtime that makes them open in a browser. |
| `packages/render-eval/` | The M1 eval harness (cross-pose consistency measurement). |
| `apps/web/` | The M2 vertical slice. |
| `archive/` | Superseded documents and the raw Claude Design export. Kept for provenance, not for reading. |

## Running the mocks

Open any `.dc.html` in `mocks/` directly in a browser. They need to be online —
photography loads from pexels.com.

- `Trailroom Prototype.dc.html` — mobile, 11 journeys (C1–C10, D1)
- `Trailroom Desktop.dc.html` — desktop shopper app, 9 journeys
- `Trailroom Desktop Designer.dc.html` — designer back office
- `Conversion Audit.dc.html` — a 44-item audit of the pre-v0.6 prototype

Add `?startSignedIn=1` to the mobile prototype to boot into a signed-in session.
`window.__dc` is exposed for poking at state from the console — e.g.
`__dc.state.screen`, `__dc.setState({signedIn:true})`.

A few 404s for URLs like `{{ curOnYou }}` appear in the console on first paint.
The parser tries to fetch the template's raw `src` before the runtime rewrites it.
Harmless.

### The two runtimes

`.dc.html` files are Claude Design canvas documents. Inside the canvas, the editor
supplies `support.js`; opened locally there is nothing to hoist the `<helmet>`
styles or evaluate `{{ }}`, so the page renders as unstyled markup with no images.

- **`mocks/support.js`** — a standalone runtime written for this repo. No
  dependencies. This is what makes the files work when you double-click them.
- **`mocks/support.canvas.js`** — the real generated `dc-runtime` exported from the
  Claude Design project. Kept for reference. It requires `window.React`, which the
  canvas provides and a local file does not, so it will not work standalone.

## Where the decisions live

Every non-obvious call is written down with its reasoning rather than just its
outcome, so it can be re-litigated with the argument in view:

- **§19** — 44 discrepancies between the mocks and the PRD, sorted by which side won
- **§20** — what arrived from the Claude Design project, and where it conflicts
- **§21** — the v0.6 decisions: the signup gate split by entry path, the result
  screen's action hierarchy, and why notifications fire on availability rather
  than on a calendar
