# Trailroom — Build Plan

**How to get from PRD v0.6 to something in production, using coding agents, without shipping code you can't debug.**

Status: draft 2, Aug 25 2026 — Firebase/GCP stack, Nano Banana render engine, M1 reframed as the eval milestone.
Owner: Tejas. Companion docs: `docs/PRD.md` (what), `docs/Design.md` (how it looks), this file (how it gets built).

---

## 0. The honest read before the plan

Four things, because they change what "start" means.

### 0.1 Your project has a kill criterion and it is not a feature

PRD §17 and §18 both say it: *can the model hold one identity across four poses, evenly across skin tones and body sizes?* If cross-pose consistency lands at 70%, you are not building the product in the PRD — you're building the two-pose version (§13.3a), or you're not building it. The feed, the buffer, Lists, Asks, Compare, the designer back office: all downstream of a number nobody has measured.

So the first thing you build is not the app. It's the instrument that produces that number. Which is also, conveniently, exactly the thing you said you want to learn.

### 0.2 The PRD's Phase 1 is a team-quarter and you are one person

iOS plus desktop web plus designer back office, twelve customer CUJs and four designer CUJs, in weeks 6–20. That assumes a staffed team. Agents change the constant factor on typing; they do not change the constant factor on *deciding*, and deciding is most of it. The ladder below reaches something real in about six weeks by shipping one vertical slice instead of twelve horizontal ones.

### 0.3 Nano Banana is a quality decision you've made and a cost decision you haven't

You checked the quality manually and I'll take that. Here's the other half, at current list prices:

| Model | Res | $/image | $/Pose Set (4) | 40 images/WAU/mo |
|---|---|---|---|---|
| Self-hosted VTON (PRD §3 estimate) | — | $0.003–0.010 | $0.012–0.040 | **$0.12–0.40** |
| Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`) | 1K | $0.0336 | $0.134 | $1.34 |
| Nano Banana 2 (`gemini-3.1-flash-image`) | 0.5K | $0.045 | $0.180 | $1.80 |
| Nano Banana 2 | 1K | $0.067 | $0.268 | $2.68 |
| Nano Banana Pro (`gemini-3-pro-image`) — batch/flex | 1K–2K | $0.067 | $0.268 | $2.68 |
| Nano Banana Pro — standard | 1K–2K | $0.134 | $0.536 | $5.36 |
| Nano Banana Pro — standard | 4K | $0.240 | $0.960 | $9.60 |

Your §14 targets are ≤ 40 images per WAU per month and ≤ $0.25 render cost per WAU per month by month 9. That implies a budget of **$0.00625 per image.** Nothing in the Gemini image family is within 5× of it. Nano Banana Pro at standard tier is 21× over.

**Committing to Nano Banana for on-demand renders is committing to §13.3 option (c).** Your own PRD says of (c): *"Defensible only as an explicit, time-boxed acquisition bet with a hard monthly ceiling and a date by which (a) or (b) must be true. Not a default."* And two lines later: *"Never arrive at (c) by accident."*

This is not an argument against the choice. It is an argument for making it on purpose, in writing, with the two things (c) requires attached to it: a hard monthly ceiling and a date. Both go in `docs/decisions/0002-render-routing.md` at the end of M1.

**Three things make (c) genuinely survivable**, and they're all cost-based routing, which is what §13.3 told you to do — it just routes among Gemini tiers now instead of between self-hosted and API:

- **The buffer is inherently batchable.** Five pre-rendered Front poses, nobody waiting on them (§10.2). Route them to Lite on the batch tier. That's the cheapest image in the family, on the surface that generates the most volume.
- **Pro only where a user is watching.** On-demand Pose Sets are the 60% of images that carry explicit intent (§13.3). They're also the only ones with a latency requirement. Spend there.
- **The daily cap is load-bearing.** Not a warning — a hard stop that refuses to render. Build it before the first stranger sees the product.

One free win from this choice: **every Nano Banana output carries a SynthID watermark**, which covers part of PRD §15's provenance requirement without you building it. You still need the visible in-app label and the in-pixel guest label separately.

### 0.4 "Graph engineering" is real and it does not belong in your coding loop

More in §5. The short version: the graph goes in your product, not your toolchain — and on GCP it's Cloud Workflows, not a framework you install.

---

## 1. The milestone ladder

Each rung is independently shippable and independently abandonable. If M1 kills the four-pose bet, M2 changes and M0 doesn't.

| | Milestone | Time | What exists at the end | What you learn |
|---|---|---|---|---|
| **M0** | The workbench | 2–3 days | A repo where an agent physically cannot merge broken code | Context engineering, hooks, the verification gate |
| **M1** | **The eval** | 2 weeks | A calibrated measuring instrument, a cross-pose consistency number per stratum per tier, and a written §13.3 decision | **Multimodal eval design — error analysis, judge validation, the whole craft** |
| **M2** | The vertical slice | 2–3 weeks | One CUJ deployed on Firebase, password-gated: product page → consent → photo → four poses | Spec-driven build; subagents that earn their keep; deploy |
| **M3** | The graph | ~1 week | The render orchestrator as a Cloud Workflow with per-pose QA and failure routing | Graph engineering, for real, in the product |
| **M4** | The loop | ~2 weeks | Discover feed, five-card buffer, try-on queue (C2, C3) | Parallel agents on file-disjoint work |
| **M5** | The social edge | 1–2 weeks | Lists, Asks, the no-account vote page (C4) | Shipping a public surface with real privacy exposure |

Beyond M5 — designer back office, Compare, the email program — plan when you get there.

---

## 2. M1 — The eval (2 weeks)

You asked to start here and you're right to. This section is longer than the others on purpose.

### 2.1 The one sentence that governs everything

**An eval is a measuring instrument, and you calibrate an instrument before you use it.**

The common failure is building the matrix first — six prompt variants × three tiers × twenty items — getting a table of numbers back, and having no idea whether the numbers mean anything. You then spend a week hill-climbing a metric that doesn't correlate with whether the render is good. Calibration first is slower for four days and faster for the next four months.

### 2.2 The method, and where the standard method stops

The canonical practical method for LLM evals is [Hamel Husain's](https://hamel.dev/blog/posts/evals-faq/), and it's five moves:

1. **Error analysis before infrastructure.** Look at ~100 outputs. Write down what's wrong in open-ended prose — "open coding," borrowed from qualitative research. No taxonomy yet.
2. **Axial coding.** Group those observations into a failure taxonomy, with counts. This step is the most important one and the one everybody skips. You stop when ~20 fresh traces turn up no new category.
3. **Binary pass/fail, never a 1–5 scale.** Likert scales produce inconsistent labels — annotators disagree about the gap between 3 and 4, and drift toward the middle. Binary forces the question to be answerable.
4. **Code asserts before LLM judges.** Cheapest thing that works. Reserve judges for failures that resist deterministic checks.
5. **Validate the judge against human labels.** TPR and TNR on a held-out labeled set. A judge you haven't validated is a random number generator with good manners.

That method transfers to your problem completely. What doesn't transfer is the judges — Hamel's guide is text-first and says nothing about images. **The three places multimodal diverges are where your actual learning is:**

**(a) Your unit of evaluation is a set, not an image.** Cross-pose consistency is only computable across four images. That means your eval schema has two levels — per-image scores and per-set scores — and your pass rate has two definitions (§10.3 already says this: ≥75% per image, ≥70% per complete set). Text evals almost never have this shape. Build it in from the first line of schema.

**(b) Half your judges can be deterministic code, and that's an advantage text evals don't have.** Face-embedding cosine, pose-keypoint delta, silhouette IoU, colour histogram distance — real numbers, free, reproducible, no judge to validate. Push as much as you can into this bucket. Your proportion guard (Principle 2) *must* live here; it is a correctness requirement and a VLM's opinion is not good enough for it.

**(c) Error analysis means looking at pictures, which is slow unless you build for it.** Half a day on a local contact-sheet viewer — grid of renders, base photo pinned in the corner, keyboard `j`/`k` to move and `1`/`0` to label, writes JSONL — is the highest-leverage tool in this whole project. You'll use it in M1, then again every time you change a prompt, forever.

### 2.3 Existing datasets and benchmarks — what's actually usable

I looked. Here's the honest sorting.

| Resource | What it is | What it's good for here |
|---|---|---|
| **[VTONQA](https://arxiv.org/html/2601.02945v1)** | 8,132 VTON-generated images, **24,396 human mean-opinion scores**, across three dimensions: clothing fit, body compatibility, overall quality. 748 garment-person pairs, 189 subjects across 9 demographic categories. | **The most valuable thing I found.** Pre-labeled human judgments let you validate a judge before you've labeled anything yourself. Availability isn't stated in the paper — you'd need to contact the authors. |
| **[VTEdit-Bench](https://github.com/Hiuyee124/VTEdit-Bench)** (ECCV26) | 24,220 test pairs across 5 tasks, with pose annotations and parsing maps. 15 models benchmarked. | Two of its five tasks are your question almost exactly: **Shop2MultiView** (viewpoint robustness) and **Model2Model** (identity preservation). Google Drive; contact for the full set. |
| VITON-HD, DressCode, DeepFashion, StreetVTON | The classic source datasets these benchmarks are built from | Garment/person pairs at volume. But studio-clean. |
| Monk Skin Tone scale | Google's 10-point scale | Your PRD already specifies it, and it's the native scale on this stack. Use it as your stratum key. |

**The rule for using them: public benchmarks calibrate your instrument; they do not answer your product question.**

VTONQA's most useful finding is a negative result you get for free: they tested 17 automated image-quality metrics against those 24k human scores and found **PSNR and SSIM correlate poorly with human perception.** LPIPS did better on body compatibility. A fine-tuned MANIQA got 0.707–0.797 Spearman correlation, which is roughly the ceiling anyone has hit and a useful target for what "my judge agrees with humans" should look like.

That saves you two weeks of building a pixel-similarity scorer and wondering why its verdicts feel wrong.

But none of these datasets contains your question. They're single-pose, studio-lit, professionally-shot. Your product is four poses generated from a photo somebody took in their bedroom. **Public data accelerates the instrument; your own stratified fixture set answers the question.** Budget for both.

### 2.4 The two-week shape

**Week 1 — label before you build.**

| Day | |
|---|---|
| 1 | Fixtures. 25 identities stratified by Monk tone × body size × lighting × capture source (live vs gallery). 20 catalogue items. `fixtures/CONSENT.md` — who, when, what they consented to, how to revoke. Yourself, consenting friends in writing, licensed stock whose release covers derivative AI generation. Don't scrape. |
| 2 | Generate ~150 Pose Sets with one naive prompt on Nano Banana 2 at 1K. 600 images, ≈ **$40**. Deliberately naive — you're collecting failures, not optimising. |
| 3 | Build the contact-sheet labeler. Then look at all 600 images and open-code them. Prose, not categories. |
| 4 | Axial coding. Turn your notes into a failure taxonomy with counts. **This is the day you cannot delegate to an agent and cannot skip.** |
| 5 | Write the eval spec from the taxonomy: which failures get code asserts, which need a VLM judge, what the pass criteria are per image and per set. |

**Week 2 — build the instrument, validate it, then use it.**

| Day | |
|---|---|
| 6 | Code asserts: face-embedding cosine, keypoint/silhouette delta, colour histogram. Free and deterministic. Unit-test them against known-good and known-bad pairs you hand-pick. |
| 7 | VLM judges for what's left — garment fidelity, artifact detection. One binary question per judge. Never a scale. Never "rate this 1–5." |
| 8 | **Validate the judges.** Hold out 30% of your day-3 labels. Compute TPR/TNR per judge. Anything under ~90% TPR is a judge you can't gate renders with — fix the prompt or move that check to code. This day is the one that makes the rest real. |
| 9 | Run the matrix (§2.5). Small first. |
| 10 | Write `docs/decisions/0002-render-routing.md`: the numbers, the §13.3 choice, the monthly ceiling, and the date by which (a) or (b) must be true. |

### 2.5 The matrix — and why it's not "which vendor wins"

You've picked the vendor, so the axes change into something more interesting:

| Axis | Values | Why it matters |
|---|---|---|
| **Tier** | Lite 1K · Flash 1K · Pro 1K | A 4× cost spread. If Flash clears the gate, Pro is $2.68/WAU/month of nothing. |
| **Reference count** | 1 photo · 3 · 5 | Pro accepts up to 5 character reference images; Flash up to 4. Your identity set already holds multiple photos per slot (§6). Free lever on identity preservation — test it. |
| **Pose strategy** | 4 independent generations · **chained: generate Front, then poses 2–4 as edits of the Front render** | **The highest-value hypothesis in the whole eval.** Independent generations have nothing anchoring them to each other, which is exactly the drift §17 names as your top risk. Chaining lets the model see the rendered person, not just the base photo. If ≥90% cross-pose consistency is reachable at all, this is probably how. |
| **Prompt** | 2–3 variants | Last, and least. Prompt variants are where people start and it's the smallest lever here. |

Small matrix first: 10 identities × 10 items × 4 poses × 6 configurations ≈ 2,400 images ≈ **$160** at Flash 1K. Eliminate, then run the survivors wide. Put a **hard spend ceiling in the runner that aborts rather than warns** — the first time an agent helpfully retries your eval in a loop, you'll be glad.

### 2.6 Exit gate — from PRD §18

- ≥ 75% auto-QA pass **per image**, apparel and jewellery, across every fairness stratum
- ≥ 70% auto-QA pass **per complete four-pose set**
- ≥ 90% **cross-pose identity consistency**, evenly across strata
- Every judge in the gate has a measured TPR/TNR against your human labels, written down
- `docs/decisions/0002-render-routing.md` committed: the §13.3 choice, the monthly ceiling, the date

Hold yourself to *evenly across strata*. A model that holds identity beautifully on one body type and drifts on another is a fairness failure, and §15 says a category doesn't launch until the spread closes. Break every number down by stratum by default, not behind a flag.

### 2.7 On the source you asked about

[Madhu Guru](https://x.com/realmadhuguru) is real — a Google PM who's been hiring for Gemini and Veo, and who writes about AI product craft. His framing is worth keeping as a north star: an AI PM needs *"model intuition to extract max value"* and the ability to go *"from pixels → evals → hill climb."* That last phrase is a good description of exactly what M1 is.

I could not retrieve a detailed how-to-write-evals thread from him — X blocks automated fetching, so I only got what surfaced through search and a thread aggregator. If you have a specific post, paste it and I'll fold it in. For method, [Hamel Husain's evals FAQ](https://hamel.dev/blog/posts/evals-faq/) is the most complete practical treatment available and is what §2.2 is built on.

---

## 3. M0 — The workbench (2–3 days)

You're not building the product this week. You're building the machine that builds it. The highest-leverage idea in agentic engineering is that **the agent's environment does more work than the agent's prompt.** A well-instrumented repo makes a mediocre model produce good code; a bare repo makes a great model produce plausible garbage.

### 3.1 Repo shape

```
trailroom/
  CLAUDE.md                     # the constitution. short. always in context.
  docs/
    PRD.md  Design.md
    decisions/                  # ADRs — one file per irreversible call
  specs/                        # the unit of work. one file per increment.
  .claude/
    agents/ commands/ hooks/ settings.json
  packages/render-eval/         # M1
  apps/web/                     # M2
```

### 3.2 CLAUDE.md — the highest-value 100 lines you'll write

It's injected into every context, every turn, in every session and every subagent. Two consequences people get backwards:

- **It must be short.** Every line costs tokens on every turn *and* dilutes attention across everything else. A 600-line CLAUDE.md is worse than a 100-line one. Target under 150.
- **It must hold what can't be derived.** Not the PRD (point to it). Not the file tree (the agent can look). The commands to run things, conventions invisible from any single file, and rules that must never break.

That last category is unusually loaded here, because your product principles are exactly what an agent will cheerfully violate *while being helpful*. Write them as prohibitions:

```markdown
## Hard rules — violating these is a bug, not a style preference

- **Never emit fit or size language.** No "hits mid-calf on you", no "runs
  small", no hem advice. We render how a piece looks; we make no claim about
  fit. (Principle 3, and a legal posture — §15.)
- **Never alter body proportion.** No slimming, lengthening, smoothing or
  "enhancing" — not a feature, not a default, not a model parameter. The
  proportion guard in the QA gate is non-negotiable. (Principle 2.)
- **Consent and age gate blocks capture.** No code path may open a camera or
  picker before consent is accepted. Guests included. (Principle 8, §15.)
- **No render ships that failed QA.** No "show it anyway" flag, no debug
  bypass that can reach a user. (Principle 1, §10.3, C6.)
- **Every rendered image carries a visible AI label**, and guest renders carry
  an in-pixel one. SynthID is present but is not the visible label. (§15.)
- **Never train on user photos.** Opt-in only, and that path does not exist
  yet, so the answer is always no.
- **Never call an image model outside packages/render.** One chokepoint, so
  the cost meter and the daily cap cannot be bypassed.
```

That's context engineering in one screen: **you are pre-loading the corrections you'd otherwise make forty times.**

### 3.3 Hooks — the mechanical part

Hooks are why "the agent can't merge broken code" is a fact rather than a hope. Shell commands wired to lifecycle events in `.claude/settings.json`. Three earn their place on day one.

**`PostToolUse` on `Edit|Write`** → prettier + `tsc --noEmit` on the touched file. Type errors return to the agent as text it must handle. Tightest loop there is: it finds out it broke the types in the same turn.

**`Stop`** → `npm run verify`. Exit 2 blocks the agent from ending its turn. This is the mechanical fix for the worst failure mode in agentic coding — the confident *"Done! I've implemented the feature"* on top of a red test suite.

**`PreToolUse` on `Bash`** → `guard.sh`. Deny `rm -rf`, `push --force`, anything holding a production connection string, `firebase deploy --only hosting` against prod, and any `gcloud` command with your prod project ID:

```bash
#!/bin/bash
CMD=$(jq -r '.tool_input.command')
deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",
    permissionDecision:"deny", permissionDecisionReason:$r}}'; exit 0
}
case "$CMD" in
  *"rm -rf"*)         deny "Destructive delete blocked. Move to _trash/ instead." ;;
  *"push --force"*)   deny "Force push blocked." ;;
  *"firebase deploy"*) deny "Deploys are manual and mine." ;;
esac
grep -q "$PROD_PROJECT_ID" <<<"$CMD" && deny "Production project is out of bounds."
exit 0
```

Production deploys being a thing *only you* can do isn't paranoia. It's the difference between an agent that helps and an agent that is a production incident with a good vocabulary.

### 3.4 M0 done when

- `npm run verify` exists and is green on an empty repo
- You have deliberately written code that fails typecheck and **watched the `Stop` hook refuse to let the agent finish**
- You have asked it to `rm -rf` something and **watched the guard deny it**
- CLAUDE.md is under 150 lines and every line is something the agent could not have worked out alone

The middle two are what people skip. **A hook you've never seen fire is a hook you don't know is wired up.**

---

## 4. The plan-and-review protocol

For every milestone, and every increment inside one bigger than a day. One technique does almost all the work — it's step 3.

1. **You write the spec.** Claude may draft; you rewrite in your own words. If you can't write it, you don't understand the increment yet, and no amount of agent horsepower fixes that. Five parts: what changes for a user, which PRD section it implements, acceptance criteria as executable checks, what's explicitly out of scope, open questions.
2. **Claude Code plan mode**, pointed at the spec and the relevant PRD sections. Read-only exploration, then a plan saved beside the spec. Don't let it implement yet.
3. **Blind adversarial review, two reviewers.** Antigravity in the same repo, and Claude in a brand-new session. Same prompt to both:

   > Read the spec and the plan. You are an adversarial reviewer. Do not implement anything. Produce four sections: (1) correctness holes, with file and line; (2) things the plan assumes but never verifies; (3) the single cheapest experiment that would falsify this plan; (4) what you would cut, and why. Be specific. Do not summarise the plan back to me.

4. **You reconcile.** A `.decisions.md` file: where they agreed, where they conflicted, what you chose and why.
5. **Then implement.**

Two rules make step 3 work, and both are easy to break by accident:

**Blind.** Reviewer two must never see reviewer one's output. Otherwise you're measuring anchoring, not agreement.

**Adversarial.** "Review this plan" gets you a compliment sandwich. "Find the cheapest thing that falsifies this" gets you signal. Same models, same plan, completely different output quality.

**The caveat that matters:** agreement between two frontier models is weak evidence, not proof. They share training corpora and therefore share blind spots. **When both agree and the stakes are real, the tiebreaker is an executable test, not a third model's opinion.**

Budget ~40 minutes per increment. It'll feel like overhead for the first two, then it'll catch something that would have cost a day.

---

## 5. Where graphs actually belong

**A loop asks "should this agent keep going?" A graph answers "which node runs next, with what state, under which condition?"** Loops give local iteration. Graphs give system-level coordination: conditional routing, parallel fan-out and fan-in, verification gates separate from the thing verified, per-failure-type recovery, and durable pause/resume.

### Don't build a graph to write your code

Claude Code *is* the loop, and a well-tuned one. Wrapping it in an orchestrator so a "planner node" hands to a "coder node" hands to a "reviewer node" is rebuilding Claude Code, worse, with your evenings. The signal that a coding workflow needs a graph is multiple agents with branching logic and persistent state that must survive a restart — a platform team's problem, not a solo greenfield build.

The one dev-time graph worth having is your CI, and it's a Cloud Build or GitHub Actions DAG rather than a framework:

```
PR opened
  ├─ typecheck + lint + unit          (fast gate, fails first)
  ├─ playwright against preview deploy
  ├─ spec-auditor        ┐
  ├─ privacy-reviewer    ├─ read-only, parallel, no file conflicts
  └─ antigravity review  ┘
       └─ all post to the PR → you reconcile → merge
```

### Do build a graph for the render pipeline

Read PRD §16 and §10.3 back to back and you'll find you already specified one without calling it that:

```
capture
  └─ quality score ──fail──> guided recapture
       └─ face match vs live selfie ──fail──> reject
            └─ base look (normalise, cache by identity version)
                 └─ FAN OUT ×4  [Front | Three-quarter | Walking | Close detail]
                      each pose:
                        ├─ identity cosine vs base selfie      (code)
                        ├─ garment fidelity vs product image   (VLM judge)
                        ├─ proportion delta vs base look       (code)
                        └─ artifact detection                  (VLM judge)
                 └─ FAN IN
                      └─ cross-pose consistency  (only computable on the set)
                           ├─ all pass ─────────> cache + ship
                           ├─ one borderline ───> re-render that pose, higher tier
                           ├─ pose fails twice ─> ship 3, labelled  (§10.3)
                           └─ set fails ────────> honest failure (C6)
```

Every graph pattern is in there, and the recovery policy differs per failure type — which is what makes it a graph rather than a nested try/catch.

**On GCP, the pieces are:**

- **Cloud Workflows** is the durable outer graph. YAML state machine, parallel steps, per-step retries, error handling, callbacks for long operations, survives restarts. This is your Step Functions equivalent and it's native.
- **Cloud Run services** are the nodes — base look, render pose, each scorer.
- **Genkit** is what runs inside each node. TypeScript, first-class Gemini support, built-in tracing in its Dev UI, and — the reason it matters for you — **`ai.defineEvaluator()` plus `genkit eval:flow` / `eval:run`**, so your M1 eval harness and your M3 QA gate are the same code rather than two implementations that drift.
- **Cloud Tasks** for simple enqueue-and-forget where you don't need a graph.

Note Genkit's built-in evaluators (faithfulness, answer relevancy, maliciousness) are text/RAG-shaped and useless to you. You'll write custom ones. That's fine — the value is the harness, the dataset format, the trace capture and the side-by-side run comparison at `localhost:4000/evaluate`, not the stock metrics.

**Sequencing is deliberate.** In M2 you write `renderPoseSet()` as a dumb sequential function so you can watch it work end to end. In M3 you turn it into the Workflow, with the M1 scorers as gate nodes. Building the graph before you've watched the naive version fail is how you end up with an abstraction that fits nothing.

---

## 6. Subagents — when they earn their keep

A subagent is a markdown file with YAML frontmatter in `.claude/agents/`. Own context window, gets only the delegation message rather than your conversation, lockable to a tool allowlist, pinnable to a model, returns a summary.

That last clause is the decision rule. **A subagent is worth it when the work generates a lot of output you don't want to keep, and returns a little output you do.** Everything else is a rationalisation.

**Use one when:** the output is verbose and disposable ("read all 14 scorers and tell me which don't handle a null face embedding"); you want a tool restriction enforced (a reviewer with `Read, Grep, Glob` cannot edit your code no matter how confidently it decides it should); the work is independent and parallel.

**Don't when:** you'll iterate (schema design, a flaky test — that's main-thread work); phases share context; it's a small edit.

| Agent | Tools | Job |
|---|---|---|
| `spec-auditor` | `Read, Grep, Glob` | Given a diff and a spec: every acceptance criterion not met, and every behaviour in the diff the spec never asked for. Scope creep is as much a finding as a miss. |
| `privacy-reviewer` | `Read, Grep, Glob` | Your specific exposure. Does any path reach a camera before consent? Is any base photo reachable by a URL that isn't per-user signed? Does any render leave without an AI label? Is retention wired for both the guest 24–48h class and the 12-month inactive class? |
| `cost-auditor` | `Read, Grep, Glob` | New, and load-bearing under §0.3. Does every image-model call route through `packages/render`? Is every call attributed to a tier and logged in cents? Can any path bypass the daily cap? |
| `explainer` | `Read, Grep, Glob` | Reads a diff, returns a data-flow diagram and the three likeliest production failures. Feeds your understanding gate. |
| `Explore` | built-in, read-only | "Where does X live." Use constantly. |

The `description` field is what the main agent matches against when deciding to delegate — write it as *when to use this*, not *what this is*. Keep system prompts narrow: an agent asked to "review code" reviews nothing in particular.

**On swarms.** Parallel agents are excellent for reading and dangerous for writing. Five read-only reviewers gives you five perspectives for one wall-clock minute. Five agents editing the same repo gives you merge conflicts and two agents deleting each other's helper function. Parallel *implementation* works under one condition — genuinely file-disjoint work — and the safety mechanism is `isolation: worktree` in the frontmatter. M4 is where it first pays: the feed ranker, the buffer service and the queue chip touch almost nothing in common.

What makes parallelism work isn't the parallelism. It's the decomposition, and the decomposition is your job.

---

## 7. Not shipping what you don't understand

The constraint I'd take most seriously, because it's the one agentic workflows quietly erode. The erosion is gradual: diffs get bigger, you skim instead of read, and one day something breaks in a file you've never looked at. Willpower doesn't fix that. Mechanism does.

1. **You write the spec.** Draft with the agent, rewrite in your words. The rewrite is the comprehension check.
2. **You write the test names before implementation.** Not the bodies — the names. *rejects a photo whose face does not match the live selfie*. *ships three poses labelled when one pose fails twice*. That list is the contract, in your words. Backend staff engineer is exactly the background where this pays fastest.
3. **A hard cap of 400 diff lines per PR**, enforced in CI so it isn't a matter of discipline. Bigger means the increment was wrong. This one lever does more for comprehension than the other five combined.
4. **The explain-back gate.** Before merging you write five lines in the PR body — what changed, why, how it fails — from memory, not by re-reading the diff. If you can't, you don't merge: run `explainer`, read its diagram, read the diff again, try once more. *The agent's explanation is a study aid, never the artifact.*
5. **Blast radius, in the PR template.** "If this is wrong in production, what breaks and how would I find out?" A question you can't answer is a missing alert.
6. **One hand-drawn pass per milestone.** You, a pen, the data flow. Ten minutes. Where your pen hesitates is where the bugs are.

**And one hard gate that isn't about comprehension.** M2 deploys behind a password, for you and a handful of friends. Before *anyone outside that circle* touches it, two things must be true.

**The live-selfie face match is implemented.** PRD §15 is blunt: this single mechanism is the difference between a try-on product and a deepfake tool. Every mock's privacy copy already promises it; no mock's flow performs it.

**Someone qualified has looked at BIPA.** Illinois and Texas both have biometric statutes with private rights of action, retailers have already been sued over virtual try-on, and your product face-matches a photograph of a person's body. Geofence until it clears.

---

## 8. M2 — The vertical slice (2–3 weeks)

One CUJ, end to end, deployed. Not one layer across twelve CUJs.

**In:** CUJ C1 Path B, web only. Product page → "Try it on" → consent and age gate (blocking, real) → photo upload → guest session → render job → queue screen with poses filling in → result screen, four poses, baked-in AI label → account prompt over a visible render, dismissible, gating actions only.

**Out, explicitly:** the Discover feed. The buffer. Lists. Asks. Compare. The designer back office. Email. The camera-roll candidate scan. Search. Everything below the fold.

**Deferred with a dated gate:** the live-selfie face match. M2 is password-gated precisely because it isn't in yet. Write that in the spec so future-you can't quietly forget.

### 8.1 Stack — Firebase + GCP

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js on Firebase App Hosting** | Built-in Next.js support, SSR, GitHub integration. Builds with Cloud Build, serves on Cloud Run behind Cloud CDN — so you get Cloud Run's knobs without managing containers. |
| Auth | **Firebase Auth** | Google and Apple providers built in (Apple is required once you offer any third-party login). **Anonymous auth maps directly onto your Guest Session (§6)** — device-bound identity that upgrades to a real account with no recapture. That's the mechanism, not an approximation of it. |
| Data | **Firestore** | Revised from draft 2 — see §8.2. Realtime listeners give you the C3 queue chip free, and security rules enforce per-user photo isolation at the database layer rather than in app code you might get wrong. |
| Photo storage | **Cloud Storage for Firebase**, signed URLs only, CMEK per-user keys | §15 requires per-user encryption and no base-photo download by anyone. |
| Render | **Vertex AI** — Gemini image models | Vertex over the raw Gemini API: VPC-SC, CMEK, data residency, and a single billing account with the rest of the stack. Matters once you're processing biometric data. |
| AI framework | **Genkit** | Flows, tracing, and the eval harness. Same code in M1 and M3. |
| Jobs | **Cloud Tasks** now, **Cloud Workflows** in M3 | Start simple; the graph lands in M3. |
| Errors | **Cloud Error Reporting** + Cloud Logging | Native. Add Sentry later if you miss it. |
| Flags | A Postgres table | Dark-launch and kill switches. Don't install anything. |
| CI | **Cloud Build**, or GitHub Actions if you prefer the ecosystem | Either fans out fine. |

### 8.2 Firestore — revised from draft 2

Draft 2 said Firestore was the wrong record store, on the strength of the C2 feed query. **That was over-weighted and I'm retracting it.** Four things I had wrong or under-counted:

- Firestore now supports [range and inequality filters on multiple fields](https://firebase.google.com/docs/firestore/query-data/multiple-range-fields). I was working from an older mental model of what it can express.
- It has [native vector search](https://firebase.google.com/docs/firestore/vector-search) (`findNearest`) — exactly what taste-model ranking wants, and something Postgres needs an extension for.
- **The buffer is five cards, not an infinite ranked feed.** I was designing for a scale problem you don't have. Precomputing five items per user is a small Cloud Function, not a system.
- **Security rules.** The one that actually decides it. You are storing biometric data. "No user can read another user's base photo" expressed as a declarative rule, tested in the emulator, beats the same check written into every handler by an agent. Anonymous auth → guest session → per-user isolation becomes one coherent system rather than three you wire together.

And the Pose Set cache key from §10.3 — `(identity version, item id, pose)` — is *better* in Firestore, not worse: make it the document ID and uniqueness is free.

**Cost isn't the reason.** Cloud SQL's `db-f1-micro` is about $8/month plus storage — real, but not a decision at your stage. The four points above are the reason.

**What stays hard:**

- **The `in` operator caps at 30 values.** "Items from the labels I follow" breaks for a user following more than 30. Onboarding forces 3 and §14 targets ≥5 by D7, so this is fine for a long time — split the query into batches when it isn't.
- **No joins.** The feed becomes a precomputed per-user collection, maintained by a fan-out on publish. Five cards makes that cheap.
- **Ad-hoc analysis is worse.** Turn on the BigQuery export from day one, so your §14 metrics work ("one dashboard per CUJ") doesn't depend on Firestore queries.

**The tripwire:** if you're writing more than ~200 lines of fan-out machinery to serve one query, or you hit a query you cannot express, that's the signal — not a vague sense that Postgres would be nicer. The escape hatch is [Firebase Data Connect](https://firebase.google.com/docs/sql-connect/pricing): managed Postgres inside the same Firebase project, 250k operations/month free, three-month no-cost instance trial. You don't leave the ecosystem to take it.

**The insurance that makes this cheap either way:** all data access behind `packages/db`, which CLAUDE.md already mandates for a different reason. If the ranker forces your hand at M4, you swap one package instead of rewriting the app.

### 8.3 Two things before the first render reaches a stranger

**The cost meter with a hard cap.** Every render logs model, tier, resolution, pose and cost in cents, against a daily ceiling that *stops rendering* rather than paging you. Under §0.3 this stopped being hygiene and became the thing that keeps the project alive. Enforce it at the single chokepoint in `packages/render` that CLAUDE.md names, and have `cost-auditor` check nothing bypasses it.

**The honest-failure path (C6) before the happy path is polished.** Principle 1 made concrete, the best thing in the mocks, and the branch that gets skipped when you're chasing a demo.

### 8.4 The build loop, per increment

Increments of ≤400 diff lines. For each: you write the test names → Claude Code plan mode, scoped → implement, hooks keeping it honest → `spec-auditor`, `privacy-reviewer` and `cost-auditor` on the diff, parallel and read-only → Antigravity reviews the diff cold → explain-back, blast radius, merge.

Increment 1 is a walking skeleton: hardcoded product, hardcoded photo, one tier, one pose, straight to a page. **Prove the spine before you decorate it.**

---

## 9. M3 — The graph (~1 week)

Take `renderPoseSet()` from M2 — by now you've watched it work and watched it fail — and turn it into the Cloud Workflow in §5. Nodes become Cloud Run services running Genkit flows; the M1 scorers become gate nodes; failure routes become explicit edges rather than nested try/catch.

What you get: retries per step rather than per job, an execution history that shows exactly which node failed, jobs that survive a deploy, and the ability to change the recovery policy for "garment fidelity failed" without touching the path for "face match failed."

What you learn: graph engineering on a system where the graph is obviously the right shape — the only way to develop judgement about when it isn't.

---

## 10. What to skip

- **Don't build an agent framework.** You'll be tempted around week three. Claude Code plus hooks plus a CI DAG covers it.
- **Don't build a design system.** `Design.md` §11 has the tokens; feed them to Tailwind and move on.
- **Don't reach for Postgres** until the tripwire in §8.2 actually fires.
- **Don't add MCP servers you don't need.** Each costs tool-list tokens in every context.
- **Don't parallelise implementation before M4.** Nothing before it is decomposed enough.
- **Don't write the iOS app.** Web first was the decision; revisit after M5, with data.
- **Don't chase fit-in-words.** Principle 3 killed it. It'll keep looking tempting. It's still a claim about a body you measured with one number.
- **Don't build an eval matrix before you've looked at 500 images by hand.** The whole of §2.

---

## 11. Open questions this plan doesn't answer

- **Supply.** Every mock assumes a curated catalogue exists. It doesn't. Affiliate feed ingestion is unscoped here and it's a real milestone, not a weekend.
- **The §13.3 ceiling and date.** Under §0.3 you're choosing option (c). Both the monthly ceiling and the date by which (a) or (b) must be true are yours to write, and they belong in the ADR at the end of M1.
- **Whether a self-hosted VTON stays on the table.** At $0.003–0.010 per image it's the only path to the $0.25 target. M1 tells you whether Gemini clears the quality gate; it doesn't tell you whether you'll ever need the cheaper one. Keep the provider interface behind one abstraction so the answer stays cheap to change.
- **Base Look vs House Style** (§8 D5, flagged "resolve before build"). Doesn't bite until the designer back office, but it's a data-model decision — settle it before the schema hardens.
- **Employer IP.** §17 lists it as a risk with no mitigation. Resolve it before the first commit.
