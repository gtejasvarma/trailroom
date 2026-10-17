# 0008 — The mirror

Status: accepted, 2026-10-17. Supersedes the reveal in ADR 0006 (its point 6) and PRD §22.1 row 38,
and the result screen of PRD §22.1 row 13. Written as PRD §22.1 rows 45 and 46.

## Decision

The result screen of a finished try-on becomes **the mirror**: a light screen built around the
picture. She comes into focus, turns all the way round once on her own and settles; the person turns
her by dragging. Three choices sit under the name: **Not for me, Ask a friend, Love it**. The details
are below the picture on a phone and in a column beside it on desktop. **Buy is hidden everywhere,
temporarily, behind one switch**, until the owner turns it back on.

The boards that are the specification are in the design canvas at
https://claude.ai/artifact/C4pf26WW1oZmSaBtqrHBAT (private to the owner): `Main` (phone), `Desktop`
and `Words` (option A chosen). They are also in `runs/mirror-canvas/project/`. Design.md §8,
"Result screen: the mirror", holds the layout and behaviour; PRD §7 C1 step 11 and §22.1 rows 45 and
46 hold the decision.

## Context

On 2026-10-16 the owner looked at the screen that follows a try-on and found it had no magic: "This
is the magic moment in our product... I want to replicate the feeling of looking at the mirror when
trying a dress. Customer should smile. They turn around and look at it from multiple angles." He
asked for an Apple-style design. The first version was near-black; he rejected it: "I want the
experience to fit in existing theme. I want image to take majority of the space and be center of the
experience." He asked which rules should be dropped, said that everything is saved by default, and
asked for a thumbnail per pose and Instagram-style dots. He approved the result on 2026-10-17 and
said of Buy: "For now temporarily hide buy button."

The screen before this was the result of the prototypes (a full-bleed hero, a swipe gallery, Buy as
the filled action, Add to a list, Build the outfit) reached through the dark reveal of 2026-10-11
(ADR 0006). The reveal gave the moment a stage but no place to stay: after it the person was on an
ordinary screen of buttons.

## The mirror, as approved

- **Light theme, existing tokens.** The picture is the centre: full width and about two-thirds of the
  screen on a phone; large and centred on desktop with the details in a column to the right.
- **Arrival, once per try-on:** the picture comes into focus, then she turns all the way round once
  on her own and settles. Reduced motion: a cross-fade, no turn.
- **Turning:** drag across the picture, with a slight tilt toward the next pose and a soft stop at
  the ends. Poses are named as verbs: **Stand, Turn, Walk, Sit**.
- **A thumbnail per pose** under the picture with its name; **Instagram-style dots** on the picture.
- **Press and hold** the picture to see the label's own photograph in place. First-time hint:
  "Drag to turn. Hold to see the model."
- **Under the name:** "Label, $price. AI-generated preview." There is no "On you" chip on the picture.
- **Three choices** (Words board, option A): **Not for me** removes the try-on, with Undo, then opens
  the next try-on; **Ask a friend** sends a vote link for this piece; **Love it** adds it to
  Favourites. There is no Keep or Save, because everything is saved by default.
- **Details** (description, Wear it with, Add to a list, Compare) below the picture on a phone and in
  the right column on desktop. No separate details screen.
- **Buy is hidden everywhere** behind one switch. The demonstration checkout and "Did it arrive?" are
  hidden with it, so journey C10 is paused (nothing is deleted).

Three things the owner did not answer explicitly were taken as the designer's recommendation when he
approved the boards: after Not for me the next try-on opens (Discover when there are none); Ask a
friend is one action, a vote link, and does not also send the piece; the automatic turn on arrival
stays.

## Rules dropped, and why

| Rule or spec | Why it goes |
|---|---|
| **The prototypes in `mocks/` as the visual specification for the result screen.** | The owner's design review replaced the screen. The prototypes were not edited, so they show the old result (as they already do for the six parts of ADR 0006). |
| **"Prefer routed screens over sheets" for the result's details.** | The details are below the picture, which needs no sheet and no separate screen. The preference stands everywhere else. |
| **The "On you" chip on the person's own render in the result.** | Everything on this screen is the person's own render; a chip says nothing. The label's name and the AI line sit under the picture instead. The chip stays on cards (ADR 0006 point 3). |
| **Camera-angle pose names in the interface** (Front, Three-quarter). | Verbs say what the person does with the picture: Stand, Turn, Walk, Sit. The stored pose keys, the prompts and the QA gate keep their names. |
| **A full-width Buy button on the result** (PRD §22.1 row 13, §21.2). | Hidden for now (row 46). The three choices need no purchase to lead the screen. |
| **The near-black reveal stage of 2026-10-11** (ADR 0006 point 6, row 38). | The owner wanted the experience in the existing theme. The press-and-hold control from that change stays and becomes part of the mirror. |

## Rules kept, and why

- **The visible AI label beside every render, never on the image.** Legal and trust. On the mirror it
  is the "AI-generated preview." line under the name (on desktop it is also in the line beside the
  picture). No in-pixel label.
- **No fit or size language.** Legal posture (PRD Principle 3, §15). The screen shows how a piece looks.
- **The colourless surround.** Try-on imagery sits on white or near-black, never on a tint or gradient
  (Design.md Rule 1). The mirror uses white.
- **44px minimum targets and reduced-motion support.** Accessibility. Reduced motion changes the
  arrival to a cross-fade and removes the tilt.

No hard rule in `CLAUDE.md` is weakened.

## What is given up

- A reader who opens `mocks/` to see what the result should look like will see the old one. The
  reference screenshots in `mocks/screens/` are further from the build.
- The dark, ceremonial reveal. The new arrival is quieter and happens on the same screen the person
  will use, which is the point, but it is less of a curtain-raise.
- Buy has no place on the result for now, and the demonstration checkout and "Did it arrive?" cannot
  be reached. While it is off nothing measures Buy against session depth (PRD §21.2), and the
  render-match survey (PRD C10) collects nothing.
- Dragging is the main gesture. It has to work with a keyboard and with reduced motion; the build is
  responsible for both.
- "Not for me" was listed in PRD §22.3 as not being built, meaning a taste signal. The mirror uses
  the words for a different act, removing a try-on. No signal is recorded from it.

## Open follow-ups

1. The three defaults above (the next try-on opens after Not for me; Ask a friend is one action;
   the automatic turn stays). The owner approved them with the boards and any can be reversed.
2. Whether Buy comes back, and where: the mirror's details, a card, or a list. Hiding it is one
   switch; bringing it back is a design decision.
3. ~~What takes Buy's place on an on-you card while it is hidden~~ *Settled in the build:* the card's action reads "See it on you" and opens the mirror (PRD §22.1 row 37).
4. **A wording inconsistency.** Hearts elsewhere say "Save to Favourites" while the mirror says "Love
   it". "Added to Favourites." is the common toast. Whether one word should win is unsettled
   (PRD §22.5 question 12).

## Consequences

- PRD §22.1 rows 45 and 46 record the decision; rows 13, 25, 35, 37 and 38 are marked as superseded
  in part; §7 C1 (step 11), C2, C10, §21.2, §22.2, §22.3, §22.5 question 12 and the header are
  corrected.
- `docs/Design.md` gains the mirror (§8) and its motion (§7), and loses the reveal; Rule 2 and the
  anti-patterns table are amended.
- `CLAUDE.md` and `docs/BUILD_PLAN.md` §12 record that the mirror is being built and Buy is hidden;
  `docs/SYSTEM.md` and `README.md` describe the last steps of a try-on accordingly.
- Code: the reveal (`apps/web/src/components/reveal.tsx`) is replaced by the mirror, and a single
  switch hides Buy. The building agent owns both; this ADR does not name files.
