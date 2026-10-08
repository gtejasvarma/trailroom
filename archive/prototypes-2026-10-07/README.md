# Target prototypes, as extracted (2026-10-07)

**Provenance only.** This folder (`archive/prototypes-2026-10-07/`) holds the verbatim extracted
source of the two linked prototype artifacts that Tejas named as the experience Trailroom is built
to match (2026-10-07; see `docs/PRD.md` §22 and ADR 0005). Nothing here is edited.

| Layout | Linked artifact | Extracted source in this folder |
| ------ | --------------- | ------------------------------- |
| Mobile | https://claude.ai/artifact/EKTrBk2wLDDc3EBwDeUix4 | `Trailroom Mobile.template.html` |
| Desktop | https://claude.ai/artifact/577W6d53YdY79Qm86SMc9b | `Trailroom Desktop.template.html` |

The files are the page source pulled out of each 8 MB bundle, without the embedded images and
fonts, so they do not run on their own. `runtime/` holds the scripts that came out of the same
bundles.

## The specification is not here

**The aligned, runnable versions in `mocks/` are the spec:** `mocks/Trailroom Prototype.dc.html`
(mobile) and `mocks/Trailroom Desktop.dc.html` (desktop). They are these two prototypes with the
`docs/PRD.md` §22.1 decisions applied. They open directly in a browser, with images in
`mocks/assets/` and reference screenshots in `mocks/screens/`.

The differences from the linked artifacts, which the aligned versions already contain:

- no fit sentences, no height or measurements, no Edit fit, no "Fit in words" journey;
- a consent tick on the upload screen, and no claim of a live selfie or age estimation;
- the four poses are Front, Three-quarter, Walking and Seated;
- Google sign-in only;
- no email is sent in V0, so the interface does not promise one;
- jewellery and accessories can be browsed but not tried on, and the designer back office is not
  built.

The earlier v0.6-edited mock files are in `archive/mocks-v0.6/`. The catalogue images used by the
build are in `packages/catalog/assets/prototype/` (cleared by the owner; ADR 0005).
