# Eval learning log — how we thought through M1

Started 2026-08-30, before writing a single line of eval code, via a Socratic working
session on how to design multimodal evals for Trailroom's four-pose try-on generation.
Kept as a narrative log, not a spec — the spec is `docs/BUILD_PLAN.md` §2. This is the
reasoning that got us there, including the wrong turns.

## The three-step framework

1. **Define what good looks like** — your best-guess hypothesis, before touching data.
2. **Play with model + prompt + harness, observe** — find what you predicted and what
   you didn't, measure frequency, never assume when testing is cheap.
3. **Beauty is in the details** — does each dimension actually apply to every pose and
   category, or does it need to be pose/category-specific, and how does that change the
   overall eval set.

Two steps are missing from this list and belong in it:

4. **Validate the judge.** Everything above earns you a hypothesis about what to measure
   and a plan for measuring it. It does not earn you the right to trust an automated
   judge until you've checked its TPR/TNR against held-out human labels. This is the
   step we referenced on day one and never actually did.
5. **You're evaluating a system, not a model.** Model + prompt + calling-pattern
   (independent vs. chained generation, star vs. sequential topology) is one
   inseparable unit. A vendor's marketing claim calibrates your prior; it never
   substitutes for your own number on your own hardest cases.

And one thing that needs to be explicit inside step 3, not assumed: "generalize" has to
include fairness strata (Monk skin tone × body size) as its own axis, not just pose and
catalog category. We didn't come back to this after the first exchange — it's a real gap.

---

## Step 1 — Define what good looks like

- Decomposed the product promise ("visualize a dress on them") into three axes tied to
  the literal claim, not generic quality language: faithful representation of the
  person, faithful representation of the garment, how effectively the garment renders
  on the person. Specific to the promise, not "helpfulness."
- Caught, on inspection, that "faithful representation of the person" was hiding two
  different questions that needed to split into two metrics: **identity fidelity to the
  source photo** (does this look like the real user) vs. **cross-pose consistency**
  (do all four poses agree with each other). A model can ace one and fail the other —
  e.g. all four poses could be a consistent, confident rendering of the *wrong* face.
  This split turned out to already exist in `docs/PRD.md` §10.3 as three separate
  numbers (per-image, per-set, cross-pose) — independently re-derived, not copied.
- Guessed candidate dimensions for the hardest pose (Close-detail) before generating
  any data: skin color, hair similarity, body dimensions, drape — explicitly framed as
  guesses to be tested, not commitments. Correctly hedged.

## Step 2 — Play with model + prompt + harness, observe

- Recognized that locking in star-topology chaining without testing it is the *same
  category of mistake* as locking in eval criteria without looking at data. Direct
  consequence: test both independent and chained generation rather than assume either.
- Caught a second, hidden instance of the same mistake one layer down: "chained" isn't
  one thing — star-anchor (every edit built from the original `front.png`) and
  sequential chaining (`front→side→back`, each edit built on the last) have different
  failure profiles. Star propagates one bad anchor identically into every pose;
  sequential compounds drift progressively. Collapsing both into "chained" as one
  bucket in the matrix would quietly re-commit the mistake just named.
- Checked what's actually publicly known about Nano Banana's character-consistency
  claims (multi-turn stability improved from "3–4 sequential edits" to "8–10+" between
  versions) instead of either assuming it's solved or assuming it isn't. Used the
  finding to calibrate a prior, not to skip the eval — the vendor's claim is measured
  on their distribution of use cases, not fashion-fit fidelity across skin tones in
  bedroom lighting.
- Found, by reasoning concretely rather than staying at "there could be a blind spot":
  a hard-shell jacket that renders as soft, clingy cotton on the Close-detail pose is a
  real defect that a facial-identity check would never see, because there may be no
  face in that frame at all. This is what "found something in step 2 you weren't
  looking for in step 1" actually looks like — a specific, falsifiable instance, not a
  general acknowledgment that unknowns exist.

## Step 3 — Beauty is in the details: does it generalize

- Corrected a fabricated premise mid-conversation: the real four poses are **Front,
  Three-quarter, Walking, Close detail** (`docs/PRD.md:151`), not the invented "back
  pose" used earlier as an illustrative example. Lesson: verify grounding before
  reasoning further on top of someone else's claim — including mine.
- Found that `docs/PRD.md` §13.3(a) already independently ranks Three-quarter and
  Close-detail as the lowest-customer-value poses (the first cut if cross-pose identity
  consistency can't be held across all four). This means eval effort in Week 1/2
  should be sequenced Front and Walking first — they're load-bearing even in the
  fallback plan — with Three-quarter/Close-detail treated as exploratory upside.
- Established that identity-consistency, as a metric, doesn't apply to every pose.
  Close-detail likely has no face in frame, so a facial-consistency check on it
  produces a **vacuous pass** — not a meaningful 100%, a pass with nothing behind it,
  indistinguishable on a dashboard from real quality. Fix: exclude Close-detail from
  the cross-pose identity-consistency computation explicitly, in the eval spec's
  written definition of what gets scored per pose — not as a silent code default when
  a face detector finds nothing.
- Caught that the exclusion rule itself needs the same scrutiny: "Close-detail has no
  face" is plausible for dresses and almost certainly false for jewellery (necklaces,
  earrings), where the entire point of a close-up is showing the piece against skin,
  neck, or face. Same generalization question, applied to catalog category instead of
  pose — self-applied, without being prompted a second time.
- Left open, correctly not resolved yet: excluding identity-consistency from
  Close-detail isn't the same as having nothing measure it. What actually catches
  "hard shell rendered as cotton" — a cheap deterministic code assert (texture/color
  histogram against the catalog reference), or does fabric stiffness have no cheap 2D
  proxy and need a VLM judge? Unresolved — good next-session starting point.

---

## Open items / further research

### Metrics for validating LLM/VLM judges, beyond TPR/TNR

TPR/TNR is the starting point, not the ceiling. Four distinct groups, each answering a
different question — researched 2026-08-30, general knowledge, not yet applied to a
specific Trailroom judge.

**1. The confusion-matrix family (what TPR/TNR belong to).** Accuracy is a trap when
failures are rare — a judge that always says "pass" scores misleadingly high. F1 is
better but still collapses two different failure directions into one number, hiding
*which* problem a bad judge has: low TPR ships bad renders to users, low TNR wastes
money re-rendering good ones. Report TPR and TNR separately for exactly this reason.
Precision matters too when a "failed" verdict triggers something costly (e.g. an
automatic re-render).

**2. Threshold-free metrics, for judges that output a score rather than pass/fail.**
ROC-AUC and PR-AUC measure separability across every possible cutoff before you commit
to a threshold. PR-AUC is usually the more honest choice when the positive class
(failures) is rare — ROC-AUC can look deceptively good on imbalanced data in a way
PR-AUC won't.

**3. Agreement/reliability metrics — is the ground truth even solid.** Raw percent
agreement between two human labelers overstates reliability (some agreement is by
chance); Cohen's kappa (two raters) or Fleiss'/Krippendorff's (more than two) corrects
for it. Use it two ways: measure human-human kappa first to check your own labels are
trustworthy before validating anything against them (published human-human kappa on
well-specified subjective tasks is typically ~0.7–0.8; much lower means the rubric
itself is underspecified, not that people are bad labelers) — then compare judge-vs-human
kappa against that number as *context*, not a hard ceiling a judge is barred from
passing. Practical lever: asking a judge to write a short rationale before the verdict,
rather than emitting a bare label, has been shown to meaningfully lift judge reliability.

**4. LLM-judge-specific systematic biases — categorically different from 1–3.** These
don't show up in held-out labels the way a normal accuracy problem would, because the
bias can be consistent across the whole labeled set. Needs adversarial stress tests,
not more labels:
- **Position bias** — in any judge comparing two things, swapping which one appears
  first can swing the verdict 10–15 points of win rate with nothing else changed.
- **Verbosity bias** — favors longer/more detailed output regardless of quality.
- **Self-preference bias** — a judge's ratings of a model converge with that model's own
  self-assessment in a way human raters don't. **Directly relevant here**: generating
  with a Gemini-family model (Nano Banana) and judging with a Gemini-family VLM is
  exactly the configuration this literature warns about — worth deliberately testing
  whether a same-family judge scores Nano Banana output more leniently than a
  cross-family judge would, before trusting it as a gate.
- Uncomfortable finding: ensembling judges, reversing presentation order, or telling a
  judge to "be neutral" reduce variance but don't remove the underlying systematic
  bias. Prompting your way out doesn't reliably work — design around it instead (e.g.
  always average both orderings rather than trusting a neutrality instruction).

**Priority order to build this muscle:** TPR/TNR (have it) → human-human kappa on your
own labels (cheap, tells you if ground truth is trustworthy) → self-preference check
for the Nano-Banana-generates/Gemini-judges setup specifically (cheap, relevant,
currently absent from the plan) → PR-AUC once a judge scores rather than binary-decides
→ position bias only if a pairwise/comparative judge gets built.

Sources: [Hamel's LLM evals FAQ](https://hamel.dev/blog/posts/evals-faq/) ·
[Using LLM-as-a-Judge For Evaluation](https://hamel.dev/blog/posts/llm-judge/) ·
[Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/pdf/2410.21819) ·
[Judging the Judges: Bias Mitigation Strategies](https://arxiv.org/pdf/2604.23178) ·
[Measuring human-LLM judge alignment — Arize AI](https://arize.com/blog/measuring-human-llm-judge-alignment/) ·
[Cohen's kappa: inter-annotator agreement beyond raw percent](https://zeroentropy.dev/concepts/cohens-kappa/)

## Open items for next time

- Build and pressure-test binary pass/fail on an actually ambiguous Close-detail or
  Three-quarter case — not yet done.
- Design the TPR/TNR validation step for whichever judge gets built for garment/drape
  fidelity — not yet done.
- Decide the code-assert vs. VLM-judge question left open in Step 3 for Close-detail
  material fidelity.
- Come back to fairness stratification (Monk skin tone × body size) as its own
  generalization axis, with the same rigor applied to pose/category above.
- Figure out where the 75% / 70% / 90% thresholds in `docs/PRD.md` §10.3 actually came
  from, and whether they're derived from a business consequence (e.g. "doesn't look
  like me" report rate) or inherited without re-derivation.
