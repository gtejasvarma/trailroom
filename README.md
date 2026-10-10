# Trailroom

Try fashion products without leaving your couch. One photo of you, and every piece
from the labels you follow comes back on your body — in four poses (Front, Three-quarter,
Walking, Seated) — before you buy.

**Where it stands (2026-10-10).** The demonstration on Friday 9 October has passed. V0 (Phases A, B
and C) is built and live behind a password at `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`,
and real try-ons have been generated there. Phases A to G are built, tested and on `main`; A to D are
deployed, and E, F, G and the fixes of a security review wait on one manual rules deploy and one manual rollout.
Phase G (the follow loop) ships with two switches, both off because they are undecided: email (nothing is sent
or shown) and the "arrives on you" buffer (nothing is rendered that a person did not ask for). Its checkpoint
is not met: nothing has been published on the hosted site, the buffer has never run with the real image model,
and no real email has been sent. Phase H (hardening) is partly done; the rest is not started.

What a visitor can do today (behind the password): browse Discover with the proof slider, product and
label pages with Follow; add several photos, by upload or the in-page camera, with a consent line under
the upload controls; start a try-on and keep browsing while it renders (a chip on every screen and a
ready toast); open a four-pose result with the AI caption by signing in with Google (a guest sees
tile-sized images only; a guest who signs in with an existing Google account has their photos, finished
try-ons and follows merged into it); keep lists, ask friends from a list through a link that shows only
the pieces in the ask (the vote page needs no account and no password; nor does the unsubscribe page), and read the votes in the app;
use You (phone) and Studio (desktop) with real counts and "Delete everything"; compare up to four tried
pieces on a wide screen; "Buy", which opens a demonstration checkout that takes no payment; and "Wear it
with", which renders two pieces together as one outfit image (the Front view) (in the current catalogue only the coat
pairs with anything); see a "New from labels you follow" section at the top of Discover when a followed label has published a piece (none has on the hosted site yet; pieces are published by a script, `scripts/publish-piece.ts`). **No email is sent or promised.** Jewellery and accessories cannot be tried on yet.
**Not done:** the quality checks of the eval (M1), so the gate is structural only. **Next:** the manual
rules deploy and rollout of E, F and G; the owner's two decisions (whether to send email, and whether to switch the
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

The last command previews the app at `http://localhost:3000`; the gate password is `local`.

## What's here

| Path | What it is |
|---|---|
| `docs/PRD.md` | **The PRD** (v0.7), one consistent document. §22 holds the decisions and their reasoning; §19 is the register of the original mock-vs-PRD audit. |
| `docs/Design.md` | **The design system of record.** Colour, type, space, motion, components, anti-patterns. Derive every value from §11 and do not invent tokens. |
| `docs/BUILD_PLAN.md` | How the PRD becomes shipped code. §12 is the current plan (Phases A to H; V0 = A to C and D are live, E, F and G are built and await rollout). |
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
