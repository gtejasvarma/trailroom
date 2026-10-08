# 0005 — Realign the product to the two target prototypes

Status: accepted, 2026-10-07

## Decision

The two prototypes Tejas named are the specification for flow, layout and copy:

- Mobile: https://claude.ai/artifact/EKTrBk2wLDDc3EBwDeUix4
- Desktop: https://claude.ai/artifact/577W6d53YdY79Qm86SMc9b

Their verbatim extracted source is kept at `archive/prototypes-2026-10-07/` for provenance. The
**aligned, runnable** versions are `mocks/Trailroom Prototype.dc.html` (mobile) and
`mocks/Trailroom Desktop.dc.html` (desktop): the target with the PRD §22.1 decisions applied,
opening directly in a browser, images in `mocks/assets/`, reference screenshots in `mocks/screens/`.
They are the visual specification. `docs/PRD.md` is now v0.7, rewritten in place to agree with them;
its §22.1 records where the build differs from the linked artifacts. The plan to build the whole
experience is `docs/BUILD_PLAN.md` §12. The earlier v0.6-edited mocks are at `archive/mocks-v0.6/`.

## Context

M2 + M3 (ADR 0004) built one journey from PRD v0.6 with a plain interface. When Tejas ran it
locally he said it was not the experience he wanted and pointed at the prototypes. Two things were
wrong, and they are different kinds of wrong.

1. **Scope.** BUILD_PLAN §8 defines M2 as a single journey and lists Discover, Lists, Asks, Compare
   and the back office as out. The prototypes are the whole product. Nobody looked at a screen
   between the plan and the finished build.
2. **Which design.** The prototypes are the design-project snapshot that PRD v0.5 and v0.6 set out
   to correct (§19-B1 to B4). The v0.6-edited mock files (now at `archive/mocks-v0.6/`) are the corrected edit. The build followed the
   corrections; Tejas's target was the original.

## What Tejas decided, 2026-10-07

Asked as eight questions; the answers are PRD §22.1 rows 1, 2, 4, 6, 7, 8, 9 to 12.

| Question | Answer |
|---|---|
| Fit sentences driven by height | Keep them cut |
| Consent | A tick on the upload screen; no separate screen, no live selfie |
| Guest result | As the prototype: an account is needed to open it |
| Poses | Four fixed poses for every piece: Front, Three-quarter, Walking, Seated |
| Platform | One responsive web app |
| Catalogue | Seed it from the prototype's images |
| Must be real | Email sending (**amended later the same day, see below**) |
| Sign-in | Google only |

Not selected as "must be real", so deferred: the designer back office, jewellery and accessory
try-on.

The remaining rows of §22.1 (after sign-up steps, result actions, sheets, keeping try-ons, the
vote page and the password gate, what is left out) are Claude's reading of "match the prototypes"
applied to things the eight questions did not cover. They are recorded as decisions so they can be
overturned one at a time.

## Amended later on 2026-10-07: V0, email, and the images

Three things Tejas decided after the table above. Each is an owner decision, not Claude's reading.

1. **V0 is for a demonstration on Friday 9 October 2026.** V0 is BUILD_PLAN §12 Phases A, B and C.
   Phase D without email (lists, asks, the public vote page, the Asks inbox) is the stretch goal.
   Phases E to H follow after Friday.
2. **Email is designed but not in V0.** "Must be real: email sending" became: the email program stays
   in the design (the preferences screen, "we'll email you" copy), but no email is sent in V0. Where
   the interface promises an email (a vote landed, better photos, new pieces), V0 either shows the
   result in the app (vote counts on the list, the Asks inbox) or does not show the promise. Sending
   through a provider from a verified domain is the first thing after V0. Tejas has a provider and DNS
   access. PRD §22.1 row 10 carries the amended row.
3. **The catalogue images are cleared.** See the next section.

## Reasoning worth keeping

- **Fit stays cut even though the prototype has it.** It is the only row where the build will look
  different from the prototype on purpose. The legal and trust argument in PRD §0.6 and §15 was
  put to Tejas directly and he kept it.
- **Consent moved onto the upload screen instead of disappearing.** The prototype has no consent at
  all. The hard rule (nothing opens a picker before consent) survives in a form that adds no
  screen. The prototype's privacy copy claims a live-selfie match and age estimation that nothing
  performs; that copy is rewritten, because a false claim about biometric handling is a worse
  position than an absent feature.
- **Account-to-open reverses a decision this repo argued for twice** (§19-B4, §21.1). The argument
  against it was resentment; the argument for it is conversion. It is Tejas's product and his
  call. It makes guest → account conversion the number that says whether guest renders pay.
- **What carries over from M2 + M3 unchanged:** the render chokepoint and prompt, the spend ledger
  and caps, the pipeline and QA gate, the Cloud Workflow, the security rules approach, the
  password gate, the test harness and the deploy runbook. What is replaced: every screen, the
  catalogue, and the one-photo-per-person data model.

## The catalogue images

The seed uses the images inside the prototype bundles: about ten stock photographs (the prototype
loads them from pexels.com) and twenty images forming five four-pose sets of one person, which the
prototype describes as "real pose sets photographed on one person".

- **Cleared by the owner, 2026-10-07.** Tejas's statement: they are public images and not a concern.
  Claude raised the provenance of the images and the consent of the person pictured (and, for renders
  made from a label photo of a real person, that the image goes through the model as the garment
  reference), and the owner accepted that. This is his decision about his own product; nothing in the
  repo independently records a licence or the person's consent.
- **They may be committed to the repo.** They are in `packages/catalog/assets/prototype/` and are
  copied to Cloud Storage, like the garment images before them (`docs/DEPLOY.md` §3).
- **No longer owed before the password gate comes off.** The image-rights item is answered; PRD §22.5
  question 1 records the same.

## Consequences

- `CLAUDE.md` hard rules are unchanged in substance. The consent rule is reworded for the upload
  screen. A rule is added: the app never claims a check it does not perform.
- `docs/Design.md` stays the token and type system. Its Rule 2 gives way to the prototype's sheets,
  and its "never gate on the render completing" gives way to row 4.
- ADR 0004's list of what is owed before the password gate comes off still stands. The image-rights
  question this ADR first added to it is answered and removed.
- The lesson for the process is in BUILD_PLAN §12.1: a screenshot goes in front of Tejas at the
  end of every phase, next to the prototype.
