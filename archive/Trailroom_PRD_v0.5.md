# Trailroom — Virtual Try-On Product Requirements

**Owner:** Tejas · **Status:** Draft v0.5 · **Date:** Aug 23, 2026
**One line:** One photo of you, and every piece from the labels you follow comes back on your body — in four poses — before you buy.

**v0.5 changes — reconciliation with the Mobile, Desktop, and Desktop Designer mocks.** This revision exists because the mocks and the PRD had drifted into describing two different products. The mocks are the later and more considered artifact, so they win on interaction design; the PRD wins where the mocks quietly crossed a strategic or legal line. Every change below is a decision, not a merge:

1. **Name is Trailroom.** "OnMe" is retired. Consumer app at `trailroom.ai`, designer back office at `studio.trailroom.ai`.
2. **A try-on is four poses, not one image** (Front, Three-quarter, Walking, Close detail). This is the single largest change in the document. It is a 4× multiplier on the biggest cost line and it *inverts* the v0.4 split-routing conclusion — see §10 and §13, where the numbers are redone honestly.
3. **The share sheet and screenshot try-on are demoted to Phase 2.** They appeared in no mock across three iterations. §9 is kept as a strategic argument and a Phase 2 spec, not a v1 surface, and §13 is rebuilt without the share revenue that used to carry 60% of it.
4. **The feed is hybrid.** A standing buffer of **five pre-rendered cards, one pose each**, refilled only once the user has actually viewed the previous batch. Everything below the buffer is the label's own photo with "Try it on." This replaces both the v0.4 "5–10 pre-rendered per day" feed and the mocks' render-nothing-until-tapped catalogue.
5. **Email is the return trigger. Push is P2.** Per the mocks ("Email only. We don't send push"). The weekly *personalised digest* is deleted; in its place, a triggered email when a followed label adds something, and a weekly email covering new catalogue arrivals. §12 is rewritten.
6. **"Fit in words" is cut from the product.** The mocks ship height-based fit sentences ("Hits mid-calf on you", "Needs the hem taken up on you"). Principle 3 wins: we show how it *looks*, never how it *fits*. **This requires mock changes, not PRD changes** — see §19.
7. **Guest gating is settled at one behaviour across all three surfaces.** The mocks currently implement three different auth models. §7 C1 specifies one: render is generated at full quality, poses are *visible*, and only actions are locked. See §19 for what each mock has to change.
8. **Desktop is a first-class product**, not "web for polls." Full shopper web app plus a designer back office. §5 platform rewritten.
9. **New concepts adopted from the mocks:** the try-on queue, named Lists (replacing "Closet"), the Asks inbox, Compare (desktop), "Wear it with" outfit renders, the honest-failure screen, and designer House Style. All are in §6 and §7.
10. **The five labels in the mocks are placeholder brands**, not a repositioning. Beachhead, AOV, and the affiliate-feed supply plan are unchanged from v0.4.

**Superseded:** v0.4's degraded-vs-full-quality guest render debate is closed (full quality, actions gated). v0.3's removal of the forced brand-follow step is reversed — the mocks force three follows after signup, and that is now the spec.

---

## 0. TL;DR — the verdict before the document

1. **The strongest idea is still "the labels you follow, already on you."** Capture-once is table stakes; the follow graph plus a feed that arrives partly pre-rendered is the destination. The mocks weakened this by rendering nothing until tapped; §10.2's five-card buffer puts it back at a cost we can actually pay.
2. **"Try-on app" is a graveyard.** Google shut Doppl down Apr 30, 2026 and folded try-on into Search and Shopping. Doji raised $14M for roughly this brief. The defensible position is narrower: **the labels you follow, on you, and a decision you make with friends** — with independent designers as the supply moat and one identity reused across apparel and jewellery.
3. **Three things decide the outcome, and none is a feature:** (a) render fidelity on real photos of real bodies; (b) render cost against affiliate revenue — now 4× harder than in v0.4 because a try-on is four images; (c) supply — the mocks assume a curated catalogue exists on day one.
4. **Four poses is the decision to interrogate hardest.** It is the best thing in the mocks — a single front-on render is a picture, four poses is a fitting room, and "Walking" is the pose that answers a question a product shot cannot. It is also the reason the v0.4 economics no longer close. §13 shows the honest table: at four poses, routing on-demand renders to the expensive API tier is no longer affordable, which reverses the central cost conclusion of the last three revisions. Pick one of three exits deliberately (§13.3) rather than drifting.
5. **The share sheet was the second-best idea in v0.2–v0.4 and it has now been designed around three times without appearing.** That is evidence, not an oversight. Demoted to Phase 2. The consequence is stated plainly rather than buried: launch revenue per user drops to roughly half of what v0.4 projected — $0.45 against $0.80 — because explicit-intent renders were carrying it.
6. **Fit-in-words is the most tempting thing in the mocks and we are not shipping it.** "Hits mid-calf on you" is a claim about a body we have measured with one number. Get it wrong on a $328 coat and the trust cost is the whole product (Principle 1). The geometry is real and we may earn the right to it later with real measurement — not with a height dropdown.
7. **Monetisation order is unchanged and now slower:** affiliate day one → sponsored drops (the real business) → designer tools. The mocks add a stated designer take rate (8% on a referred sale) that the PRD never had. That is a decision worth making on purpose (§13.1).

---

## 1. Customer problem

### 1.1 The core problem
When you shop for anything worn on the body, the question that stops the purchase is **"will this look good on me?"** Product photography answers a different question — "will this look good on a model?" — and the gap between the two is where returns, abandoned carts, bracketing, and forty-message group-chat deliberations live.

**Evidence** (order of magnitude; verify before external use):
- Online apparel return rates are commonly cited at 20–30%, roughly 2–3× in-store, with fit and "didn't look as expected" the top stated reasons.
- US retail returns were reported at roughly $850B in 2025.
- Jewellery scale — earring drop length, necklace length against a neckline, ring width on a finger — is close to impossible to judge from a product shot on white.

**What the mocks added to this problem statement, and it is a good addition:** a single front-on render answers "what does it look like." It does not answer "what does it look like when I move," which is the actual question behind a coat's length or a bias-cut dress's drape. Four poses is the mocks' answer, and it is why they are worth the cost fight in §13.

### 1.2 Why existing try-on doesn't solve it

| Approach | What it does | Why it falls short |
|---|---|---|
| Retailer-embedded try-on (Google Shopping "Try it on", Amazon, Zalando, Sephora/ModiFace) | Try a product from its own listing | A tool, not a habit. Siloed per retailer. You re-supply a photo per site. No memory, no social, no reason to return. |
| Google Doppl (shut down Apr 30, 2026) | Standalone avatar app from Google Labs | Required active intent to open; nothing pulled you back. Google moved the capability into Search/Shopping. |
| Doji | Avatar + social sharing + brand preferences | Closest competitor. Framed around play; avatar build historically ~30 minutes; early users reported avatars rendered thinner or taller than reality. |
| AR makeup (Perfect Corp/YouCam, ModiFace, Pinterest) | Live-camera makeup | Mature, commoditised, real-time. A photo product will not beat them at SKU-level lipstick. |
| LTK / ShopMy | Creator affiliate feeds | The model is the creator, never you. |

### 1.3 The problem by category — and the photo each one needs

| Category | Moment of doubt | Input photo | Render difficulty | Frequency |
|---|---|---|---|---|
| Apparel | "Does this cut work on my body?" | Full body, front, neutral pose, fitted clothes, good light | High (drape, length, proportion, pattern fidelity) | Weekly |
| Earrings / necklaces / pendants | "Is this too big / too long for me?" | Face + neck/décolletage, hair back | Medium (rigid object, scale and lighting) | Monthly |
| Rings / cuffs / bracelets | "Will it look chunky on my hand?" | Hand or wrist | Low–medium | Monthly |
| Makeup (Phase 3) | "Is this shade right for my skin?" | Face, bare/neutral, even light | Medium | Weekly for engaged users |

The reuse map is the design: one selfie covers earrings, necklaces and identity verification; one full-body photo covers all apparel; the hand is a progressive unlock. The mocks implement exactly these three slots (`body`, `face`, `hand`) in the Studio, which is correct.

### 1.4 The deeper bet
This product **digitises you** — a consented, persistent, reusable model of your body, face and hands — and layers a commerce discovery engine on top. The four-pose set is the atomic unit, the identity set is the asset, and the follow graph plus the pre-rendered buffer is the engine. No single retailer owns your body across brands; that is the moat a neutral product can build and Google/Amazon structurally will not.

---

## 2. Why it is worth solving

- **Universal and frequent.** Everyone buys apparel; fashion-engaged users browse weekly and shop monthly. Jewellery adds adjacent frequency with the same identity.
- **Peak intent.** A photorealistic image of *you* wearing a *specific product* is the highest-intent impression in commerce.
- **Money at the moment.** Affiliate links monetise intent immediately with no sales team. Later, brands pay to place drops into personalised feeds.
- **Compounding assets.** Identity set + preference graph + follow graph. Each try-on improves ranking; each follow improves supply prioritisation.
- **Prize.** US online apparel is on the order of $150B+/yr. 0.1% of it at a 7% blended commission is roughly $10M/yr — respectable, not the business. Sponsored drops are the step change (§13).

---

## 3. Why now

1. **Model capability crossed the line in 2025–26.** Identity-preserving garment transfer from a single photo is a prompt-level capability in general image-edit models, and strong open-weight VTON models exist for self-hosting. **Multi-pose generation from one source photo is the newer and less proven half of this** — it is the technical risk the mocks introduce, and it needs its own line in the Phase 0 eval (§16, §18).
2. **Cost is falling but is not free.** Roughly $0.045 (512px) to $0.067 (1K) per image on current API tiers, ~$0.034 batched, ~$0.02 on fast tiers; self-hosted open VTON on an L4-class GPU is on the order of $0.003–0.01. At four images per try-on, this is the constraint that dictates §10.
3. **Supply rails exist.** Affiliate networks ship product feeds with images, prices, stock and tracked links. Shopify merchants and independent designers can upload directly.
4. **Behaviour is already there.** "Should I get this?" in group chats, drop culture, "on the model vs on me" as an established content format.
5. **Incumbent posture is legible.** Google put try-on inside Search; Amazon inside Amazon. Neither will build a cross-retailer, follow-your-designers destination with private social decisions. Doji is the one to beat.

---

## 4. Product principles

1. **Trust beats wow.** Never show a render that fails the quality gate. A bad render costs more than a missing one. The mocks' honest-failure screen (§7 C6) is this principle made visible, and it is the best thing in them.
2. **Your body, as-is.** No slimming, heightening, skin smoothing or feature "enhancement." Proportion fidelity is a correctness requirement, measured and gated across all four poses.
3. **Look, not fit — and this survived the mock review.** We show how a piece looks on you. We do not tell you how it will fit, where to take a hem, or what size to order. Sizing is a separate product and a partner integration later. **The mocks' height-based fit sentences are out of scope and must be removed (§19).** The line is precise, not squeamish: rendering a coat at its true length on your body is the product; writing "needs the hem taken up on you" underneath it is a claim we cannot stand behind from one number.
4. **Capture once, reuse everywhere.** Ask for another photo only when it unlocks something the user can see immediately.
5. **Private-first social.** Sharing goes to friends and group chats. Recipients vote **without an account and without installing, full stop.** There is no public feed of anyone's renders. The mocks honour this exactly and their copy — "One tap, no sign-in" — is the spec.
6. **A prepared feed, not a search box.** The top of Discover is already on you when you open it. Search and browse exist for intent, not as the default loop.
7. **Every render earns its cost.** Render budget is a function of demonstrated consumption, not a flat allowance. The five-card buffer refills only when the previous five have been viewed (§10.2) — this is the mechanism, not an aspiration.
8. **Consent is a feature.** Plain-language photo controls, real deletion, no training on user photos by default, visible AI labelling on every output. Consent and age verification happen **before the first photo is captured**, for every user, signed in or not. **No mock currently implements this as a blocking step (§19).**
9. **Honest failure beats a confident guess.** When we cannot isolate a garment, we say so, we offer the closest three we *can* render, and we offer to email when the label sends a better photo. Adopted wholesale from the mocks.

---

## 5. Scope and sequencing

**Beachhead user:** US women 18–34 who follow contemporary and independent labels and consult friends before buying.
*Note on the mocks:* the five labels in all three prototypes — Ansel Ward, Marchand, Loam Studio, Cyra, Fen & Row — are **placeholder brands**, not a repositioning toward high-AOV indie tailoring. The price points shown ($86–$520) are illustrative. Beachhead, AOV ($85 blended), and the affiliate-feed supply plan of §8 are unchanged. If we later decide the indie-only world in the mocks *is* the product, that is a separate decision that rewrites §13 entirely.
*Rejected:* men 18–34; all-genders launch; occasion dressing as the sole wedge (keep as a Lists use case — "Wedding in September" in the mocks is exactly right as a *list name*, not as a product mode).

**Category sequencing**

| Phase | Categories | Rationale |
|---|---|---|
| 1 | Apparel (tops, dresses, outerwear, bottoms, scarves), earrings, necklaces, pendants | One full-body photo plus one selfie covers all of it. |
| 1 (behind progressive capture) | Rings, cuffs, bracelets | The mocks ship these with a `hand` slot in the Studio from day one. Adopted: the items are in the launch catalogue, but the hand photo is a progressive unlock (§7 C5), so they cost nothing until a user asks. |
| 2 | Watches; share-sheet and screenshot ingestion (§9); makeup exploration | |
| 3 | Shoes, bags, sunglasses; makeup at SKU level | |
| Spun out | Cosmetic dental | Separate product, separate PRD. Shares the identity and capture service only. |

**Platform — rewritten. Desktop is a product, not a courtesy.**

| Surface | Status | What it is for |
|---|---|---|
| iOS app | P0 | The beachhead's primary surface. Capture, queue, Discover, Lists, You. |
| Desktop web app (`trailroom.ai`) | **P0 — fully specified in the Desktop mock** | Discover, product, render queue, Compare, Your try-ons, Lists, Studio. Higher AOV, work-hours browsing, and the only surface with Compare. |
| Web vote page (`trailroom.ai/ask/…`) | P0 | No account, no install. Both mocks specify it identically. |
| Designer back office (`studio.trailroom.ai`) | **P0 for a hand-recruited cohort** | Verification, catalogue readiness, demand signal, publish-to-followers, house style. |
| Android app | ~3 months post-launch | |
| Browser extensions, share sheet | Phase 2 (§9) | |

This is a significant expansion of v0.4's "iOS first, web from day one for shared polls." The honest cost: three shipped surfaces at launch instead of one and a half. The honest benefit: Compare only works on a wide screen, and Compare is one of the strongest journeys in any mock.

**Login:** Google and Apple (Apple requires Sign in with Apple whenever a third-party login is offered). Desktop additionally offers email link. Requested at the points specified in §7 C1 — never at app open.

**Out of scope for v1:** fit or size prediction (Principle 3), public profiles, in-app checkout, video renders, lingerie, men's catalogue, push notifications (P2), share sheet and screenshot ingestion (Phase 2), TikTok/Reels frame extraction.

---

## 6. Core concepts and data model

- **Identity Set** — the user's base photos by slot: `FullBody-Front`, `Face-Front`, `Hand`. Each slot holds *multiple* photos with one marked **default** (the mocks' Studio does this and it is correct: users want a "front, plain wall" and a "three-quarter" and to choose). Each photo carries a quality score, capture source (live vs. gallery), face-match verification status and freshness date. Can originate from a Guest Session.
- **Guest Session** — a device-bound, pre-account identity created during first capture. Same slot structure, no account attached. Auto-attaches on sign-up with no recapture; purged 24–48 h after creation if no account is ever created (§15).
- **Base Look** — a normalised derivative of the default `FullBody-Front` (background cleaned, lighting normalised, pose and body untouched) shared by all apparel renders, so two try-ons are visually comparable. **This is in direct tension with designer House Style (below) and the conflict must be resolved — see §8 and §19.**
- **Catalog Item** — a product with try-on-ready assets, price, stock, affiliate or purchase URL, brand/designer, attributes, and a **render readiness score** (0–100) with reason codes. The mocks surface this score to designers verbatim; adopted.
- **Drop** — a set of new Catalog Items from one label with a release timestamp, published by the designer or detected by catalogue diff.
- **Pose Set (the render unit)** — (Identity slot + Catalog Item + Base Look) → **four images**: `Front`, `Three-quarter`, `Walking`, `Close detail`. QA scores are computed per pose *and* for cross-pose identity consistency. A try-on is a Pose Set; the word "render" in this document now means one image inside one, and cost is always quoted per image.
- **Feed Card** — a Catalog Item in Discover, in one of two states: **on you** (backed by a pre-rendered pose or a completed Pose Set) or **label photo** (the brand's own shot, with "Try it on"). The five-card buffer in §10.2 governs how many are in the first state.
- **Try-on Job / Queue** — an asynchronous, walk-away-able render job. The user starts it and keeps browsing; a persistent chip in the top bar shows progress; completion raises a toast on desktop and a toast plus (P2) a push on mobile. First-class in all three mocks and adopted as the default interaction for every try-on.
- **List** — a *named* collection of items ("Wedding in September", "Work capsule") with their renders. Replaces v0.4's "Closet." A user has many. Lists carry price-change tracking and are **the unit an Ask is built from**.
- **Ask** — a shareable web object built from a List, with 1–4 items and a question. Recipients vote in one tap with **no account and no install**; the asker sees counts, never who voted for what. Expiring links (7-day default), revocation, watermark and AI label.
- **Asks Inbox** — asks *received* from other Trailroom users, with unread badges. New in the mocks; adopted. Note the second-order effect: this only works between users who know each other inside the product, which is a social graph the PRD did not previously have. See §19.
- **Compare Tray** — up to 4 tried items held for side-by-side viewing at a synchronised pose (desktop only).
- **Outfit** — two or more items rendered together on one Pose Set ("Wear it with"). Each piece also persists as its own try-on.
- **Follow** — user → label; drives the pre-rendered buffer, the new-arrival email, and ranking.
- **House Style** — a designer-selected lighting and crop treatment applied to renders of *their* pieces. New in the mocks. Conflicts with Base Look; see §8.

---

## 7. Customer CUJs

P0 = launch · P1 = within 90 days · P2 = later.

### C1. First session → magic moment

**Goal:** a real, four-pose try-on of *you* in something you'd actually want, before we ask for an account — and everything it unlocks the moment an account exists.

**Two entry paths, both mocked, both supported.** The mobile prototype ships them as journeys C1 and C2, and they are genuinely different users:

- **Path A — photo first ("Upload first, then browse").** A cold visitor lands on Discover and sees the **proof slider**: the label's photo on one side, a real person's rendered photo on the other, draggable. Copy: *"Maya uploaded one photo. Now every piece here comes back on her body, in four poses."* → "Upload your picture" → capture → *"Your photo is in. Pick anything below and it comes back on you in four poses"* with four suggested starters.
- **Path B — item first ("Try-on first, then upload").** The visitor taps a product, hits "Try it on", and is asked for a photo at the moment it is obviously needed.

The proof slider is the mocks' best acquisition idea and has no equivalent in any prior PRD version: it demonstrates the capability on someone else before asking a stranger for a photo of their body. It appears on Discover, on the product page, and on the vote page. Adopted as P0 on every signed-out surface.

**Steps (canonical — both paths converge here)**
1. **Discover with no auth wall.** Proof slider above a browsable grid of curated new arrivals. Category chips (Everything / Apparel / Jewellery / Accessories).
2. **Photo required.** Either the user chose "Upload your picture" (Path A) or tapped "Try it on" on an item whose slot has no photo (Path B).
3. **Consent and age gate — before the camera or the photo picker opens, first time only, for guests and signed-in users alike.** Plain-language screen: what we store, retention, deletion, no training by default, explicit biometric consent where state law requires it, and age verification. **Not skippable by staying signed out.** *No mock implements this today — all three show privacy as a passive disclosure panel. This is the most serious gap in the set (§19).*
4. **Live selfie, required for everyone, first.** Two seconds, auto-capture on pose and lighting OK. It verifies the person and powers jewellery. Every mock's privacy copy already *claims* this mechanism ("matched to a live selfie so you can only try things on yourself") while no mock's flow performs it. Either the flow gains the step or the copy is a lie; the flow gains the step.
5. **Slot photo.** Camera-roll candidates surfaced by an on-device scan ("From your camera roll · these three will work"), or guided capture with silhouette overlay, auto-capture and cues ("Step back a little" → "A little more light" → "Hold it — 3" → "Looks good"). Quality check with instant fix-it feedback. Face-match against the live selfie before the photo becomes a base image.
6. **The Identity Set is created inside a Guest Session** — device-bound, survives app restarts, auto-attaches to an account whenever one is created. No recapture, ever, for signing up late.
7. **Render the Pose Set at full quality.** Same model tier and same QA gate as any authenticated try-on. The queue screen shows the four tiles filling in ("Rendering pose 2 of 4"), and **"Keep browsing while it renders"** is available throughout. Target: all four poses visible ≤ 15 s after capture.
8. **Account prompt — over a visible render, gating actions only.** The four poses are on screen at full quality. A sheet rises: *"Four poses are ready — create an account. They're yours to keep."* It is **dismissible**, and dismissing returns the user to the poses at full size. What is locked is every action: download, save to a list, buy, ask friends, follow. **This is a change all three mocks need (§19)** — mobile currently blocks the full-size result behind an undismissable gate, and desktop silently creates an account when a photo is accepted.
9. **Sign up → same asset unlocks, no re-render.** The Guest Session and the Pose Set attach to the new account. Actions unlock in place.
10. **Post-signup onboarding, two steps, from the mobile mock.** *Step 1 of 2 — Stay in the loop:* email address plus three toggles (new pieces from labels you follow · when a friend votes on your list · price changes on your lists). *Step 2 of 2 — Pick three labels:* the button stays disabled until three are selected. **This reverses v0.3's removal of the forced follow step.** It is the right reversal: follows feed the pre-rendered buffer and the supply-health metric, and three taps after a user has already seen themselves in something is a far cheaper ask than three taps before.

**The screenshot leak.** A visible, ungated render is screenshot-able. Two things contain it: the in-pixel AI label (§15), and the fact that what is gated is action, not appearance — a screenshot cannot be polled, bought through, or kept in a list. Measure the screenshot-without-signup rate in Phase 0; if guests are satisfied and leaving, the sheet's copy and timing work harder, the pixels do not get worse.

**Guest limits — and they are 4× more expensive than in v0.4.** One free Pose Set per Guest Session. A second try-on while signed out prompts sign-up instead of spending another four images. At $0.045/image a guest Pose Set is **$0.18**, so at the §14 hypothesis of 40% conversion that is ~$0.45 of render per acquired account, and ~$1.20 at 15%. Still cheap against paid-install CAC, but four times v0.4's figure and no longer trivially ignorable. Guests who never sign up have photos and renders purged in 24–48 h.

**Features:** P0 — proof slider on all signed-out surfaces; Discover with no auth wall; both entry paths; consent-and-age-gate module (blocking, pre-capture); live-selfie capture and face-match; on-device candidate scan; guided capture with cues and auto-capture; capture quality scorer; Guest Session with auto-attach; full-quality guest Pose Set with actions gated and pixels visible; in-pixel AI label; unlock-in-place on signup; one-Pose-Set guest cap and 24–48 h purge; two-step post-signup onboarding (email prefs, then three follows). P1 — multiple base looks (hair up/down, with glasses); "ask someone to take it" mode.

**Metrics:** proof-slider interaction rate on signed-out Discover · open → photo started · photo started → capture completed (first-attempt success > 85%) · capture → four poses visible (p50 < 60 s, p90 < 120 s) · **guest Pose Set → sign-up conversion** · screenshot-without-signup rate · sign-up → actions unlocked latency (~instant) · Guest Session → account attach success (~100%) · completion of the two onboarding steps · follows at end of onboarding (should be exactly 3 by construction; the D7 question is whether it grows).

### C2. Coming back: a feed that is partly already on you

**Goal:** the user returns without remembering to, and the first thing they see is themselves.

**The hybrid feed — this is the v0.5 resolution of the biggest PRD-vs-mock gap.** The PRD promised 5–10 pre-rendered images per user per day. The mocks pre-rendered nothing. Neither is right:

- Discover holds a standing buffer of **five pre-rendered cards, one pose each (Front)**, at the top of the feed.
- The buffer **refills only after the user has viewed the previous five.** No consumption, no spend. A user who installs and never returns costs five images, once — not five a day.
- Ranking for the buffer: new pieces from followed labels first, then the taste model, then items paired with something already in a List.
- Everything below the buffer is the **label's own photo** with a "Try it on" button — exactly as the mocks show it. Tapping it opens a Pose Set job (C3).
- Tapping a pre-rendered card renders the remaining three poses on demand and opens the full Pose Set.

That last rule is what makes the buffer honest: the cheap pre-render is a *hook* at one image, and the expensive three only get spent on a card the user actually chose.

**Return trigger — email, not push.** Push is P2 (§12). Two sends carry the loop: a triggered email when a followed label adds something, and a weekly email of new catalogue arrivals.

**Steps:** email → open → five cards already on you → scroll into label photos → per-card actions: Try it on · Add to a list · Buy · Follow the label · Compare (desktop) → tap a pre-rendered card → three more poses → Pose Set.

**Features:** P0 — feed ranking service (follows, list adds, dismissals, dwell, click-outs, price band, style embeddings); five-card pre-render buffer with view-gated refill; label-photo cards with try-on CTA; shelf labels ("New in", "From a label you follow", "Popular this month", "Goes with your slip dress" — the mocks' shelf copy is good and is the spec); category chips; Compare selection (desktop). P1 — "not for me" negative feedback (**absent from every mock and needed by the ranker**); occasion modes. P2 — push notifications; wardrobe ingestion.

**Metrics:** WAU · buffer view-through rate (what fraction of the five get seen — this is what gates spend) · pre-rendered card → full Pose Set conversion · try-ons per WAU per week · list-add rate · click-out rate · W1→W4 retention · email click rate.

### C3. The try-on queue

**Goal:** starting a try-on never costs the user their place.

New as a first-class CUJ; all three mocks build it and none of the prior PRD versions named it.

**Steps:** "Try it on" → confirmation sheet naming which photo will be used (*"Using your default full-body photo. Four poses come back in about ten seconds — you don't have to wait here"*) with "Use a different photo" → job starts → persistent chip in the top bar ("Putting the wool car coat on you · pose 2 of 4 · you can keep browsing") → user browses freely → completion toast with a thumbnail: *"Four poses of the wool car coat are ready. See it."*

**Features:** P0 — job queue with per-user concurrency limits; default-photo confirmation with override; progress chip; completion toast with deep link; queue survives navigation and (mobile) app backgrounding. P1 — batch try-on from a List; queue priority for users who wait on screen.

**Metrics:** try-ons started per session · % started jobs whose result is opened within the session · % opened later from the toast/email · median jobs in flight per user · abandonment (job completes, never opened).

### C4. Decide with friends: Lists, Asks and the vote page

**Goal:** turn the group chat into the acquisition channel.

**Steps (asking):** save pieces into a named List → "Ask friends to pick" → share sheet to iMessage / WhatsApp, or copy link → recipient opens `trailroom.ai/ask/…` → **votes in one tap with no login, no account, ever** → results land in the List and in an email → Buy.

**Steps (receiving):** a friend who *is* a user gets the ask in their **Asks inbox** with an unread badge → opens → one tap to vote → *"Sent. Priya can see it."* → then the cross-sell the mocks get right: *"You have a photo on file — try this on yourself while you're here."*

**The vote page is an acquisition surface, and the mocks treat it as one.** It carries the proof slider, an "AI PREVIEW" label, and after voting: *"Now put the slip dress on you — drag the divider… One picture of you and it comes back in four poses. Free, private, yours to keep."* Plus a lower-commitment "Just browse first."

**A voter is not a Guest Session.** No photo, no capture, no identity of any kind. The only bridge is explicitly tapping "See it on me."

**Features:** P0 — named Lists; Ask object built from a List; web vote page with no login (device-fingerprint rate limiting only, never an auth wall); proof slider and "see it on you" CTA on the vote page; OG image generation; **expiring links (7-day default) and revocation** (specified here, *not built in either mock* — §19); AI label on every rendered image on the vote page; Asks inbox with unread state; anonymous vote counts (the asker sees totals, never who voted for what — the desktop mock states this and it is the spec); result email. P1 — named voters as an opt-in; comments.

**Metrics:** asks created per WAU · recipients per ask · vote rate · recipient → install (k-factor; target ≥ 0.4) · ask → purchase rate · vote-page proof-slider interaction rate · in-app ask response rate.

### C5. Progressive capture (unlock a category)
**Trigger:** tapping a ring or cuff with no hand photo, or an unlock card at the end of Discover.
**Steps:** 10-second guided hand capture → the requested piece renders immediately in four poses.
**Features:** P0 — slot-specific guided capture; slot-aware ranking (never surface hand-slot items above the fold before the slot exists); unlock cards capped at one per session and suppressed after two dismissals. *The unlock card is absent from every mock — the hand slot is only reachable from the Studio (§19).*
**Metrics:** unlock prompt CTR · capture completion · incremental try-ons and list-adds after unlock.

### C6. When we can't render it — the honest failure
**Goal:** no dead ends, and no confident guesses.

Adopted wholesale from the mocks, which handle this better than any previous PRD draft.

**Steps:** user taps "Try it on" on a piece whose source imagery can't be isolated → a screen that says so plainly: *"We couldn't render this one honestly. The only photo MARCHAND gave us has the jacket folded over an arm, so we can't tell where the hem falls. We'd rather say so than show you a guess."* → **"Closest three we can put on you"**, each tappable straight into a try-on → **"Email me if we get better photos."**

The email request is the loop that closes on the supply side: the designer back office surfaces *"41 shoppers asked to be emailed when this renders"* and, on upload, *"one front-on photo each and 486 people get an email that day."* That is the highest-conversion supply nudge in the product.

**Features:** P0 — readiness-gated try-on (block before spending a render, not after); honest-failure screen; closest-three near-match via image-embedding search; "email me when ready" waitlist per item; designer-side waitlist counts and fulfilment email. P1 — auto-retry when the catalogue improves.
**Metrics:** % of try-on attempts hitting honest failure (target < 8%) · closest-three tap rate · waitlist sign-up rate · waitlist → render → email → return rate · time from designer photo upload to waitlist email.

### C7. Compare (desktop)
**Goal:** the decision the feed can't make for you.

**Steps:** select up to 4 tried pieces into a tray from Discover or Your try-ons → Compare (or press `C`) → side-by-side columns, **the same photo, the same light, the same crop, at a synchronised pose** you can switch across all columns at once → per-column price, stock and Buy → *"Can't call it? Put these in a list and let your friends vote"* → Add all to a list.

This is the strongest desktop-only journey and the clearest argument for building desktop at all. It also depends entirely on Base Look normalisation being real (§6) — if designer House Style varies the lighting per label, a cross-label comparison is not a comparison.

**Features:** P0 (desktop) — compare tray with 4-item cap; pose synchronisation; keyboard navigation; add-all-to-list. P1 — compare on mobile (two items, swipe).
**Metrics:** % of desktop sessions using Compare · items per comparison · compare → buy rate vs. product-page → buy rate · compare → list rate.

### C8. Wear it with (outfit renders)
**Steps:** on a completed Pose Set, "Wear it with" suggests paired pieces → preview sheet showing the pair with combined price → "Add it — $568 together" → both pieces render together as one outfit Pose Set, *and* each persists as its own try-on → Buy the outfit.
**Features:** P0 — curated pairings per item; pair preview sheet; outfit Pose Set; combined checkout hand-off (two affiliate links, sequenced). P1 — user-built outfits from any two tried pieces. P2 — pairing against the user's own wardrobe.
**Metrics:** pair preview rate · pair → outfit render rate · outfit → multi-item click-out · AOV on outfit click-outs vs. single.

### C9. Follow labels
**Steps:** follow from any card, from the product page, or from the forced three-label step in onboarding (§7 C1) → new pieces from that label enter the pre-render buffer and trigger an email → manage follows in the Studio.
**Features:** P0 — follow graph; drop detection via catalogue diff and designer publish; follow management; per-label email setting. P1 — "labels like this"; designer spotlights.
**Metrics:** follows per user (≥ 5 by D7; onboarding guarantees 3) · % WAU receiving ≥ 1 followed-label drop per week (supply health) · new-arrival email CTR.

### C10. Buy, and did it arrive
**Steps:** Buy → sheet naming the hand-off (*"You check out on ANSEL WARD's own site. We keep this try-on here, and ask once whether it arrived"*) → affiliate deep link with size and colour carried over where known → retailer checkout → conversion postback → **one question, once: "Did the wool car coat arrive?" → "Yes, it's mine" / "Didn't buy it"** → owned items marked in Lists → "Wear it with" suggestions.

The mocks turn that one question into a supply-side quality metric: the designer dashboard reports *"94% said the render matched — the six percent who disagreed all named colour, not fit."* That is a better honesty signal than the in-app "doesn't look like me" report, because it is checked against the physical object. Adopted, and promoted to P0.

**Features:** P0 — affiliate link generation per network; checkout hand-off sheet; conversion attribution; price and stock sync; post-purchase single-question survey; render-match rate by piece and by reason code. P1 — variant-level deep links; "kept / returned — why?". P2 — in-app checkout for designers.
**Metrics:** click-out rate · click → order conversion · GMV · commission revenue · attribution coverage · survey response rate · **render-match rate** (target ≥ 90%, with reason-code breakdown).

### C11. Lists
**Features:** P0 — multiple named lists; add from anywhere; list detail with renders; price-change tracking on list items; "ask friends" from a list. P1 — back-in-stock alerts; sharing a list read-only.
**Metrics:** lists per user · items per list · list-add rate per try-on · price-alert CTR · alert → purchase.

### C12. Studio and privacy controls
**Steps:** see every stored photo by slot; add, remove, and set the default per slot; see every try-on ever made ("Nothing expires, nothing is public"); manage email preferences; manage follows; see the plain-language privacy panel; delete one photo or all; export; delete account.
**Features:** P0 — photo vault with per-slot defaults; try-on archive; deletion pipeline with SLA; consent log; data export; email preference centre. *The mocks build all of this except deletion, export and the consent log (§19).*
**Metrics:** deletion SLA compliance (100% within 24 h) · default-photo change rate · privacy support tickets per 1k users.

---

## 8. Designer and brand CUJs (supply side)

**Who:** (a) **Brands** ingested from affiliate feeds — no action required; they can claim their page later. (b) **Designers** — independent labels, Shopify merchants and boutiques who self-serve through `studio.trailroom.ai`.

**Value proposition:** *"Your next collection on 10,000 real bodies before you produce it."* Demand signal before a production run. Big brands get this from their own data; indie designers never have.

The Desktop Designer mock is the most complete artefact in the set and is adopted almost verbatim. Note the roadmap consequence: v0.4 filed designer self-serve as Phase 2 / P1. A back office this finished is a launch commitment (§18).

### D1. Verify the label
Three steps, none skippable, and **nothing renders on a shopper until all three are green**: domain email verified → store linked (products imported with price, stock and size) → human review (the first 500 labels are reviewed by a person, usually within a day). Terms include an IP warranty on uploaded products, a rights grant to render them onto users, and a takedown process.

**What a shopper never sees, stated to the designer up front** — adopted from the mock and worth keeping as literal UI copy: *their photo, their face, and every render of them; who follows you, who tried a piece, who listed it. You can't buy a lookalike audience from us, and we don't sell one.*

### D2. Catalogue and render readiness
Every piece carries a **render readiness score** with concrete, actionable reason codes — the mock's exact vocabulary is the spec: `Ready` · `No front-on photo` · `Model occludes the hem` · `Blocked — folded over an arm`. Per-piece detail shows the check list (front-on photo · full garment visible · hem not occluded · colour and fabric readable · size and stock synced), each fixable with one upload, re-scored in minutes.

Two numbers make this self-driving: the piece view shows *"41 shoppers asked to be emailed when it's ready"*, and the Signal view aggregates it — *"one front-on photo each and 486 people get an email that day."* This is the C6 honest-failure loop closing on supply, and it is the highest-leverage nudge in the product.

**Features:** P0 — store sync (hourly for price and stock); readiness scorer with reason codes; per-piece fix flow; waitlist counts; fulfilment email on re-score. P1 — bulk CSV/API; auto-segmentation quality feedback.

### D3. Publish to followers
Select ready pieces → *"N pieces → 4,180 followers, rendered on each of them who has a photo"* → publish → renders enter each follower's pre-render buffer within the hour and trigger the new-arrival email (§12).

Note the constraint the buffer imposes and the mock does not yet show: a publish does **not** render on every follower immediately. It enters the top of each follower's buffer, and the buffer only refills on view. Designer-facing copy must say "rendered for each follower who has a photo, as they come back" rather than promising 4,180 renders in an hour. **Mock copy change required (§19).**

### D4. Demand signal
Aggregated and anonymised, never a person, a photo, or a render. Followers · try-ons · saved-to-a-list rate · click-through-to-buy rate, each with a period-over-period delta; try-ons and buy-through by piece; waiting-on-a-photo table; and the post-purchase honesty panel (*"94% said the render matched"* with reason codes).

### D5. House style — **adopted with an unresolved conflict**
The mock lets a designer pick a lighting and crop treatment (Warm daylight / Cool studio / Film) applied to *every* render of their pieces, so their work looks like theirs.

This directly contradicts two things this document and the mocks both assert elsewhere: the **Base Look** normalisation in §6, and the mocks' own Compare copy — *"Same photo, same light, same crop. The only thing that changes is the piece."* Both cannot be true. Three ways out, and one has to be chosen before build:

1. **House style is a catalogue-photo treatment, not a render treatment.** It governs how the label's own imagery is presented; renders always use Base Look. Preserves comparability, gives designers less than the mock implies.
2. **House style applies to the label's own drop page and publish email only** — the surfaces where the label is the context — and never inside Discover or Compare, where the user's body is the context.
3. **House style wins and Compare is scoped to one label at a time.** Honest, but it guts the strongest desktop journey.

Recommendation: option 2. It gives designers a real, visible thing without letting them break the one property that makes cross-label try-on worth using.

### D6. Boost a drop (Phase 3)
Pay to place renders into lookalike users' buffers; CPM or CPA; frequency-capped; labelled "Sponsored"; quality-gated like every other render.

**Commercial terms — new in the mocks and needing a decision.** The mock states *"no listing fee, 8% on a sale we send you."* This is a marketplace take rate on the designer, which v0.4 never had; v0.4 assumed affiliate commission from networks (3–12%) and put marketplace commission in Phase 3. The mock's own buy flow hands off to the label's own site, so 8% is a direct-deal affiliate rate, not a marketplace commission. Either is defensible; drifting between them is not. See §13.1.

**Metrics:** designers onboarded · time to verification · % pieces render-ready · waitlist fulfilment rate · time to first publish · publish reach and buffer-entry rate · designer-side click-through and conversion · render-match rate by label.

**Cold-start supply plan (unchanged):** ingest ~200 brands from affiliate feeds before launch, prioritised by drop cadence × beachhead affinity × commission rate; Skimlinks/Sovrn for the long tail; 30 hand-recruited indie designers at launch with white-glove onboarding. Without ingested supply, "follow labels" is an empty promise on day one.

---

## 9. The share surface — **Phase 2**

The argument for this surface has not weakened; its absence from three consecutive mock iterations is the evidence that it is not a launch surface. It is kept here in full so the Phase 2 decision is made against the real reasoning rather than a summary.

### 9.1 Why it is still the highest-leverage *future* surface
1. **It decouples usage from our send cadence.** Every other retention lever in this document is a scheduling lever. Without it, sessions happen when we email; with it, sessions happen when the user sees something she wants.
2. **It is free demand signal that solves cold-start on supply.** Every failed match is a labelled request: *this user wanted this brand, this item, this price point, today.*
3. **Intent is explicit, so the economics invert.** A feed render is a guess; a shared render is a stated intention — the one place an expensive model tier pays for itself (§13.3).

**What it is not:** an acquisition channel. You cannot share to an app that is not installed.

### 9.2 What the share sheet actually hands you

| Source | What the OS passes | Viable path |
|---|---|---|
| Retailer page in Safari/Chrome | Clean product URL | **Best case.** JSON-LD `Product` / Open Graph → catalogue match or cutout. 85–95% on the top 200 retailers. |
| Instagram post or Reel | A post URL, not a product; Meta blocks unauthenticated fetches | **Fails as a URL.** The path that works is screenshot → share the *image*. |
| TikTok video | Video URL | Frame extraction is a separate pipeline. Accept a paused-frame screenshot. |
| Pinterest pin | Pin URL with a resolvable source image | Second-best after retailer URLs. |
| Photos app (screenshot) | The actual image | Highest volume, hardest CV problem. |
| iMessage / WhatsApp forward | Image or link from a friend | Highest intent of all. |

### 9.3 Extraction difficulty
**Problem A — URL to product:** largely solved, 85–95%. **Problem B — worn-garment photo to transferable garment:** posed, occluded, folded, cropped, compressed. Budget **55–70% acceptable at launch** against 85–95% for catalogue images, and note that four poses raises the bar — a garment isolated well enough for one front-on render may not survive a walking pose.

**The fallback ladder — already built for C6 and reusable here:** exact catalogue match → closest three we can render → direct garment transfer → honest failure plus waitlist plus ingestion queue.

### 9.4 Phase 2 surface plan
iOS Share Extension (URL + image) and Android `ACTION_SEND` ship together. iOS Safari web extension and Chrome desktop extension are Phase 3 — note that **Chrome on Android does not support extensions**, so a Chrome extension is permanently desktop-only, which matters less now that desktop is a first-class surface (§5) than it did in v0.4.

**Implementation constraint:** iOS share extensions run in a ~120 MB host process. The extension captures, enqueues, confirms in under a second and exits; the Pose Set completes server-side and lands in the queue (C3). This composes cleanly with the queue we are already building.

### 9.5 Safety rules (apply whenever this ships)
An image arriving via the share sheet is a **garment source, never an identity source.** Never render a garment onto a face from a shared image. Classify every inbound image before any model touches it: illegal-content hash matching, adult-content classification, minor detection. Source images are retained only as long as extraction requires.

### 9.6 Phase 2 entry criteria
Do not start this until: launch retention is measured, the self-hosted model clears the fairness gate on all four poses, and a dedicated garment-extraction eval set (300 in-the-wild screenshots) reaches ≥ 60% usable. Below 50%, ship URL-only and say so.

---

## 10. Feed and render economics

### 10.1 The constraint, restated for four poses
A Pose Set is four images. At $0.045 an image, a single try-on costs **$0.18** — four times what every prior version of this document budgeted for. That one change is what forces §13's conclusions to move, and it deserves to be argued on its merits rather than inherited from the mocks: four poses is what turns a picture into a fitting room, and "Walking" is the pose that answers the question a product shot structurally cannot. It is probably worth it. It is definitely not free.

### 10.2 Render budget policy

| Tier | Who | Policy | Model tier |
|---|---|---|---|
| 0 — Guest | Pre-account | **One Pose Set (4 images), full quality, same QA bar.** Actions gated, pixels visible. A second attempt while signed out prompts sign-up. On signup the same asset attaches; never regenerated. Purged with the Guest Session if no account is created. | Same as Tier A |
| Buffer — Discover | Every signed-in user with a photo | **Five pre-rendered cards, one pose (Front) each. Refills only after the previous five have been viewed.** No consumption, no spend. New pieces from followed labels enter at the top. | Self-hosted |
| A — New (days 0–7) | Post-signup | Up to 5 Pose Sets/day (20 images). This is acquisition cost; spend it. | Best available |
| B — Active | Core | On-demand Pose Sets, no daily cap below 8 sets/day; buffer as above. Tapping a buffer card renders the remaining 3 poses only. | See §13.3 routing decision |
| C — Dormant (8–30 days) | Lapsing | Buffer frozen at its current five. One new pose attached to a win-back email. | Self-hosted |
| D — Churned (30+ days) | Lost | One image per win-back, max 2/month. | Self-hosted |

**Rules:** cache every image by (identity version, item id, pose) and reuse across Discover, Lists, email, Compare and vote pages — a published drop rendered once serves every surface. Never render a piece whose readiness score is below the try-on threshold; block at C6 instead (this saves more than any tier policy). Target blended cost **≤ $0.25 per WAU per month by month 9** — achievable only under §13.3 option (b) or (c).

### 10.3 Quality gate
Every image passes automated QA before any user sees it:
- **Identity similarity:** face-embedding cosine against the base selfie ≥ threshold, checked per pose.
- **Cross-pose consistency:** the same person, the same garment, the same colour across all four. **New requirement introduced by the mocks, and the one most likely to fail** — four independently generated images of "you" can drift in face, body or fabric colour, and a set that drifts is worse than a single image.
- **Garment fidelity:** VLM judge against the product image on colour, pattern, neckline, sleeve, length; pass/fail with reason codes.
- **Proportion preservation:** silhouette and keypoint delta versus the Base Look, within tolerance, in every pose. Non-negotiable; this is the anti-slimming guard.
- **Artifact detection:** hands, text, extra limbs, background drift.

**Policy:** a Pose Set ships only if all four poses pass. Borderline → re-render that pose on an alternate model. If a pose fails twice, **ship the set with three poses and label it** rather than dropping the whole try-on — a change from v0.4's silent-drop rule, forced by the set being the unit. Weekly human panel of 200 sets stratified by skin tone × body size × category. Targets: auto-QA pass ≥ 80% per image, ≥ 70% per complete set; "doesn't look like me" reports < 2%.

### 10.4 Latency
Discover shows the five buffer cards within 2 s (cached). A Pose Set returns p50 < 15 s, p90 < 30 s, with pose-by-pose progressive reveal in the queue — the mocks' filling tiles are the spec, and they are what makes 15 s feel like 5.

---

## 11. Growth

### 11.1 The viral loop
The Ask is the loop: each ask reaches 3–5 people, recipients vote on the web without installing, and the vote page carries the proof slider plus one prominent CTA — **"Now put the slip dress on you"** — which opens capture with that exact item queued.

Honest math: 0.3 asks per WAU per week × 4 recipients × 50% vote × 15% tap "see it on you" × 50% complete capture ≈ **0.045 installs per WAU per week, ~0.18 per month**. A real tailwind, not a growth engine. Levers toward k ≥ 0.4: make "Ask friends" the default next action after a second list-add; the proof slider above the fold on the vote page (the mocks do this); format the WhatsApp/iMessage preview so the renders are the preview image; raise asks per WAU with occasion lists.

**What changed from v0.4:** the vote page is now a much stronger conversion surface than it was, because the proof slider demonstrates the capability before asking for a photo. Measure proof-slider interaction on the vote page as a leading indicator of k.

### 11.2 What is true about this product on social
1. **Renders are personal, so users share privately.** Organic UGC volume will be low. Plan for creator-led public content and private ask loops.
2. **The demo is four poses, and that is a better demo than one image.** "One photo of me, and here's the coat on me walking" is a more complete story in 15 seconds than a static render, and it is harder for a competitor to fake in a screenshot.
3. **The proof slider is the second-best creative unit** — a draggable model-vs-real-person comparison is native to every social format and requires no user to appear on camera.
4. **Reactive drop content beats evergreen.** Ingest → render on five consented house models → post within 6 hours.
5. **Trust content outperforms hype.** "On the model vs on me," including honest misses. Fashion audiences are hostile to "AI" framing — lead with "see it on you," label outputs as AI, never lead with the technology.
6. **Pinterest is the sleeper channel.** Fashion intent lives there; house-model renders compound slowly and cheaply.

*Removed from v0.4:* the share-sheet gesture was the #1 creative hook. With that surface in Phase 2, the hook is the four-pose reveal instead — weaker as a demo (it needs a photo of the viewer to be impressive) and this is a real cost of the demotion.

### 11.3 Channel plan
1. **Creator seeding** — 40 micro-creators/month (10k–150k, fashion, GRWM, hauls), gifted access, referral code, revenue share on attributed orders. Brief: the four-pose reveal and a drop reaction. Primary channel for the first six months.
2. **Product-led** — asks and the vote page.
3. **Owned reactive content** — TikTok, Reels, Shorts, Pinterest.
4. **Apple Search Ads** on intent terms — small budget, high intent.
5. **Meta/TikTok paid with UGC creative** — only after W4 retention ≥ 15% and a measured k.
6. **SEO** — brand new-arrivals pages first; expect nothing before month 6.
7. **Communities** — manual, honest, low volume; never astroturf.

### 11.4 Ad copy

**Headlines — apparel**
- One photo. Every piece, on you, from four angles.
- Stop guessing how it looks on you.
- See it walking, not standing on a white background.
- The labels you follow, already on you.
- Before you buy it, wear it.
- Can't decide? Let them vote — with it already on you.

**Headlines — jewellery**
- See the earrings at your own jaw, not a model's.
- Scale is the thing a product shot can't show you.

**Headlines — designers**
- Your next collection on 10,000 real bodies — before you make it.
- Publish it, and it renders on every follower who has a photo.

**Primary text examples**
- "Upload one photo. Follow the labels you like. When they add something new, it's already on you — front, three-quarter, walking, close up. Save it, buy it, or send it to the group chat and let them vote."
- "Brands photograph clothes on one body. You have a different one. See what it actually looks like on you — moving — before you pay for shipping twice."
- "They vote in one tap. No app, no account."

**CTAs:** See it on you · Try it on · Put this on me · Ask friends to pick · Vote · Just browse first.
**Avoid in headlines:** "AI," "virtual," "avatar," "digital twin." **Also avoid, as of v0.5:** any claim about fit, hem length, size or alteration (Principle 3).

### 11.5 Creative concepts
1. **The four-pose reveal** — raw screen recording: tap "Try it on," keep browsing, the chip fills, the toast lands, four poses. 15 s. The hero ad.
2. **Drag the divider** — the proof slider as the whole creative: the label's photo, then a real person's. No voiceover needed.
3. **Model vs me** — split screen including at least one honest miss. Trust content.
4. **The group chat decides** — screen recording of an ask in a WhatsApp group with real reactions; ends on the purchase.
5. **Side by side** — desktop Compare: three coats, same photo, same light, synchronised pose. The strongest argument for the product in one frame.
6. **500 bodies, one dress** — indie designer story with the waitlist counter ticking. Supply recruiting and consumer content at once.
7. **"We couldn't render this one honestly"** — the failure screen as an ad. Counterintuitive, and the most on-brand thing we could run.

### 11.6 SEO and ASO
**ASO:** keywords "try on clothes," "virtual try on," "outfit try on," "see clothes on me," "dress try on," "earrings try on." First screenshot = the four-pose result; second = the proof slider; third = the ask. Title and subtitle carry "try on," not "AI."
**SEO engine 1 — label new-arrivals tracker:** "[Label] new arrivals this week — see them on you," refreshed from the catalogue diff, with house-model renders and live price/stock.
**SEO engine 2 — editorial utility:** "[Item] on 5 body types," "necklace length guide with photos" — backed by real renders on consented models. *Note: these must describe what a piece looks like, not prescribe fit (Principle 3).*
Honest expectation: 6–12 months. Fund lightly from month 1; do not count on it for launch.

---

## 12. Email program — the return trigger

Push is P2. Email carries the loop at launch, exactly as the mocks specify (*"Email only. We don't send push"*).

**Principles**
- Never send an email without a render of the recipient in it, once they have one. The image is the hook.
- Measure clicks, not opens.
- Hard cap 3 emails/week.
- Send-time optimisation per user after two weeks; default Friday 7 a.m. local.

**The three preferences the user actually sets** (verbatim from the mock's onboarding step 1, and the spec):
1. **New pieces from labels you follow** — "a couple of times a week"
2. **When a friend votes on your list** — "as they come in"
3. **Price changes on your lists** — "only when something moves"

**Lifecycle**

| When | Trigger | Subject line (example) | Content | CTA |
|---|---|---|---|---|
| T+0 | First Pose Set complete | Your four poses are ready | The set, plus "pick three labels" if onboarding was skipped | See my try-ons |
| T+1 | No second session | Three more we think you'll want | Three label photos + "try any of them on" | Try one on |
| T+3 | ≥ 2 list items, no ask | Can't decide? Let them vote. | The list, one-tap ask creation | Ask friends |
| **Triggered** | **New pieces from a followed label** (cap 1/day) | ANSEL WARD added 6 pieces | The pieces, rendered on the recipient where the buffer already holds them, label photos otherwise | See what's new |
| **Weekly (Fri)** | **New catalogue arrivals** | New this week on Trailroom | Everything new across the catalogue this week, ranked by fit to the user's taste model; renders where they exist | Have a look |
| Triggered | Price change on a list item | The coat you listed is 30% off | Render + old/new price | Buy |
| Triggered | A friend voted / ask closed | Priya picked the slip dress | Results, buy links | See results |
| Triggered | A blocked piece can now render | The leather jacket is ready to try on | The C6 waitlist payoff | Try it on |
| Triggered | Slot missing, item requested (max 2) | Rings on your hand — one 10-second photo | Three rings on a house model | Unlock rings |
| D14 inactive | Win-back | Three new pieces since you've been gone | Three renders from followed labels | See my try-ons |
| D30 inactive | Last win-back | Want us to keep your photos? | One render; keep / delete (also a BIPA retention signal) | Keep / Delete |

**Deleted in v0.5:** the personalised "This week, on you" weekly digest. It is replaced by the weekly new-arrivals email above. The distinction matters: the digest was a *rendered* send whose cost scaled with the mailing list; the new-arrivals email is a catalogue send that carries renders only where the buffer already produced them. That is what makes a weekly anchor affordable without push.

**Metrics:** click rate by send type · email → app open · email → purchase (attributed) · unsubscribe < 0.3% per send · **holdout test:** 10% receive no weekly send; measure W4 and W8 retention lift. If the weekly lifts W4 by < 3 points, the supply or the ranking is the problem, not the email.

---

## 13. Monetisation and unit economics

### 13.1 Revenue lines

| Line | When | Mechanics | Scale |
|---|---|---|---|
| Affiliate commissions | Day 1 | Tracked links via Rakuten/CJ/Impact/Awin/ShareASale + Skimlinks; blended ~3–12% by category | Needs millions of WAU |
| **Direct designer commission** | **Day 1 — new in v0.5** | The mocks state *"no listing fee, 8% on a sale we send you"* for self-serve labels. Higher than most affiliate rates and payable directly. **Decision required:** this is either (a) a direct-deal affiliate rate on labels we onboard ourselves, checkout still on their site — which is what the mock's buy flow shows and what we should say; or (b) a marketplace take rate, which implies in-app checkout and is Phase 3. Pick (a) and write it into the designer terms. | Grows with the indie cohort |
| Sponsored drops | Phase 3 | Labels pay CPM/CPA to place rendered pieces into lookalike buffers; quality-gated, labelled | The real business |
| Designer tools | Phase 3 | Analytics and pre-order tooling subscription | Depends on supply growth |
| Consumer premium | Phase 2+ | Quota on on-demand Pose Sets above a free daily allowance, plus Compare beyond 4 and early access to drops. **Weaker than in v0.4**, because the share sheet — the feature that made a quota *felt* — is now Phase 2. Do not count on this before the share sheet ships. | Test at 3–5%, $4.99–7.99/mo |

### 13.2 Unit economics per WAU per month

Assumptions: 12 buffer images consumed · 6 Pose Sets initiated (2 from buffer cards at 3 further poses, 4 from label cards at 4 poses = 22 images) · 2 outfit images · **36 images total** · Pose-Set click-out 20%, feed click-out 3% · click → order 4% / 3% · AOV $85 · blended commission 7%.

**Revenue:** Pose Sets 1.2 clicks → 0.048 orders → $0.29. Feed 0.9 clicks → 0.027 orders → $0.16. **Total ≈ $0.45 / WAU / month** — down from v0.4's $0.80, because $0.48 of that came from share renders that are now Phase 2 (§9).

| Cost scenario | Cost/image | Cost / WAU / mo | Contribution |
|---|---|---|---|
| All-API | $0.045 | $1.62 | **−$1.17** |
| All-API, batched | $0.034 | $1.22 | −$0.77 |
| Split routing (buffer self-hosted, on-demand API) — *the v0.4 plan* | mixed | $1.15 | **−$0.70** |
| **Hero pose on API, poses 2–4 self-hosted** | mixed | $0.45 | **≈ $0.00** |
| **All self-hosted** | $0.006 | $0.22 | **+$0.23** |

### 13.3 The conclusion has reversed, and this is the most important paragraph in the document

v0.2–v0.4 all concluded that **split routing was the whole game**: cheap self-hosted renders for the passive feed, expensive API renders where intent is explicit. That conclusion depended on explicit-intent renders being *few* — one image per share. At four images per try-on, on-demand is no longer the small line; it is 60% of all images generated. Split routing now loses $0.70 per WAU per month. **The routing rule that carried three revisions of this document does not survive the four-pose decision.**

Three exits. Pick one deliberately in Phase 0 rather than drifting into the first:

**(a) Two poses, not four.** Front and Walking. Halves the image count to ~20, restores split routing to roughly break-even, and keeps the "it moves" story that justified poses in the first place. Cheapest to reach, and the mocks lose the least: Three-quarter and Close detail are the two poses a user is least likely to cite as the reason they bought.

**(b) Self-host everything, including on-demand.** The only scenario that clears the ≤ $0.25 target and the only one with positive contribution at launch. Entirely contingent on the open VTON clearing the fairness gate *and* the new cross-pose consistency gate (§10.3) — which is now the single most important question in Phase 0.

**(c) Keep four API poses and accept negative contribution.** Defensible only as an explicit, time-boxed acquisition bet with a hard monthly ceiling and a date by which (a) or (b) must be true. Not a default.

Recommendation: build for (b), ship with (a) as the fallback if the Phase 0 eval says the self-hosted model cannot hold identity across four poses. Never arrive at (c) by accident.

### 13.4 Other conclusions
1. Affiliate contribution is thin per user under every scenario. At 1M WAU and the best case, this is ~$2–3M/yr — a company, not an outcome.
2. The outcome case is sponsored drops. If a personalised rendered impression earns $1–3 per US WAU per month, revenue per user rises 5–10×. That needs scale, a measurement story, and labels trusting the render quality.
3. **There is no direct-consumer-payment line before Phase 2, and the premium tier is weaker than v0.4 assumed.** This product is unprofitable by design until sponsored drops work. Keep the burn small and race to them on the strength of retention.
4. Paid acquisition: payback exceeds 12 months on affiliate alone. Do not scale paid until retention and the sponsored-drop roadmap are real.

---

## 14. Metrics framework

**North Star:** **Weekly Engaged Try-On Users (WETU)** — users who viewed ≥ 1 complete Pose Set of themselves *and* took ≥ 1 action (list-add, ask, buy click-out) in the week.
**Money metric:** attributed GMV and revenue.
**Quality metric:** the honesty score — auto-QA pass rate per image and per set, cross-pose consistency pass rate, "doesn't look like me" report rate, weekly human panel, and the post-purchase **render-match rate** (C10).

**Input metric tree**
- **Acquisition:** installs and desktop signups by channel · creator-attributed · vote-page → capture (k) · proof-slider interaction rate on signed-out surfaces.
- **Activation:** open → photo started → capture completed → four poses visible (p50/p90) · **guest Pose Set → sign-up conversion** · screenshot-without-signup rate · Guest Session → account attach · onboarding step-1 and step-2 completion.
- **Engagement:** Pose Sets per WAU · **buffer view-through rate** · pre-rendered card → full Pose Set rate · queue abandonment · list-adds per WAU · asks per WAU · Compare usage (desktop) · outfit renders per WAU · follows per user.
- **Retention:** D1/D7/D30 · W1→W4 · weekly-email holdout lift · email click rate.
- **Monetisation:** click-out rate · CVR · GMV · revenue/WAU · **images per WAU** · render cost/WAU · contribution/WAU.
- **Supply:** labels ingested · designers verified · % pieces render-ready · honest-failure rate · waitlist fulfilment rate · % WAU receiving ≥ 1 followed-label drop per week · publish → buffer-entry rate.

**Guardrails:** QA pass rate per image and per set · cross-pose consistency failures · proportion-drift violations (must be zero shown) · render latency · safety blocks · deletion SLA · complaints per 1k users · email unsubscribe.

**Initial targets (hypotheses to calibrate in the first 5k users)**

| Metric | Target | Note |
|---|---|---|
| Open → four poses visible, p50 | < 60 s | |
| Guest Pose Set → sign-up conversion | ≥ 40% | Now worth $0.18 of render per guest, not $0.045 |
| Screenshot-without-signup rate | Measure in Phase 0 | No target yet |
| Capture first-attempt success | > 85% | |
| Auto-QA pass, per image | > 80% | |
| **Auto-QA pass, per complete Pose Set** | **> 70%** | New; the binding constraint |
| **Cross-pose identity consistency** | **> 90%** | New; the highest technical risk in v0.5 |
| "Doesn't look like me" reports | < 2% of sets viewed | |
| **Render-match rate (post-purchase)** | **≥ 90%** | New; from the mocks |
| D1 / D7 / D30 retention | 45% / 25% / 12% | |
| W4 retention | ≥ 15% | Gate for paid spend |
| Follows by D7 | ≥ 5 | Onboarding now guarantees 3 |
| **Buffer view-through rate** | **≥ 60% of the five** | Gates all pre-render spend |
| Asks per WAU per week | ≥ 0.3, pushing to 0.7 | |
| Click-out rate on a Pose Set | ≥ 20% | |
| Honest-failure rate | < 8% of try-on attempts | |
| **Images per WAU per month** | **≤ 40** | New; the four-pose control |
| Render cost per WAU per month | ≤ $0.25 by month 9 | Only reachable under §13.3 (b) |

One dashboard per CUJ (C1–C12, D1–D6), each showing its funnel, its quality guardrail and its cost.

---

## 15. Trust, safety, privacy, legal

- **Consent precedes capture, not sign-up.** The consent and age-gate screen runs before the camera or photo picker opens, for every user, guest or signed in. **No mock implements this today (§19-B2) and it is the highest-severity gap in the set** — a passive privacy panel reachable from a "Details" link is not consent.
- **Biometric privacy is the top legal risk.** Illinois BIPA requires written consent, a public retention and destruction schedule, and restricts profiting from biometric data in ways counsel must review against an affiliate model tied to face-matched renders; Texas and Washington have their own statutes; GDPR/UK treat face images processed for identity matching as special-category data. Retailers have been sued under BIPA over virtual try-on. Consider geofencing Illinois and Texas at launch until counsel signs off.
- **Retention:** base photos kept while the account is active; auto-delete after 12 months of inactivity with a warning email; renders and caches purge with photos. **Guest Sessions are a shorter retention class:** photos and the guest Pose Set purge 24–48 h after capture if no account is created.
- **Minors:** 18+ only; age estimation on the live selfie with a conservative threshold; reject uploads containing multiple people or an estimated minor; no appeals flow that re-uploads the image. *The mocks state this correctly in copy and enforce it nowhere, because the live selfie step does not exist yet.*
- **Own-photo verification:** the live selfie is face-matched to any gallery photo before it becomes a base image. This single mechanism is the difference between a try-on product and a deepfake tool. **Every mock's privacy copy already promises it; the flow must actually do it (§19-B3).**
- **Body integrity:** proportion guard in the QA gate, applied per pose; no "slim," "tone," or "enhance" features, ever; skin-tone fidelity checked per image.
- **No fit or size claims.** Principle 3 is also a legal posture: a fit claim that costs a user a return is a liability the render itself is not. This is a second, independent reason the mocks' height-based fit lines come out.
- **Fairness gate:** eval set stratified by skin tone (Monk scale), body size and age. A category does not launch until QA pass rates are within a few points across strata — **and now, until cross-pose consistency is within a few points across strata too.** A model that holds identity on one body type across four poses and drifts on another is a fairness failure, not a quality failure.
- **Content policy:** swimwear allowed; lingerie deferred; no nudity; designer uploads moderated for NSFW, counterfeits and IP; DMCA agent registered.
- **AI labelling and provenance:** visible label on every rendered image in-app and on the vote page, in-pixel label baked into guest renders, C2PA/SynthID-style provenance metadata. *Currently only the mobile vote page carries a label (§19-B7).*
- **Sharing controls:** expiring links (7-day default), revocation, `noindex`, recipients see renders only and never originals, no download of base photos by anyone. *Not built in either mock (§19-B6).*
- **Brand and IP:** affiliate-feed images are licensed for promotion; rendering them onto users is derivative use — get counsel's view and build a brand opt-out before launch. Designers grant rights explicitly in terms.
- **Security:** photos encrypted at rest with per-user keys, renders in a separate store, access logged, model-training data limited to explicit opt-in and paid house models.

---

## 16. Architecture and model strategy

**Services:** client capture (on-device pose/quality, candidate scan) · identity service (slots, multi-photo with defaults, base-look generation, face-match, versioning) · catalogue service (feed ingestion, designer uploads, segmentation, readiness scoring, drop detection) · **render orchestrator** (per-category model router, **Pose Set job management**, priority queues, cache, QA judge) · **buffer service** (per-user five-card pre-render with view-gated refill) · feed ranker · social web (asks, votes, OG images) · email · affiliate and attribution · experimentation · privacy and deletion pipeline.

**Model strategy — eval first, then route**
1. **Build two eval sets before building the app.** (a) **Pose Set rendering:** ~500 consented base photos stratified by skin tone × body size × age × lighting × capture source, × ~200 catalogue items. Score identity preservation, garment fidelity, proportion preservation, artifact rate, human "looks like me" — **and cross-pose consistency, which is a new axis and the one most likely to fail.** (b) **Readiness scoring:** does the score predict which pieces actually render well? A readiness gate that lets bad pieces through makes the honest-failure screen a liar.
2. **Route by cost, not by intent — this has changed.** v0.4 routed by intent because intent-driven renders were rare. They are now the majority of images (§13.3). Until Phase 0 answers whether the self-hosted model holds identity across four poses, assume all four poses come from the same model and route the whole set together. Jewellery remains composite-and-relight; the hand slot is its own model.
3. **Cache and reuse** by (identity version, item id, pose). Regenerate only when the base look changes. A published drop rendered once serves Discover, email, Lists, Compare and the vote page.
4. **Improve on consented data only:** explicit opt-in plus paid house models. No silent training on user photos. QA pass rate per model version is the release gate.

---

## 17. Risks, open questions, kill criteria

| Risk | Early signal | Mitigation / kill rule |
|---|---|---|
| **Cross-pose identity drift** | Consistency pass < 80% after 6 weeks of model work | **Drop to two poses (§13.3a).** This is the top new risk in v0.5. |
| **Four poses make the economics unreachable** | Render cost/WAU > $0.60 after self-hosting | Two poses; or hero-pose routing; both are pre-planned, neither is a scramble |
| Render quality on real photos | Eval pass < 75% after 6 weeks | Don't launch that category. Jewellery-only launch is viable; it is the easier render. |
| The feed is not a habit | W4 < 10% at 5k users | Cut the buffer to three, lean entirely on the queue and asks — the product survives as a tool |
| **Buffer spend without consumption** | Buffer view-through < 40% | The view-gated refill already caps this; if it still bleeds, cut to three cards |
| Doji ships equivalent features | Public launch | Differentiate on designers (supply), Compare, and honest failure; speed over polish |
| Supply gaps | < 60% of WAU get a followed-label drop weekly | Ingest more feeds; Skimlinks long tail; paid ingestion |
| Brand backlash over unauthorised renders | Takedown requests | Quality gate, opt-out, early partnerships |
| BIPA / biometric action | Counsel flags | Geofence until resolved; **and close the §19-B2 consent gap before any user sees a camera** |
| **Three surfaces at launch stretches the team thin** | Slipping dates on all three | Desktop shopper app is the one to cut to a read-only vote/browse surface if it comes to it — never the designer back office, which is supply |
| Designer house style breaks comparability | Compare feels wrong; users say pieces "look different" | Resolve §8 D5 before build, not after |
| Founder conflict with current employer | — | Resolve the side-project and IP question before writing code |

**Open questions for Phase 0:** Can the self-hosted model hold one identity across four poses across all fairness strata? What is the buffer view-through rate, and does the view-gated refill actually cap spend? Does the four-pose reveal convert better than a single render — enough to justify 4× the cost? Does the proof slider raise signed-out → capture over a plain value prop? What fraction of beachhead users have a usable full-body photo in their camera roll? Does desktop Compare change purchase rate enough to justify a third surface? What is the real blended commission for the top-50 labels the beachhead follows?

---

## 18. Phased roadmap

**Phase 0 — Prove the Pose Set (weeks 0–6).** Two eval sets (§16). Supply ingestion of 200 brands; 30 hand-recruited indie designers; legal (biometric consent, IP); brand and design.
**Exit gate:** ≥ 75% QA pass per image on apparel and jewellery across all fairness strata · **≥ 70% pass on complete four-pose sets** · **≥ 90% cross-pose identity consistency, evenly across strata** · a costed decision on §13.3 (a)/(b)/(c), written down.

**Phase 1 — MVP (weeks 6–20).** iOS + desktop web + designer back office. C1 (both entry paths, consent gate, live selfie, guest Pose Set with actions gated), C2 (five-card buffer), C3 (queue), C4 (Lists, Asks, vote page), C5, C6 (honest failure), C7 (Compare, desktop), C8, C9, C10, C11, C12. D1–D4 for the hand-recruited cohort. Email program (§12). TestFlight 500 → 5,000.
**Exit gate:** open → four poses p50 < 60 s · guest → sign-up conversion measured against the §14 hypothesis · W4 ≥ 15% · "doesn't look like me" < 2% · render-match ≥ 90% · buffer view-through ≥ 60% · images/WAU ≤ 40 · follows by D7 ≥ 5.

**Phase 2 — Reach and habit (weeks 20–34).** Android; **share sheet and screenshot try-on (§9)**; push notifications; "not for me" and ranker maturity; back-in-stock alerts; premium quota test; designer house style (per §8 D5's resolution); mobile Compare.
**Exit gate:** ≥ 60% of WAU receive a followed-label drop weekly · render cost/WAU trending to ≤ $0.25 · share extraction ≥ 60% on screenshots before that surface leaves beta.

**Phase 3 — Business (weeks 34+).** Sponsored drops with measurement; makeup; shoes, bags, sunglasses; watches; wardrobe ingestion; size-prediction *partner* (never our own claim); browser extensions; TikTok/Reels frame extraction; international (GDPR-ready).

---

## 19. Mock ↔ PRD discrepancy register

The audit that produced v0.5. Three mocks were reviewed in full: **M** = `Trailroom Prototype.dc.html` (mobile, 11 journeys C1–C10 + D1), **D** = `Trailroom Desktop.dc.html` (9 journeys), **DD** = `Trailroom Desktop Designer.dc.html` (4 sections).

Status codes: **✅ PRD updated** (mock wins, this document changed) · **📐 Mock change required** (PRD wins, design work needed) · **❓ Open decision** (needs a call before build) · **⚠️ Mock-vs-mock** (the three prototypes disagree with each other).

### A. Mock wins — this document has been updated ✅

| # | Area | What v0.4 said | What the mocks show | Now in |
|---|---|---|---|---|
| A1 | Product name | "OnMe (working title)" | Trailroom · `trailroom.ai` · `studio.trailroom.ai` | Throughout |
| A2 | **The render unit** | One image per try-on | **Four poses**: Front, Three-quarter, Walking, Close detail | §6 Pose Set, §10, §13 |
| A3 | Try-on queue | Async implied for share renders only | First-class in all three: confirmation sheet, progress chip, "keep browsing," completion toast | §7 C3 |
| A4 | Saved items | "Closet" — one bucket | **Named Lists**, many per user, the unit an Ask is built from | §6, §7 C4/C11 |
| A5 | Asks | Outbound only, to non-users | Plus an **Asks inbox** with unread badges from other users | §6, §7 C4, ❓D3 |
| A6 | Compare | Absent | Tray of 4, side-by-side, **pose-synchronised**, keyboard `C` (D only) | §7 C7 |
| A7 | Outfits | Phase 3 "complete the look" | **"Wear it with"** — preview sheet, combined price, one outfit render, pieces persist individually | §7 C8 |
| A8 | Failure handling | Silent drop and backfill | **Honest-failure screen** + "closest three we can put on you" + "email me if we get better photos" | §4.9, §7 C6 |
| A9 | Signed-out conversion | The guest's own render | **Proof slider** (model vs. real person, draggable) on Discover, product and vote pages | §7 C1 |
| A10 | Identity Set | One photo per slot | Many photos per slot with a user-chosen **default** | §6 |
| A11 | Post-purchase | "Did you get it?" as P1 | **"Did it arrive?"** as P0, feeding a designer-visible **render-match rate** ("94% said the render matched") | §7 C10, §14 |
| A12 | Designer self-serve | Phase 2 / P1 | A complete back office: verification, readiness, signal, publish, house style | §8, §18 Phase 1 |
| A13 | Readiness score | Concept | Scored 0–100 with reason codes and a per-piece fix flow; waitlist counts per blocked piece | §8 D2 |
| A14 | Forced follows | Removed in v0.3 | **"Pick three labels,"** button disabled until 3 — after signup, not before | §7 C1 step 10 |
| A15 | Post-signup onboarding | None | Two steps: email preferences, then three follows | §7 C1, §12 |
| A16 | Platform | iOS first; "web for polls" | Full desktop shopper app + designer back office | §5 |
| A17 | Return trigger | Rich push, >60% opt-in target | **"Email only. We don't send push."** | §12, push → P2 |
| A18 | Rings / cuffs | Phase 2 | Shipped, with a `hand` slot in the Studio | §5 (Phase 1, behind progressive capture) |

### B. PRD wins — the mocks need changing 📐

These are ordered by severity. B1–B3 are launch blockers.

| # | Area | What the mocks do | What must happen | Files |
|---|---|---|---|---|
| **B1** | **Fit in words** | Height picker (5'2"–6'0") drives a fit sentence on every piece: *"Hits mid-calf on you," "Needs the hem taken up on you," "Sits at the collarbone on you."* Surfaced on feed cards, product pages, Compare columns and pair previews. | **Remove entirely.** Principle 3 and §15: we show how it looks, we never claim how it fits. "Needs the hem taken up" is a tailoring recommendation derived from one number. Replace the fit line with the piece's own description ("Double-faced wool, drops to mid-calf") — a fact about the garment, not a claim about the body. Also removes the "Your measurements" sheet and the `fit` map from the catalogue. | M, D |
| **B2** | **Consent and age gate** | A passive privacy panel behind a "Details" link, shown *alongside* the photo picker. Never blocks. | **Add a blocking consent + age-verification screen before the camera or picker opens**, first time only, for guests and signed-in users alike. This is a legal obligation that does not depend on having an account. Highest-severity gap in the set. | M, D |
| **B3** | **Live selfie** | Every mock's privacy copy promises *"matched to a live selfie so you can only try things on yourself."* **No mock captures a live selfie.** A user picks a body photo from the camera roll and renders. | **Add the live-selfie step first, for everyone**, and run the face-match before a gallery photo becomes a base image. Right now the copy describes a safeguard the product does not perform. | M, D |
| B4 | **Guest gate behaviour** | Three different models. **M:** the full-size result is blocked — *"Create an account to open them"*; only four small tiles are visible; the sheet has no dismiss-to-view path. **M, path C1:** gates even earlier, right after upload and before any render. **D:** accepting a photo silently sets `signedIn: true` — no account prompt at all, and the buy/list/compare gates then never fire. | **One behaviour (§7 C1 step 8):** poses render at full quality and are **visible**; the sheet is **dismissible**; download, save, buy, ask and follow are locked. Desktop must stop auto-creating accounts. | M, D |
| B5 | Share sheet / screenshot | Absent | Correct for v1 — no change needed. Recorded here so the absence is a decision (§9, Phase 2) and not an oversight. | — |
| B6 | Ask link lifecycle | No expiry, no revocation | Add 7-day default expiry, revocation, and `noindex` on `/ask/…` | M, D |
| B7 | AI labelling | Only M's vote page shows "AI PREVIEW." Nothing labels in-app renders; D's vote page has no label at all. | Visible label on every rendered image in-app and on both vote pages; in-pixel label baked into guest renders | M, D |
| B8 | "Not for me" | Absent | Add per-card negative feedback — the ranker needs it and §14 tracks it | M, D |
| B9 | Progressive-capture unlock card | The hand slot is only reachable from the Studio; no prompt anywhere | Add the end-of-feed unlock card ("See rings on your hand — 10 seconds"), capped at one per session | M, D |
| B10 | Deletion, export, consent log | Studio shows photos and defaults but no delete, no export, no consent record | Add all three; §15 commits to a 24 h deletion SLA | M, D |
| B11 | Guest cap and purge | Not represented | Show the one-free-Pose-Set cap on the second signed-out attempt; state the 24–48 h purge in the consent screen | M, D |
| B12 | Publish reach copy | DD: *"Anything you publish renders on every follower who has a photo, within the hour"* | With the buffer model this is not true. Say "enters the top of each follower's feed and renders as they return" | DD |
| B13 | Placeholder brands | Five independent labels, $86–$520, all "Independent · [city]" | No mock change needed, but note in the design file that these stand in for a mixed catalogue including mass-market affiliate brands — otherwise the next reviewer reads a repositioning that was never decided | M, D, DD |

### C. Open decisions ❓

| # | Decision | The conflict | Recommendation |
|---|---|---|---|
| **C1** | **Four-pose cost exit** | Four poses reverse the split-routing conclusion that carried three PRD revisions; contribution is −$0.70/WAU/mo under the v0.4 plan | Build for **all-self-hosted**; fall back to **two poses** (Front + Walking) if Phase 0 says the open model can't hold identity across four. Never drift into "accept the burn." (§13.3) |
| **C2** | **House Style vs Base Look vs Compare** | DD lets each label impose its own lighting and crop on every render of its pieces. D's Compare promises *"same photo, same light, same crop."* Both cannot be true. | House style applies to the label's own drop page and publish email only; Discover and Compare always use Base Look (§8 D5, option 2) |
| **C3** | **The Asks inbox implies a social graph** | M and D show asks arriving *from named users* ("Priya is asking") with no way to add, find, or accept a friend anywhere in any mock | Either (a) the inbox is populated only by asks sent to your email/number and matched on signup — no graph, no friend list; or (b) we are building a social graph and it needs its own CUJ. (a) is far cheaper and matches Principle 5. |
| **C4** | **Designer commercial terms** | DD states *"no listing fee, 8% on a sale we send you."* v0.4 had no direct take rate at launch. The mock's own buy flow checks out on the label's site. | Call it a **direct-deal affiliate rate**, not a marketplace commission, and write it into the designer terms. Marketplace take stays Phase 3 with in-app checkout. (§13.1) |
| C5 | Mobile vs desktop IA | D has a "Your try-ons" nav item; M buries the same content inside "You." | Pick one. Recommend adding "Try-ons" to mobile — it is the archive the product's value accrues in, and burying it undersells it. |
| C6 | Weekly email interpretation | "Delete weekly drop, send a weekly email on new catalogue updates" | Written up in §12 as: the personalised rendered digest is deleted; a weekly *new-arrivals* email replaces it, carrying renders only where the buffer already produced them. Confirm this is the intent. |

### D. Mock-vs-mock inconsistencies ⚠️

Not PRD problems, but they will confuse anyone reading the set cold.

| # | What disagrees |
|---|---|
| D1 | **Designer numbers.** M's designer tab: 38 pieces, 31 ready, 2,914 try-ons, 6.4% click-through. DD: 22 products imported, 6 pieces in the table, 3,248 try-ons, 6.8% click-through, "22 pieces live." |
| D2 | **Catalogue size.** M has 9 items; D has 12 (adds wide cuff, stone drop pendant, wool check scarf). Same five labels, same ids otherwise. |
| D3 | **Post-signup onboarding.** M runs the two-step email + follows flow. D has none — a desktop user never sets an email preference or follows a label. |
| D4 | **Vote page.** M labels renders "AI PREVIEW"; D labels them "ON MAYA." M's vote page starts at 0 votes; D's starts at 14/9. |
| D5 | **Gate taxonomy.** M has five gate reasons (buy, list, ask, picknext, reveal); D has four (buy, list, compare, share). Copy differs for the shared ones. |
| D6 | **Category chips.** M: Apparel / Jewellery / Accessories. D: Everything / Apparel / Jewellery / Accessories. |
| D7 | **Compare** exists only on D. Correct as a platform decision (§7 C7), but M gives the user no path to it and no mention that it exists on desktop. |

---

## Appendix A — Copy library

**Email subject lines:** Your four poses are ready · ANSEL WARD added 6 pieces · New this week on Trailroom · The coat you listed is 30% off · Priya picked the slip dress · The leather jacket is ready to try on · Three new pieces since you've been gone · Want us to keep your photos?

**In-product copy worth keeping verbatim from the mocks:**
- *"Drag to see the difference."* / *"Maya uploaded one photo. Now every piece here comes back on her body, in four poses."*
- *"Four poses come back in about ten seconds — you don't have to wait here."*
- *"Keep browsing while it renders."*
- *"We couldn't render this one honestly… We'd rather say so than show you a guess."*
- *"Same photo, same light, same crop. The only thing that changes is the piece."*
- *"They vote in one tap. No app, no account."*
- *"One tap. Priya sees the count, never who voted for what."*
- *"Nothing rendered yet. Every piece you try lands here in four poses and stays. Nothing expires, nothing is public."*
- *"You check out on ANSEL WARD's own site. We keep this try-on here, and ask once whether it arrived."*
- Designer: *"Their photo, their face, and every render of them. You get counts, never pictures."* / *"You can't buy a lookalike audience from us, and we don't sell one."*
- Designer: *"One front-on photo each and 486 people get an email that day."*

**Retired copy (Principle 3):** every height-derived fit sentence — *"Hits mid-calf on you," "Needs the hem taken up on you," "Breaks once at the ankle on you," "Reads chunky on you,"* and the *"Your measurements"* sheet.

**Push copy:** deferred to P2.

## Appendix B — Capture requirements matrix

| Slot | Used for | Requirements | Source |
|---|---|---|---|
| Face-Front (live) | Identity verification, age estimation, earrings, necklaces, pendants | Front, neutral, even light, hair back | **Live only. Required for every user, first.** |
| FullBody-Front | All apparel, scarves | Front, neutral pose, fitted clothes, full figure visible, single person, plain background preferred | Gallery (face-matched) or guided camera |
| Hand | Rings, cuffs, bracelets | Back of hand, fingers relaxed, even light | Guided camera; progressive unlock |
| Face-3/4 | Makeup (Phase 3) | 3/4 view, same conditions as Face-Front | Live |

Each slot holds multiple photos; one is the user-set default. Changing a default re-renders on next request, not retroactively.

## Appendix C — Supply notes
- Affiliate networks with product feeds: Rakuten, CJ, Impact, Awin, ShareASale; Skimlinks/Sovrn for the long tail. Approximate commission ranges: apparel 3–10%, jewellery 5–12% (verify per brand).
- Brands without affiliate programs should still be ingested for engagement; monetise via "closest three we can put on you" into commissioned catalogue — the same mechanism as the C6 fallback ladder.
- Seed designers: Shopify-based independents with active Instagram followings, occasion-wear boutiques, and jewellery makers — all have try-on-ready imagery and real drop cadences.
- **Readiness is the gating constraint, not brand count.** DD shows 3 of 6 pieces render-ready for a real-looking label. If that ratio holds across ingestion, a 200-brand catalogue is a 100-brand catalogue in practice. Budget ingestion targets against readiness, not SKU count.

---

## 20. Imported from the Claude Design project (Aug 25)

Two documents arrived from `claude.ai/design/p/87b9dd02…` that did not exist when v0.5 was written. Both are now inputs of record, and both conflict with this document in places. Recorded here rather than silently merged.

**Import result, for the record:** the project's `Trailroom Prototype.dc.html` and `Trailroom Desktop.dc.html` are **byte-identical to the pre-session originals** (SHA-256 verified). The design project is a snapshot taken before the B1–B4 work; importing it wholesale would have deleted the consent gate, the live selfie, the guest-gate fix and the fit-copy removal. Local is canonical. The project's `support.js` is the real generated `dc-runtime` and is kept at `design-project/support.canvas.js`; it requires `window.React`, which the canvas supplies and a local file does not, so the hand-written standalone runtime remains the one beside the mocks.

### 20.1 Design.md — now the design system of record

Adopted wholesale into the mocks: the Material Grey neutral ramp, Teal 700 accent (`#00796B` — the mocks had been using Teal 800, the *pressed* token, as the accent), Material semantic colours, the 8px space scale, radius, elevation and motion tokens. Every invented colour value in all four artboards has been mapped; no `var()` resolves to an undeclared token.

**Where Design.md confirms this PRD**, which is worth stating because it was written independently: watermark rather than degrade, gate on quantity and on actions, never on quality (§2.1 — matches C1); capture is item-aware and recurs, *not* a one-time onboarding gate (§2.2 — matches C5); polls need two options and the recipient must vote without installing (§2.3 — matches C4); and the body-image guardrails in §9 — *no language about flattering, slimming, hiding or fixing anything* — independently arrive at Principle 3 and at the removal of fit-in-words.

**Where Design.md contradicts this PRD or the mocks — open, not resolved:**

| # | Design.md says | This PRD / the mocks say | Status |
|---|---|---|---|
| 20a | **No layers, no interrupts** (Rule 2). Modals and dialogs are an anti-pattern; use a place, a push panel, or inline expansion. Two exceptions only: the OS share sheet and the OS photo picker. | The mocks are built on sheets and modals throughout, and C1 step 8 adds an account sheet over the finished render. | **Open.** Mobile consent/selfie are already *places*; desktop's are modals and should convert. The account gate is the harder case — see 20b. |
| 20b | **Signup is triggered by save, poll, buy, or try-on #2** (§2) — never by the render completing. "Popup when generation completes" is a named anti-pattern (§10). | C1 step 8: the account sheet rises the moment the render is ready. | **Open, and it matters.** Design.md's position is less interruptive and still gates actions. Ours interrupts the payoff frame. I lean Design.md. |
| 20c | **Buy is the quietest action on the result** — text link in `--accent`. Primary is "Add another"; "Ask friends" is secondary. `Buy` as a card's primary action is a named anti-pattern. | Both mocks make `Buy $328` the full-width filled primary on the result and on tried feed cards. | **Open** — but note the Conversion Audit independently reaches the same verdict, so this is 2–0 against the mocks. Only the replacement differs (see 20e). |
| 20d | **Everything is a 3:4 frame; never mix ratios in one scroll container** (§5). | The mobile result gallery is 4:5. | **Open** — and the Conversion Audit explicitly says *keep* full-bleed 4:5. The two imported documents contradict each other. |
| 20e | — | — | The **rack dock** (§5) — a persistent bottom dock where async generations land, never covering content — is Design.md's answer to what this PRD calls the try-on queue (C3). Same idea, different surface: the mocks use a top-bar chip plus a toast. |

### 20.2 Conversion Audit — 44 items, unscheduled

An audit of the *pre-B1–B4* prototype against two events: account created, and came back next week. Its two structural claims are worth taking seriously and are not addressed anywhere in this document:

1. **"We ask for the photo before we have shown the customer anything they want."** Partly answered by the proof slider (§7 C1), which the audit itself proposes as its first P0 — it exists in the mocks already.
2. **"There is no mechanism anywhere in the app that brings a person back on a particular day."** This is the sharpest criticism in the set, and it lands. §12 replaced the weekly rendered digest with a new-arrivals email, but nothing in the product *names a day*. The audit's fix — a named drop day ("Thursdays at nine") plus a countdown at the end of the feed — is cheap and has no equivalent here.

**Its highest-leverage recommendation directly contradicts a decision already taken:** the audit calls the missing push-notification permission ask "the highest-leverage missing pixel in the prototype," while §12 of this document puts push at P2 on the strength of the mocks' own *"Email only. We don't send push."* One of those is wrong. The audit is arguing from the weekly-return funnel; §12 was arguing from the mocks. Worth re-opening.

Three further audit items that are cheap and uncontested by anything here: **render four pieces on the first photo rather than one** (same photo, same wait, and the first thing worth an account); **a "follow three labels" step after the first result** (already built — C1 step 10); and **"did it arrive?" actually wired up** (specified in C10, promised by the buy sheet in the mocks, and still never asked).
