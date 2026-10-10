# Trailroom

Try fashion products without leaving your couch. One photo of you, and every piece
from the labels you follow comes back on your body — in four poses (Front, Three-quarter,
Walking, Seated) — before you buy.

**Where it stands (2026-10-09).** V0 is built and live behind a password at
`https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`: Phases A, B and C of the build plan.
It has Discover with the proof slider, product and label pages with Follow, several photos per person,
upload and in-page camera capture with a consent line, a walk-away queue (a chip on every screen and a
ready toast), account to open (a guest sees tile-sized images only; Google sign-in opens the result, on
phone and desktop), a four-pose result with the AI caption and Buy as the filled action, tried pieces
shown "on you", a "Your try-ons" page, and honest-failure screens. Buy, Add to a list and Build the
outfit show a "coming soon" toast. No email is sent. **No successful render has yet been observed on
the deployed site**: the first real run was refused by the image model for billing, and the key has
been replaced. **Next:** Phase D (lists, asks, the public vote page; no email) is in progress; then
email, and Phases E to H (`docs/BUILD_PLAN.md` §12).

## Running it locally

Local renders are coloured test images from a fake provider (nothing calls the image model), and local
Google sign-in is the emulator's simulated one.

```bash
npm ci
npm run test:e2e        # the suite, against a dev server and the emulators
npm run emulators:exec -- "cd apps/web && GATE_PASSWORD=local GATE_COOKIE_SECRET=local-only-cookie-secret RENDER_PROVIDER=fake ORCHESTRATOR=inline NEXT_PUBLIC_USE_EMULATORS=1 GOOGLE_CLOUD_PROJECT=demo-trailroom npx next dev --port 3000"
```

The last command previews the app at `http://localhost:3000`; the gate password is `local`.

## What's here

| Path | What it is |
|---|---|
| `docs/PRD.md` | **The PRD** (v0.7), one consistent document. §22 holds the decisions and their reasoning; §19 is the register of the original mock-vs-PRD audit. |
| `docs/Design.md` | **The design system of record.** Colour, type, space, motion, components, anti-patterns. Derive every value from §11 and do not invent tokens. |
| `docs/BUILD_PLAN.md` | How the PRD becomes shipped code. §12 is the current plan (Phases A to H; V0 = A to C is live, D in progress). |
| `docs/DEPLOY.md` | The manual deploy runbook (Tejas runs it; agents do not deploy). |
| `docs/decisions/` | ADRs — one file per irreversible call (infra, vendor, architecture, scope). |
| `specs/` | Units of work — one spec file per increment being built. |
| `mocks/` | The two aligned, runnable prototypes (the visual specification), their images and screenshots, and two reference files. |
| `packages/`, `apps/web/`, `workflows/` | The render chokepoint, database layer, pipeline, catalogue, eval harness, and the Next.js app. |
| `archive/` | Superseded documents and mocks, and the verbatim source of the two linked prototype artifacts. Provenance, not guidance. |

## Running the prototypes

Open `mocks/Trailroom Prototype.dc.html` (mobile) or `mocks/Trailroom Desktop.dc.html` (desktop)
directly in a browser. Images are in `mocks/assets/`; reference screenshots are in `mocks/screens/`.
They are the target prototypes with the PRD §22.1 decisions applied (no fit sentences, a consent line
under the upload controls, Google sign-in only, no promise of email). The reference screenshots in `mocks/screens/` still show the prototype's two-step onboarding and its email promises, which V0 does not have.

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

- **PRD §22** — the v0.7 realignment: the 18 decisions in §22.1, V0, and what is not being built
- **PRD §19–21** — the original audit, the imported design documents, and the signup and result
  decisions as they stand now
- **`docs/decisions/`** — ADRs, including 0004 (build order, QA gate) and 0005 (realign to the
  prototypes)
