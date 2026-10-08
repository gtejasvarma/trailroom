# 0002 — Eval fixture sources: retailer-photo people, research-dataset garments

Status: accepted, 2026-09-26; amended the same day (see Amendment below)

## Amendment — 2026-09-26: people from retailer product photos

**The consent-only rule for people is relaxed for M1's open-coding runs.** Tejas decided to use
photos he already had (model photos from retailer product pages: prada.com, zara.com,
nykaafashion.com) rather than wait on consented photos of friends, to make progress on evals now.

- **Gate:** the generator now accepts a person with either a `consentDate` or a recorded
  `sourceUrl`. No provenance at all still blocks rendering.
- **Current fixtures:** p01–p05 are all retailer photos (`fixtures/manifest.json` has each source).

Conditions, which make this safe to use and are what a future reader should hold us to:

1. **Evals only, never the product.** These fixtures exist to evaluate the render pipeline. They
   and their renders never enter the user-facing product in any form. Photos and their renders are never committed (git-ignored), published,
   shown in demos or marketing, or sent anywhere except the Gemini API for generation.
2. **Open coding only.** These runs find failure modes. They don't produce any pass rate or
   fairness number for the exit gate (BUILD_PLAN §2.6). Those need consented, phone-captured
   people, the 25-identity stratified set.
3. **Delete by the end of M1.** Remove `fixtures/people/*` retailer photos and every `runs/`
   render of them once the consented fixture set exists.
4. **Known blind spots, don't generalise past them.** All five are slim professional models,
   professionally lit and shot, not phone captures. Findings say nothing about body size, bedroom
   lighting or live-camera input. Monk tone is spread (roughly 1–2 to 9–10, estimated by eye).
5. **Paid-tier API key only**, so inputs aren't used for model training.

Risks accepted knowingly: the models in these photos didn't consent to AI re-rendering, and the
retailers own the images' copyright. The PRD's consent-and-age gate (Principle 8) is unaffected:
it governs the product's capture flow, which doesn't exist yet and must still block capture on
consent.

## Amendment 2 — 2026-09-26: garment diversity from Wikimedia Commons

The original 10 VITON-HD garments were all women's tops, which left dresses, bottoms and
outerwear, and the "hard shell rendered as clingy cotton" hypothesis, untestable. The garment set
is now **20 items**, matching BUILD_PLAN §2.4:

- **6 VITON-HD tops kept** (solid, logo, busy floral, sheer, black structured, near-white knit).
- **14 from Wikimedia Commons**, mostly from "Clothing on white background": 5 outerwear
  (including a hooded technical shell and a nylon windbreaker), 4 bottoms, 3 dresses and 2 more
  tops (a knit, a plaid shirt).

The Commons images are CC0, public domain, CC BY or CC BY-SA, so, **unlike VITON-HD, commercial
use is allowed with attribution**. Per-image credits are in `fixtures/garments/ATTRIBUTION.md`.
DressCode, the obvious multi-category VTON dataset, was ruled out for now: it needs an
institutional email and a hand-signed release, and unofficial mirrors would bypass that agreement.

Known weaknesses: some Commons items are museum pieces or shot on dress forms and mannequins (the
model must not copy the mannequin), and several are low resolution (582–790 px). Both are
recorded per garment in `manifest.json` (`probes`), so a failure caused by the source image can
be told apart from a model failure.

The original decision follows, unchanged, for provenance.

## Decision (original)

For M1's first open-coding run (5 people × 10 garments × 4 poses = 50 Pose Sets):

- **People** are photos of Tejas and friends who have consented in writing, recorded in
  `fixtures/CONSENT.md`. The generator refuses to render anyone without a `consentDate`.
- **Garments** are 10 product images from the **VITON-HD** test split (`test/cloth/`), chosen by
  hand to cover distinct failure hypotheses (see `fixtures/manifest.json`, field `probes`).

No image files are committed. The repo is public, and people photos are personal data.

## Context

BUILD_PLAN §2.4 Day 1 says fixtures come from "yourself, consenting friends in writing, licensed
stock whose release covers derivative AI generation. Don't scrape." The idea of sourcing from
`minar09/awesome-virtual-try-on` came up. That repo is a link list, not a dataset, and the
datasets it links to raise two separate problems:

1. **Consent/licence.** VITON-HD is CC BY-NC 4.0, "for research purposes only". DressCode needs a
   signed research agreement. The models in those photos never consented to a third-party API
   re-rendering them in new poses.
2. **Distribution.** They're studio shots: white seamless background, professional lighting,
   front-facing. Trailroom's inputs are phone photos taken at home. Failures on studio people would
   not be the failures real users hit (BUILD_PLAN §2.3: "public benchmarks calibrate your
   instrument; they do not answer your product question").

Both problems apply fully to **people** and much less to **garments**. A flat product shot on a
plain background is what Trailroom actually consumes from labels, and there's no person in it
whose consent is missing.

## What this does not settle

- **Licence posture is a grey zone, accepted knowingly.** CC BY-NC 4.0 prohibits commercial use.
  Evaluating a model for a commercial product, internally, with nothing shipped or shown to users,
  is arguably still commercial use. Mitigations: files aren't redistributed (not committed),
  attribution is in `fixtures/garments/ATTRIBUTION.md`, and the images appear in no product
  surface. Before any of these images or their renders go anywhere user-facing (marketing, demos,
  a public eval report), replace them with licensed or label-supplied garments.
- **Coverage is narrow.** VITON-HD is women's tops only. No dresses, trousers, outerwear or
  jewellery, and no hard-shell/stiff materials (the "shell rendered as cotton" hypothesis from
  `docs/eval-learning-log.md` is untestable with this set). Findings from this run generalise to
  tops only. Extending categories (step 7 of the eval plan) needs another source, e.g. DressCode
  (dresses, lower body, via its research agreement) or label-supplied product shots.
- **Five people is not a stratified set.** This run is for open coding (finding failure modes),
  not for measuring pass rates by stratum. The 25-identity stratified fixture set from
  BUILD_PLAN §2.4 is still owed before any number goes into the exit gate.

## Consequence

- `fixtures/manifest.json` is the committed record of exactly which images were used (VITON-HD
  filenames), so a run is reproducible without committing the images.
- BUILD_PLAN's `0002-render-routing.md` becomes `0003-render-routing.md`.
