# OnMe (working title) — Virtual Try-On Product Requirements

**Owner:** Tejas · **Status:** Draft v0.4 · **Date:** Aug 22, 2026
**v0.4 changes:** Reversed the v0.3 guest-preview quality call. The signed-out render is now generated at the **same full quality** as the authenticated render — no artificial resolution downgrade — because a deliberately bad-looking render undermines trust in the core capability (Principle 1) more than it protects render spend. The gate moves entirely from the pixels to the account: the moment the render is ready, a sign-in popup ("Sign in with Google") overlays it, and every action — download, save, buy, ask friends — is locked until the user authenticates. Signing in unlocks the *same* rendered asset rather than triggering a second, better render, which removes the old two-render step for anyone who converts. The honest trade-off (§10, §7 C1): this raises the cost of every guest preview, converting or not, from self-hosted-cheap to whatever tier the real render uses — so the one-free-preview-per-Guest-Session cap, previously a nice-to-have, is now the primary cost control, and the low-conversion downside case is worse than it was in v0.3. See §7 C1, §10.2 (Tier 0 renamed), §14.
**v0.3 changes:** Onboarding sequencing redesigned (§7 C1 rewritten): browse catalog → pick an item → capture (first time only) → a deliberately degraded low-quality render if signed out → sign-up → full-quality render with download, poll, and buy. Account creation now happens after the first preview render instead of before capture; biometric consent and age-gating still happen before the camera opens regardless of sign-in status (§15) — only the account prompt moved, not the compliance obligation. Data model gains a Guest Session concept (§6); render budget gains a Tier 0 anonymous-preview line (§10.2); the mandatory brand-follow step that used to precede capture is gone, which puts the D7-follows target and C2's supply signal at risk (§14, C6) unless the post-render follow prompt is treated as load-bearing rather than P1 polish. **Explicitly unaffected:** poll voting (C4) still requires no login and no account for the recipient — that was already true in v0.2 and remains a hard requirement, now stated more strongly and disambiguated from the new Guest Session concept, which applies only to the try-on-er's own capture, not to a voter (§4, §6, C4).
**v0.2 changes:** (1) Cosmetic dental spun out into its own product and its own PRD — removed from this document. (2) OS share sheet and browser extensions promoted from a bullet inside C3 to a first-class surface with its own spec (§9), and screenshot try-on moved from P1 to P0.
**One line:** Every new drop from the brands and designers you follow, already on you — and your friends vote before you buy.

---

## 0. TL;DR — the verdict before the document

1. **The strongest idea in the brief is #2**, not #1. "New product launches appear in your feed already rendered on you" converts try-on from a tool you have to remember to use into a destination that comes to you on a cadence. Capture-once with progressive disclosure (#1) is correct but table stakes — it is how you make #2 possible, not a differentiator.
2. **"Try-on app" is not a wedge. It is a graveyard.** Google launched Doppl (Jun 2025) and shut it down Apr 30, 2026, folding try-on into Search and Shopping. Doji raised $14M (Thrive) in May 2025 to build "fun, social avatar try-on" with favorite-brand onboarding — i.e., roughly this brief. The defensible position is narrower and sharper: **drops on you + decide with friends**, with independent designers as the supply moat and one identity reused across apparel, jewelry, and makeup.
3. **Three things decide the outcome, and none of them is a feature:** (a) render fidelity on real photos of real bodies — the product is trust; (b) render cost vs. affiliate revenue — API renders at $0.034–0.067 each cannot fund "5–10 generated images per day" for every user (math in §13); (c) supply — pre-rendered drops require a catalog ingestion pipeline on day one, not a designer sign-up form.
4. **The share sheet is the second-best idea in the document and was underweighted in v0.1.** Desire happens inside Instagram, TikTok, and the group chat — not inside your app. A one-tap OS share extension is what decouples usage from your push cadence, which makes it the largest available retention lever *and* the cheapest source of catalog-demand signal. **But the Instagram case does not work the way it sounds** (§9.2): sharing an IG post hands you a post URL, not a garment. The mechanic that actually works is *screenshot → share → try on*, which is why screenshot try-on is now P0 and why the hard problem is garment extraction from in-the-wild photos, not the extension itself. A Chrome extension is desktop-only — Chrome on Android does not support extensions — so it is a P2 surface for a cohort you do not have yet.
5. **Scope recommendation:** Phase 1 = apparel + earrings + necklaces (one full-body photo and one selfie cover all three), US women 18–34 who follow brand drops, iOS first. Makeup and rings in Phase 2. **Cosmetic dental is now a separate product with its own PRD** — different intent, frequency, buyer, and legal profile. It shares the identity and capture stack and nothing else.
6. **Monetization order:** affiliate (day one, no sales team) → sponsored drops (the real business: a personalized product-ad format with try-on engagement as the signal) → designer tools. **Note the consequence of the dental split:** this product now has no direct-consumer-payment line and no early cash. The honest replacement is a quota-based premium tier on on-demand share renders (§13) — which only becomes saleable *because* the share sheet makes the quota something users feel. Never paywall the feed.
7. **Onboarding v0.4: show the real thing, then ask for an account.** The sequence is browse → pick an item → capture (first time only) → a **full-quality** render, gated behind a "Sign in with Google" popup rather than a degraded image → sign-up → the same render, now downloadable, pollable, and buyable (§7 C1). Two decisions are bundled here and worth separating: (a) deferring the account until after the render is a good activation bet — nobody signs up for a demo they haven't seen; (b) not degrading the render itself to protect cost is a *trust* decision, made explicitly at the expense of the *economics* decision it replaces — every guest render now costs what an authenticated render costs, whether or not that guest ever signs up. The one-preview-per-Guest-Session cap is what keeps that from becoming an open-ended cost line (§10.2). Separately: the old flow forced 3+ brand follows before the first render, and follows feed the C2 weekly loop and the supply-health metric in §14; that forcing function is gone regardless of render quality, and the redesign only pays for itself if the post-render "follow this brand" prompt is built and measured as part of activation, not filed under P1 as someday polish (C6).

---

## 1. Customer problem

### 1.1 The core problem
When you shop for anything worn on the body, the question that stops the purchase is **"will this look good on me?"** Product photography answers a different question — "will this look good on a model?" — and the gap between the two is where returns, abandoned carts, bracketing (buying three to keep one), and forty-message group-chat deliberations live.

**Evidence** (order of magnitude; verify before external use):
- Online apparel return rates are commonly cited at 20–30%, roughly 2–3x in-store, with fit and "didn't look as expected" the top stated reasons.
- US retail returns were reported at roughly $850B in 2025; several AI startups are explicitly targeting the returns problem with try-on and fit prediction.
- Foundation and lip shade mismatch is the top complaint in online makeup; buying two or three shades to keep one is normal behavior.
- Jewelry scale — earring drop length, necklace length against a neckline, ring width on a finger — is close to impossible to judge from a product shot on a white background.

### 1.2 Why existing try-on doesn't solve it

| Approach | What it does | Why it falls short |
|---|---|---|
| Retailer-embedded try-on (Google Shopping "Try it on", Amazon, Zalando, Sephora/ModiFace) | Try a product from its own listing | A tool, not a habit. Siloed per retailer. You re-supply a photo per site. No memory, no social, no reason to return. |
| Google Doppl (shut down Apr 30, 2026) | Standalone avatar app from Google Labs | Required active intent to open; nothing pulled you back. Google moved the capability into Search/Shopping — a feature, not a destination. |
| Doji | Avatar + social sharing + brand preferences | Closest competitor. Framed around play and inspiration; avatar build historically took ~30 minutes; early users reported avatars rendered thinner or taller than reality. |
| AR makeup (Perfect Corp/YouCam, ModiFace, Pinterest) | Live-camera makeup | Mature, commoditized, real-time video. A photo-based product will not beat them at SKU-level lipstick try-on. |
| LTK / ShopMy | Creator affiliate feeds | The model is the creator, never you. |

### 1.3 The problem by category — and the photo each one needs

| Category | Moment of doubt | Input photo | Render difficulty | Frequency |
|---|---|---|---|---|
| Apparel | "Does this cut work on my body?" | Full body, front, neutral pose, fitted clothes, good light | High (drape, length, proportion, pattern fidelity) | Weekly |
| Earrings / necklaces | "Is this too big / too long for me?" | Face + neck/décolletage, hair back | Medium (rigid object, scale and lighting) | Monthly |
| Rings / bracelets / watches | "Will it look chunky on my hand?" | Hand or wrist | Low–medium | Monthly |
| Makeup | "Is this shade right for my skin?" | Face, bare/neutral, even light, front + 3/4 | Medium (color accuracy on skin tone is the entire point) | Weekly for engaged users |

The reuse map is the design: one selfie covers earrings, necklaces, makeup, and identity verification; one full-body photo covers all apparel; hand and wrist are progressive unlocks. (The smile slot now belongs to the separate dental product, which reuses this same identity service.)

### 1.4 The deeper bet
Facebook digitized relationships and layered a discovery and entertainment engine on top. This product **digitizes you** — a consented, persistent, reusable model of your body, face, and hands — and layers a commerce discovery engine on top. The render is the atomic unit, the identity set is the asset, and the follow graph plus drop feed is the engine. No single retailer owns your body across brands; that is the moat a neutral product can build and Google/Amazon structurally will not.

---

## 2. Why it is worth solving

- **Universal and frequent.** Everyone buys apparel; fashion-engaged users browse weekly and shop monthly. Beauty and jewelry add adjacent frequency with the same identity.
- **Peak intent.** A photorealistic image of *you* wearing a *specific product* is the highest-intent impression in commerce — above a search result, above a creator post, above a retargeting ad. Intent is captured at the moment it peaks.
- **Money at the moment.** Affiliate links monetize intent immediately with no sales team. Later, brands pay to place drops into personalized feeds: a product-ad format where every impression is a personalized creative and engagement (save, poll, click) is a built-in conversion signal.
- **Compounding assets.** Identity set + preference graph (what you save, dismiss, buy) + follow graph. Each render improves ranking; each follow improves supply prioritization.
- **Prize.** US online apparel is on the order of $150B+/yr; beauty and jewelry e-commerce are each in the tens of billions. LTK alone reportedly drives billions in annual GMV on creator affiliate links. 0.1% of US online apparel GMV at a 7% blended commission is roughly $10M/yr — respectable, not the business. The sponsored-drop format is the step change (see §13).

---

## 3. Why now

1. **Model capability crossed the line in 2025–26.** Identity-preserving garment transfer from a single photo is now a prompt-level capability in general image-edit models (Gemini 3.x Flash Image and comparable editors), and strong open-weight virtual try-on models exist for self-hosting. Renders take seconds, not Doji's original 30-minute avatar build. A magic moment under 60 seconds from install is achievable.
2. **Cost is falling but is not yet free.** Current API pricing is roughly $0.045 (512px) to $0.067 (1K) per image on Gemini 3.1 Flash Image, ~$0.034 with batch, ~$0.02 on Imagen 4 Fast; self-hosted open VTON on an L4-class GPU is on the order of $0.003–0.01 per render. This is exactly the curve that makes pre-rendered personal feeds viable over the next 12–24 months — and the constraint that dictates the render-budget policy in §10.
3. **Supply rails exist.** Affiliate networks (Rakuten, CJ, Impact, Awin, ShareASale; Skimlinks/Sovrn for long tail) ship product feeds with images, prices, stock, and tracked links. Shopify merchants and independent designers can upload directly. Catalog is programmatically available; no brand BD is required to launch.
4. **Behavior is already there.** "Should I get this?" in group chats, drop culture, TikTok Shop, "on the model vs on me" as an established content format.
5. **Incumbent posture is now legible.** Google put try-on inside Search; Amazon inside Amazon; both optimize conversion of their own inventory. Neither will build a cross-retailer, follow-your-designers destination with private social decisions. Doji is the one to beat, which makes speed and wedge clarity the deciding variables.

---

## 4. Product principles

1. **Trust beats wow.** Never show a render that fails the quality gate. A bad render costs more than a missing one — it teaches the user the product lies.
2. **Your body, as-is.** No slimming, heightening, skin smoothing, or feature "enhancement." Proportion fidelity is a correctness requirement, measured and gated. Doji's "thinner and taller" complaints are the cautionary tale.
3. **Look, not fit.** We show how it looks. We never claim how it fits. Sizing is a separate product (partner integration later), and the UI says so.
4. **Capture once, reuse everywhere.** Ask for another photo only when it unlocks something the user can see immediately.
5. **Private-first social.** Sharing goes to friends and group chats. Non-users can vote without installing **and without an account, full stop** — this is unrelated to and unaffected by the C1 onboarding sequencing (§7): voting has never required identity of any kind, and the v0.3 redesign doesn't touch it. There is no public feed of people's renders.
6. **Drops, not search.** The feed comes to you on a cadence; search and link-paste exist for intent, not as the default loop.
7. **Every render earns its cost.** Render budget is a function of predicted engagement and purchase intent, not a flat daily allowance.
8. **Consent is a feature.** Plain-language photo controls, real deletion, no training on user photos by default, visible AI labeling on every output. Consent and age verification happen before the first photo is captured for every user, signed in or not — an account is not a prerequisite for the legal obligation, and deferring sign-up (§7 C1) does not defer this.

---

## 5. Scope and sequencing (with rejected alternatives)

**Beachhead user:** US women 18–34 who follow contemporary and fast-fashion brand drops and consult friends before buying.
*Why:* highest drop cadence, strongest group-chat deliberation behavior, deepest affiliate coverage, densest creator ecosystem for distribution.
*Rejected:* men 18–34 (lower drop-follow and social-deliberation behavior); all-genders launch (dilutes supply curation and creative); occasion/event dressing as the sole wedge (strong social loop, but breaks the weekly drop cadence — keep as a feed "mode," not the product).

**Category sequencing**

| Phase | Categories | Rationale |
|---|---|---|
| 1 | Apparel (tops, dresses, outerwear, bottoms), earrings, necklaces | One full-body photo plus one selfie covers all three. Highest frequency, AOV, and drop cadence. Jewelry is nearly free to add and has high affiliate rates. |
| 2 | Makeup (lips, eyes, full looks from makeup artists), rings, bracelets, watches | Selfie reused; hand photo via progressive unlock. Makeup differentiation is "this creator's look on you," not SKU-level lipstick — leave live AR to Perfect Corp. |
| 3 | Shoes, bags, sunglasses | Rigid objects, easier rendering, lower doubt, good affiliate rates. |
| Spun out | Cosmetic dental | Different intent, buyer, frequency, legal and ad-policy posture. Now a standalone product with its own PRD; shares the identity and capture service only. Out of scope here. |

**Platform:** iOS first (beachhead skew); Android within ~3 months of launch. Web from day one for shared polls/votes. **Share extension ships with v1 on each platform — not as a fast-follow** (§9); an app whose entry point is only its own icon is competing with the user's memory.
**Login:** Google one-tap and Sign in with Apple. (Apple requires Sign in with Apple when any third-party login is offered; on Android, Credential Manager one-tap Google.) Requested via a sign-in popup shown over the first render — full quality, not degraded — not at app open. See the redesigned C1 (§7).
**Out of scope for v1:** fit/size prediction, public profiles, in-app checkout, video renders, lingerie, men's catalog, cosmetic dental, video-frame extraction from shared TikTok/Reels URLs, desktop browser extension.

---

## 6. Core concepts and data model

- **Identity Set** — the user's base photos by slot: `FullBody-Front`, `Face-Front`, `Face-3/4`, `Hand`, `Wrist`. (A `Smile` slot exists in the shared identity service but is owned by the dental product.) Each slot carries a quality score, capture source (live vs. gallery), verification status (face-matched to the live selfie), and freshness date. Can originate from a Guest Session before an account exists (§7 C1).
- **Guest Session** — a device-bound, pre-account identity created during first capture, before sign-up: same slot structure as an Identity Set, no account attached yet. Auto-attaches to the user's account on sign-up (no recapture); purged 24–48 h after creation if no account is ever created, since there is no account relationship yet to justify holding biometric data longer (§15).
- **Base Look** — a normalized derivative of `FullBody-Front` (background cleaned, lighting normalized, pose and body untouched) that all apparel renders share, so the feed reads like a lookbook of one person rather than a collage.
- **Shared Item** — an item that entered via the share sheet, a link, or a screenshot: source payload (URL or image), extraction status, extracted garment asset, resolved Catalog Item if matched, and the sharing user. Shared Items that fail to match are the highest-value input to catalog ingestion (§9.1).
- **Catalog Item** — a product with try-on-ready assets (garment cutout or ghost-mannequin image), price, stock, affiliate or purchase URL, brand/designer, attributes, and a try-on readiness score.
- **Drop** — a set of new Catalog Items from one Brand/Designer with a release timestamp.
- **Render** — (Identity slot + Catalog Item + Base Look) → image, with QA scores (identity similarity, garment fidelity, proportion preservation, artifact score) and a model/version tag.
- **Look** — a composition of multiple items on one render (outfit); can include the user's own wardrobe items (Phase 3).
- **Poll / Ask** — a shareable web object with 1–4 renders and a question; votes and comments from recipients; expiry and revocation. Voting requires no account and creates no Guest Session — a voter is not an identity of any kind, just a rate-limited device fingerprint (C4).
- **Follow** — user → brand or designer; drives drop delivery, notifications, and ranking.
- **Closet** — saved renders and items with price-drop and back-in-stock tracking; owned items after purchase.

---

## 7. Customer CUJs

Each CUJ lists: goal → steps → features (P0 = launch, P1 = within 90 days, P2 = later) → success metrics.

### C1. First session → magic moment
**Goal:** a real, personalized render of *you* in something you'd actually want — before we ever ask for an account — and a full-quality version worth keeping the moment an account exists.

**Design change from v0.2:** account creation moves from step 1 to after the first render. The old flow gated capture behind Google/Apple sign-in; this flow lets a visitor browse, pick an item, and capture a photo entirely as a guest, then generates the real render and gates *actions* on it, not its quality. This should convert better than either alternative — nobody signs up for a demo they haven't seen, and nobody trusts a product whose demo looks worse than what it's selling. It does **not** defer the legal consent requirement: biometric consent and age-gating happen before capture regardless of sign-in status (§15). What moves is account creation, not consent, and — as of v0.4 — not render quality either.

**Steps**
1. **Splash → straight into the catalog.** One line of value, no forced auth, no forced category multi-select. The user lands on a browsable grid of items (curated new-drops and popular picks — a first-time visitor has no follow graph yet). Category (apparel / jewelry / makeup) is no longer a gate the user answers up front; it falls out of whichever item they pick next.
2. **Pick one to try on.** Tap an item card → "Try it on." This single tap replaces the old "what do you want to see on you" multi-select; the item's category determines which capture slot(s) are required (full body for apparel, selfie for earrings/necklaces/makeup).
3. **Consent — before any photo is taken, first time only, regardless of sign-in status.** Plain-language screen: what we store, retention, deletion, no training by default, explicit biometric consent where state law requires it, and age verification (§15). This step is not skippable by staying signed out — anonymous does not mean unconsented.
4. **Capture, first time only**, in this order:
   - **Live selfie** (2 seconds, auto-capture on pose/lighting OK). Required for everyone: it verifies the person and powers jewelry/makeup.
   - **Full body** (only if the picked item needs it). Option A (default): "Pick a photo of you" — with permission, an on-device scan of recent photos suggests candidates with a detected full-body pose, good light, single person. Option B: guided camera with silhouette overlay, timer, and voice prompts ("step back… perfect"). Option C: "Skip for now," with the body prompt deferred.
   - Quality check with instant fix-it feedback: lighting, blur, occlusion, pose, multiple people, face too small. Face-match between the live selfie and the chosen body photo (own-photo verification, §15). If the gallery photo fails, fall back to Option B without losing progress.
   - The resulting Identity Set is created inside a **Guest Session** — device-bound, not yet an account — so it survives app restarts and auto-attaches to an account the moment one is created, in this session or a later one on the same device. No recapture, ever, on account of signing up late.
5. **Generate — full quality, always.** The render runs on the same model tier as any authenticated render and passes the exact same QA gate (§10.3) — identity similarity, garment fidelity, proportion preservation, artifact detection. No signed-out user ever sees a render that would fail the bar a paying, signed-in user sees; a bad first impression costs more than an unconverted guest (Principle 1). Target: render visible ≤ 15 s after capture, same bar as before.
6. **Sign-in popup, overlaid the moment the render is ready.** "Like it? Sign in with Google to save it, download it, and ask your friends." (Sign in with Apple appears with equal weight in the actual UI — Apple requires it whenever a third-party login is offered — even though "Sign in with Google" is the lead in marketing copy.) The popup is dismissible so the user can keep looking at the render, but every action is locked behind it: no download, no save, no buy, no poll, no share. Dismissing doesn't unlock anything; it just leaves the user looking at a picture of themselves they can't yet do anything with.
7. **Sign up → same asset unlocks, no re-render.** The Guest Session's Identity Set and the render already on screen attach to the new account automatically — this is the same pixels the guest was just looking at, not a second, better version, so there's no wait and no risk of the authenticated render looking different from what sold the signup. Actions unlock in place: **Download, Ask friends (create a poll), Buy, Save**, plus the On the model / On me toggle and "See 4 more" → the feed (C2). If the render fails QA, the user never sees a failure — a backup render replaces it before it's ever shown, signed in or not.

**The screenshot problem this creates, and the mitigation:** an un-degraded, ungated *image* behind a popup is screenshot-able — a guest can capture the pixels and walk away without ever signing up, which a low-quality render structurally couldn't do (there was nothing worth stealing). Two things keep this from gutting the funnel: the pre-signup render still carries the standard AI-generated label baked into the pixels (§15), so a screenshot isn't a clean asset the way a post-signup download is; and the value being gated is action, not appearance — a screenshot can't be polled, bought through, or added to a Closet, which is where the actual habit lives (C2–C4). Watch the screenshot rate as a leading indicator during Phase 0; if guests are visibly satisfied with a screenshot and never returning, the popup's copy and timing need to work harder, not the pixels get worse again.

**Guest limits, so this stays affordable — now the load-bearing cost control:** one full-quality guest render is free without an account; a second try-on attempt while still signed out prompts sign-up rather than spending another render (§10.2, Tier 0). This cap did comparatively little work in v0.3, where an unconverted guest only cost the cheap self-hosted tier; in v0.4 it's the entire defense against paying authenticated-tier render cost for browsing that never converts, so treat "raise the free-preview cap" as a request that needs a conversion-rate number behind it, not a UX nicety. A guest who never signs up has their captured photos and this render purged 24–48 hours after capture — long enough to survive "I'll finish this later," short enough that we are not holding biometric data on someone who never entered an account relationship.

**The trade-off this creates (unchanged from v0.3, independent of render quality):** the old flow forced 3+ brand follows before the first render; follows are what feed C2's ranking and the supply-health metric in §14. Item-led browsing has no equivalent forcing function. The post-full-render "follow this brand" prompt below is therefore load-bearing, not a nice-to-have — build and measure it as part of activation, and re-test whether follows-by-D7 still clears its old ≥5 target once this ships. If it drops, put an explicit "follow 3 brands" prompt back on the magic moment screen, where it costs a tap rather than an account (C6).

**Features:** P0 — catalog browse with no auth wall; item-led capture-slot resolution; consent-and-age-gate module shown pre-capture for guests and signed-in users alike; on-device photo candidate scan (iOS Vision / ML Kit pose detection); guided capture with overlay and timer; capture quality scorer; face-match; Guest Session (device-bound identity, auto-attach on signup); full-quality guest-render tier passing the standard QA gate (§10.2, §10.3); sign-in popup overlay with locked actions (download/save/buy/poll all gated, pixels not gated); in-pixel AI-label baked into the guest render (screenshot mitigation); unlock-in-place on signup — no second render; guest-render cap (one free per Guest Session) and 24–48 h anonymous-data purge; brand-follow prompt immediately after signup (load-bearing for §14's follows-by-D7 and C2's supply signal, not cosmetic). P1 — voice-guided capture; "ask someone to take it" mode; multiple base looks (hair up/down, with glasses).

**Metrics:** open → item picked (new top-of-funnel step) · item picked → capture completed · capture first-attempt success > 85% · capture → guest render shown, p50 < 60 s / p90 < 120 s · **guest render → sign-up conversion** (the number that decides whether this whole design is affordable — see §10.2; it needs to be measurably higher than v0.3's degraded-preview conversion rate to justify the cost increase) · guest-render screenshot rate without signup (leading indicator of value leaking around the gate) · sign-up → actions unlocked latency (should be ~instant, no re-render) · first-session renders viewed ≥ 5 · first-session save, download, or share rate · QA pass rate on the guest render (must equal the authenticated-render bar, not a lower one) · Guest Session → account attach success rate (target ~100%) · post-render follow-prompt CTR (tracks against the §14 follows-by-D7 risk above).

### C2. Weekly: "this week on you"
**Goal:** the user returns every week without remembering to.

**Trigger:** rich push or email — "Aritzia dropped 6 pieces. Here they are on you." — with the render as the image. Never a text-only nudge.

**Steps:** open → feed of 5–10 renders ranked from: drops from followed brands/designers (primary), recommended items (taste model), completed looks built around saved items, friend-poll results, seasonal edits → per-card actions: Save · Buy · Not for me · Ask friends · Try with… · On model / on me toggle → end of feed: "More tomorrow," plus at most one progressive-capture card ("See rings on your hand — 10 seconds").

**Features:** P0 — feed ranking service (follows, saves, dismissals, dwell, click-outs, price band, style embeddings); render scheduler with budget tiers (§10); rich push with image; frequency caps; negative feedback; on-model toggle; end-of-feed unlock card. P1 — "complete the look"; seasonal/occasion modes ("wedding guest," "vacation"). P2 — wardrobe ingestion so new items render alongside what you own.

**Metrics:** WAU · weekly renders viewed per user · feed completion rate · save rate · click-out rate · "not for me" rate (target < 20%; above that the ranker or supply is wrong) · push opt-in (target > 60%) and push CTR · W1→W4 retention.

### C3. Try on anything you see — share sheet, screenshot, link
**Goal:** the moment of wanting something happens inside Instagram, TikTok, a friend's text, or a retailer's site — not inside this app. Meet it there. Two taps from anywhere to a render of you. Full surface spec and technical reality in §9.

**Steps:** user sees an item in any app → OS share sheet → **OnMe** → extension captures the payload (URL or image), confirms in under a second, and closes → server extracts the garment, matches to catalog if possible, renders on the user's Base Look → push notification → the render opens with the same card actions as the feed (buy, save, poll, ask).

**Features:**
- **P0** — iOS Share Extension accepting both URLs and images; **screenshot try-on** (promoted from P1: it is the only path that works for Instagram, §9.2); URL extraction via JSON-LD `Product` / Open Graph; garment segmentation from worn-garment source photos; catalog image-match; **the fallback ladder** (§9.3) so no share ever dead-ends; on-demand render queue on the high-quality tier; fire-and-forget UX with push completion; per-user daily on-demand quota.
- **P1** — Android `ACTION_SEND` intent filter (ships with Android launch); "closest 6 in catalog" near-match; paste-URL in-app for users who have not found the share sheet; share history / "recently tried" tray.
- **P2** — iOS Safari web extension; Chrome desktop extension; TikTok/Reels video-frame extraction.

**Metrics:** % of WAU who use the share sheet by W2 (target ≥ 35%) · share-initiated renders per WAU per week (target ≥ 2 by W4) · extraction success by source type (URL > 85%, screenshot > 60%) · time-to-render p50 < 20 s · **share-render click-out rate vs. feed click-out rate** (hypothesis: 3–5×; this is the metric that justifies the expensive render tier) · retention lift of share-sheet users vs. non-users (the number that decides how hard to push discovery of the feature).

### C4. Decide with friends: polls and "ask"
**Goal:** turn the group chat into the acquisition channel.

**Steps:** select 2–4 renders → "Which one?" (or one render → "Should I get this?") → share sheet to iMessage / WhatsApp; the link preview shows the renders → recipient opens a web page, votes in one tap **with no login and no account, ever** — this is a hard requirement, not a default that erodes over time — optional comment, optional **"See it on me"** → results land in-app; push "Priya voted 👗 #2" → Buy.

**Not a Guest Session:** a poll recipient who only votes never enters a Guest Session (§6) — no photo, no capture, no identity of any kind, nothing to attach to an account later or purge on a timer. Guest Session is specifically the pre-signup *capture* flow in C1; voting doesn't touch it. The only bridge between the two is the recipient tapping **"See it on me,"** which is an explicit, separate opt-in into C1's try-on flow (still signup-deferred there too, per §7) — voting itself stays a zero-identity action no matter what.

**Features:** P0 — poll object; web voting page (no login, no account — device-fingerprinted rate limit on double votes is the only anti-abuse mechanism, never an auth wall); OG image generation for previews; expiring links (7-day default), revocation, watermark + AI label; vote notifications; recipient → install path with the same item pre-queued as their first magic moment (only triggered by "See it on me," never by voting). P1 — group polls with named voters; "ask a stylist" (paid human opinion, later).

**Metrics:** polls created per WAU · recipients per poll · vote rate · recipient → install (k-factor; target ≥ 0.4) · poll → purchase rate.

### C5. Progressive capture (unlock a category)
**Trigger:** tapping a ring item, or a feed unlock card.
**Steps:** 10-second guided hand capture → three ring renders immediately. Same pattern for wrist.
**Features:** P0 — slot-specific guided capture; slot-aware ranking (never show ring renders before the slot exists; unlock cards capped at one per session, suppressed after two dismissals).
**Metrics:** unlock prompt CTR · capture completion · incremental renders and saves after unlock.

### C6. Follow brands and designers
**Steps:** follow from any card, including the follow prompt surfaced immediately after the first full-quality render (§7 C1 — as of v0.3 this is the primary follow entry point, since onboarding no longer requires 3+ follows up front); brand/designer page with "their drops, on you" grid; manage follows; per-brand notification setting.
**Features:** P0 — brand/designer pages; follow graph; drop detection via catalog diff; notification preferences; post-magic-moment follow prompt (moved here from onboarding, §7 C1). P1 — "brands like this"; designer spotlights.
**Metrics:** follows per user (target ≥ 5 by D7 — no longer forced by onboarding, so treat this as a live risk, not an assumption; §0.7) · % WAU receiving ≥ 1 followed-brand drop per week (supply health) · drop notification CTR · post-render follow-prompt CTR.

### C7. Buy
**Steps:** Buy → affiliate deep link (size/color preselected when known) → retailer checkout → conversion postback → optional "Did you get it?" → Closet marks owned → "Wear it with" suggestions next week.
**Features:** P0 — affiliate link generation per network; conversion attribution; price/stock sync. P1 — deep-link mapping to variant pages; owned items; return feedback ("Kept / Returned — why?") as a fidelity signal. P2 — in-app checkout for designers (Shopify/Stripe).
**Metrics:** click-out rate · click → order conversion · GMV · commission revenue · attribution coverage (share of click-outs with postback).

### C8. Closet: saves, price drops, back in stock
**Features:** P0 — saved renders/items. P1 — price tracking and back-in-stock alerts with the render as the image.
**Metrics:** saves per WAU · alert CTR · alert → purchase.

### C9. Privacy controls
**Steps:** see every stored photo and render; retake; delete one or all (immediate purge incl. renders and caches); export; opt in/out of model improvement; delete account.
**Features:** P0 — photo vault; deletion pipeline with SLA; consent log; data export.
**Metrics:** deletion SLA compliance (100% within 24 h) · privacy support tickets per 1k users.

---

## 8. Designer and brand CUJs (supply side)

**Who:** (a) **Brands** ingested from affiliate feeds — no action required; they can claim their page later. (b) **Designers** — independent labels, Shopify merchants, boutiques, and (Phase 2) makeup artists who self-serve.

**Value proposition to designers** (this is why they come, not vanity): *"Your next collection on 10,000 real bodies before you produce it."* Demand signal — try-ons, saves, polls, pre-orders — before a production run. Big brands get this from their own data; indie designers have never had it.

### D1. Register and verify
Google/Apple sign-in → business profile → verification (domain email, Instagram/Shopify link, manual review for the first 500) → terms: IP warranty on uploaded products, rights grant to render products onto users, takedown process.

### D2. Make products try-on-ready
Upload product photos (flat lay / ghost mannequin / on-model) → auto-segmentation and background removal → **try-on readiness score** with concrete fixes ("front view missing," "model occludes hem") → metadata (category, price, sizes, colors, purchase URL or Shopify checkout link) → preview on six diverse consented house models before publish → publish.
**Features:** P1 — upload flow; segmentation; readiness scorer; house-model preview; Shopify product import. P2 — bulk CSV/API.

### D3. Publish a drop
Schedule a drop → followers receive a rendered push/email → drop page with "on you" grid → designer receives a reach summary within 24 h.

### D4. Read the signal
Dashboard: try-ons, saves, shares, polls, click-outs, orders, conversion by item; aggregated and anonymized audience (size distribution, region, price band) — **never identifiable renders**. "Pre-order" toggle for demand validation.

### D5. Boost a drop (Phase 3)
Pay to place renders into lookalike users' feeds; CPM or CPA; frequency-capped; labeled "Sponsored"; quality-gated like every other render.

**Metrics:** designers onboarded · % products try-on-ready · time to first drop · drop reach and CTR · designer-side conversion · pre-orders per drop · boost spend and ROAS.

**Cold-start supply plan:** ingest ~200 brands from affiliate feeds before launch, prioritized by drop cadence × beachhead affinity × commission rate; Skimlinks/Sovrn for long-tail coverage; 30 hand-recruited indie designers at launch with white-glove onboarding (a founder does this personally). Without ingested supply, "follow brands" is an empty promise on day one — this is the single most underestimated workstream in the brief.

---

## 9. The share surface: share sheet, screenshot, extensions

*Cosmetic dental was in this slot in v0.1. It has been spun out into its own product and its own PRD; only the identity and capture service is shared. Nothing else in this document depends on it.*

### 9.1 Why this is the highest-leverage surface in the document — for a reason that is not convenience

Three arguments, in order of strength:

1. **It decouples usage frequency from your push cadence.** Without it, sessions happen when *you* send a drop — maybe 3–5 times a week, capped by your supply and by push fatigue. With it, sessions happen when the *user* sees something she wants, which is many times a day on Instagram alone. Every retention lever in this document is a scheduling lever except this one.
2. **It is free demand signal that solves cold-start on the supply side.** Every failed match is a labeled request: *this user wanted this brand, this item, this price point, today*. Rank ingestion by share volume and the catalog builds itself toward demand instead of toward whichever affiliate feed was easiest to parse. This is worth more than the feature itself.
3. **Intent is explicit, so the economics invert.** A feed render is a guess; a shared render is a stated intention. Feed renders lose money at API prices (§13). Share renders roughly break even to modestly positive at the same prices — worked below — which means the expensive high-quality model tier belongs *here*, not in the feed.

**What it is not:** an acquisition channel. You cannot share to an app that is not installed. It converts installed users into habitual ones and raises the quality of every downstream metric; it does not bring new users. Rank it as retention and intent, not growth.

### 9.2 What the share sheet actually hands you (the part that breaks the Instagram story)

| Source | What the OS actually passes | Viable path |
|---|---|---|
| Retailer page in Safari/Chrome (Zara, Revolve, Nordstrom, Aritzia) | Clean product URL | **Best case.** JSON-LD `Product` schema or Open Graph image → catalog match or direct cutout. Expect 85–95% on the top-200 retailers. |
| **Instagram post or Reel** | `instagram.com/p/{shortcode}` — a link to a **post**, not a product. Meta blocks unauthenticated fetches; oEmbed is app-review-gated and returns embed HTML, not an isolable garment image | **Fails as a URL.** The path that works is: user screenshots the post, then shares the **image** from Photos. Design the entire feature around this. |
| TikTok video | Video URL | Frame extraction is a separate pipeline. Out of scope v1 — accept a paused-frame screenshot instead. |
| Pinterest pin | Pin URL, usually with a resolvable source image and often an outbound product link | Second-best after retailer URLs. |
| Photos app (screenshot) | The actual image | Highest volume in practice, hardest CV problem. |
| iMessage / WhatsApp forward | Image or link from a friend | Highest intent of all — this is the group chat handing you a job. |

**The correction this forces:** the brief's example — "user sees a dress on Instagram and shares it" — is a *screenshot* feature wearing a URL feature's clothes. Screenshot try-on moves to P0. If it does not work, the Instagram case does not exist.

### 9.3 Extraction: two different problems, wildly different difficulty

**Problem A — URL to product.** Structured extraction. Largely solved: schema parsing, OG tags, a per-retailer adapter for the top 50, affiliate-feed matching by URL. Success 85–95%.

**Problem B — worn-garment photo to transferable garment.** The source is a person wearing the item: posed, occluded by arms and hair, folded, cropped at the frame edge, lit by someone else's ring light, sometimes low-resolution from a compressed screenshot. This is materially harder than the ghost-mannequin catalog images the feed model is trained on. Budget for **55–70% acceptable at launch** against 85–95% for catalog images. This is the quality floor of the entire feature, and it is the number to prove in Phase 0 — not the extension, which is a week of work.

**The fallback ladder — no share ever dead-ends:**
1. **Exact catalog match** (image-embedding search over the ingested catalog) → clean render, affiliate link, monetizes.
2. **Near-match: "the closest 6 we can put on you"** → renders, monetizes, and is frequently *better for the user* than the original (same look, in stock, cheaper). Treat this as a first-class outcome, not a consolation prize.
3. **Direct garment transfer** from the source image → renders, does not monetize, still delights.
4. **Honest failure** → "I can't isolate that one cleanly" + save to Closet + auto-retry when the catalog grows + it enters the ingestion queue as demand signal.

Steps 2 and 4 are why this feature strengthens the business rather than leaking value to items you cannot monetize.

### 9.4 The surface family — and the Chrome reality

| Surface | Platform reality | Priority | What it is actually for |
|---|---|---|---|
| iOS Share Extension (URL + image) | Native, one tap from any app | **P0, ships with v1** | The core mechanic |
| Android `ACTION_SEND` filter (`text/plain` + `image/*`) | Native, same | **P0 at Android launch** | Same |
| iOS Safari web extension | Supported since iOS 15, but installation is buried in Settings → Safari → Extensions; adoption will be a small fraction of share-sheet adoption | P2 | An in-page "try this on" button while browsing mobile web |
| **Chrome desktop extension** | **Chrome on Android does not support extensions.** This is desktop-only, permanently | **P2** | Desktop shoppers (higher AOV, work-hours browsing) — and, more usefully, a passive catalog-discovery instrument |

**Blunt version:** a Chrome extension is not a mobile feature, and your beachhead shops on a phone. It is worth building for two reasons that are not user-facing: higher-AOV desktop sessions at Net-a-Porter / Nordstrom / Revolve, and the browsing telemetry that tells you what to ingest. Build it in Phase 2 at the earliest, and consider building it first as an internal tool for the catalog team.

**Implementation constraint that determines the UX:** iOS share extensions run in a memory-capped host process (~120 MB) and are killed if they exceed it. The extension therefore must not render, must not download large assets, and must not block. It captures, enqueues, confirms in under a second, and exits. The render completes server-side and returns as a push. This is not a compromise — it hands you a legitimate, user-initiated push notification, which is the only kind that does not erode opt-in.

### 9.5 Cost and abuse controls

- **Two budgets, not one.** The feed budget (§10.2) is yours to control. The share budget is the *user's* — it grows with engagement, which is the opposite of every other cost line. Cap it: 15 on-demand renders/day free, then lower-priority queue; a visible counter (which is also the natural premium upsell, §13).
- **Cache extraction globally by perceptual hash.** A garment that goes viral is extracted once and rendered N times; extraction is the expensive step, not the render.
- **Hard safety rule: an image arriving via the share sheet is a garment source, never an identity source.** Never render a garment onto a face from a shared image. This one rule closes both the "try this on my coworker" abuse case and the deepfake vector. If the shared image contains a person, use it for the garment only and render on the verified user's Base Look.
- **The share sheet is an unfiltered ingress.** Treat it as one: hash-matching against known illegal content, adult-content classification, and minor detection on every inbound image, before any model touches it.

### 9.6 The economics of a share render (why the expensive tier belongs here)

Per share-initiated render at API prices: click-out 25% (vs. 6% in the feed, because intent is explicit) → click-to-order 4% → AOV $85 → 7% blended commission = **$0.060 revenue against $0.045 cost, roughly +$0.015**. At 30% click-out and 5% order rate: **+$0.044**. Compare with a feed render, which is deeply negative at the same cost (§13.2).

The conclusion is a routing rule: **high-quality API models serve share and on-demand; the self-hosted model serves the feed.** If measured share click-out lands below ~12%, that inverts and share renders must move to the cheap tier too.

### 9.7 Metrics and kill criteria

**Metrics:** % of WAU using the share sheet by W2 (≥ 35%) · share renders/WAU/week (≥ 2 by W4) · extraction success by source (URL ≥ 85%, screenshot ≥ 60%) · share-render click-out vs. feed click-out (hypothesis 3–5×) · **retention delta between share-sheet users and non-users** (the number that decides whether onboarding should teach the share sheet before it teaches the feed) · share of ingestion backlog sourced from failed matches.

**Kill criteria:** screenshot extraction below 50% acceptable after Phase 0 → ship URL-only, hide screenshot, and say so plainly in marketing rather than shipping a coin flip. Share click-out below 12% → route share renders to the cheap tier and stop treating them as premium.

---

## 10. Feed and render economics

### 10.1 The constraint
"A personalized feed of 5–10 generated images per day" for every user is not affordable at API prices. 10 renders/day × 30 days × $0.045 ≈ **$13.50 per user per month**, against affiliate revenue measured in cents (§13). The feed must be engineered around a render budget, and the budget must be a function of predicted engagement and intent. The v0.4 onboarding (§7 C1) adds one more render before any of this: a free, **full-quality** preview for a signed-out guest, generated on the same tier as an authenticated render. This was a deliberate reversal of the v0.3 design, which used the cheap self-hosted tier and degraded the image so an unconverted guest cost almost nothing — that protected the budget but, per Principle 1, risked teaching a first-time visitor that the product's real output looks mediocre. v0.4 accepts the higher per-guest cost in exchange for a demo that actually represents the product, and moves the entire cost control onto one lever: the hard cap of one free guest render per Guest Session before sign-up is required (§10.2). That cap is no longer a nicety — it is the only thing standing between this step and an unbounded acquisition cost, so it should not be relaxed without a measured guest-render → sign-up conversion rate to justify it (§14). Rough math at API pricing: at $0.045/render and, say, a 40% guest → sign-up conversion (the §14 hypothesis), the render cost per acquired account from this step alone is ~$0.11; at 15% conversion it's ~$0.30. Compare against typical paid-install CAC of several dollars (§11.3) — this is cheap even in the bad case, but it is a real, uncapped-by-nothing-else line, and it is the first number Phase 0 should measure before this design is treated as final.

### 10.2 Render budget policy

| Tier | Who | Policy | Model tier |
|---|---|---|---|
| 0 — Guest preview | Guest Sessions, pre-signup | One free render per Guest Session, full quality, same QA bar as any other render (§10.3) — the only thing gated is actions (download/save/buy/poll), never the image. A second try-on attempt while still signed out prompts sign-up instead of another render. On signup, this exact render attaches to the new account; it is not regenerated. Not cached for anonymous reuse — an unconverted guest's render is discarded at purge (§7 C1, §15), not served to anyone else. | **Same tier as Tier A (best available)** — this is the costliest line in the render budget per guest that doesn't convert, by design (§10.1) |
| A — New (days 0–7) | Everyone, post-signup | Up to 15 renders/day. The first is usually the guest render already generated pre-signup, unlocked rather than regenerated. This is acquisition cost; spend it. | Best available (API) |
| B — Active (opened in last 7 days) | Core | Render **just-in-time on open**, not on a schedule. Pre-render only the top 3 candidates for the next expected open (predicted from open-time pattern). 5–10 per open, cap 15/day. | Self-hosted for feed; API for on-demand (link paste, tap-to-try) and items with high purchase probability |
| C — Dormant (8–30 days) | Lapsing | 1–2 renders, attached only to the weekly digest or a drop notification from a followed brand. | Self-hosted |
| D — Churned (30+ days) | Lost | One render per win-back message, max 2/month. | Self-hosted |

Rules: cache every render by (identity version, item id) and reuse it across push, email, feed, and polls; a drop item rendered once serves every surface. Target blended cost ≤ **$0.25 per WAU per month** by month 9.

### 10.3 Quality gate (the product's immune system)
Every render passes automated QA before any user sees it:
- **Identity similarity:** face-embedding cosine against the base selfie ≥ threshold.
- **Garment fidelity:** VLM judge compares render to product image on color, pattern, neckline, sleeve, length; returns pass/fail with reason codes.
- **Proportion preservation:** silhouette and keypoint delta versus the Base Look within tolerance. This is the anti-slimming guard and is non-negotiable.
- **Artifact detection:** hands, text, extra limbs, background drift.

Policy: pass → show; borderline → one re-render on an alternate model; fail → drop silently and backfill. Weekly human panel of 200 renders stratified by skin tone × body size × category; track a "looks like me" score. Targets: auto-QA pass ≥ 80%; user "doesn't look like me" reports < 2% of renders viewed.

### 10.4 Latency
Feed open shows ≥ 3 renders within 2 s (cached or pre-rendered), remainder stream. On-demand (link paste) p50 < 15 s, p90 < 30 s, with a progress skeleton that names the item.

---

## 11. Growth: viral loop, social, ad copy, content, SEO

### 11.1 The viral loop — and its honest math
The poll is the loop: each poll reaches 3–5 people, recipients vote on the web without installing, and the vote page carries one prominent CTA — **"See it on you"** — which opens onboarding with that exact item pre-queued as the recipient's magic moment.

Honest math: 0.3 polls per WAU per week × 4 recipients × 50% vote × 15% tap "see it on you" × 50% install ≈ **0.045 installs per WAU per week, ~0.18 per month**. That is a real tailwind, not a growth engine. Levers to push it toward k ≥ 0.4: make "Ask friends" the default next action after a save; show the recipient the item on diverse house models plus the "see it on you" button above the fold; format the WhatsApp/iMessage preview so the renders are the preview image; raise polls/WAU with occasion modes (wedding guest, vacation), where deliberation is intense. Plan for creator-led distribution to carry acquisition; the loop lowers blended CAC.

### 11.2 What is actually true about this product on social
1. **Renders are personal, so everyday users share privately, not publicly.** Organic UGC volume will be low. Plan for creator-led public content and private share loops; do not build a growth plan on users posting their own renders.
2. **The demo is the ad, and the share sheet is the demo.** "Screenshot any Instagram post → share → 10 seconds → it's on me" is a complete story in 15 seconds, and it is a story every viewer can immediately picture doing tonight. This is a better hook than the feed, because the feed requires explaining a subscription-like concept while the share sheet is one recognizable gesture. Every other feature is secondary in creative.
3. **Reactive drop content beats evergreen.** "Skims dropped today — all 12 pieces on 5 body types" rides the interest spike. This requires a same-day content workflow: ingest → render on five consented house models → post within 6 hours.
4. **Trust content outperforms hype.** "On the model vs on me," including honest misses, builds the one thing the product depends on. Fashion TikTok is hostile to "AI" framing — lead with "see it on you," label outputs as AI, never lead with the technology.
5. **The share-sheet gesture is the most imitable thing you have.** Screen-recorded share-sheet demos are trivially reproducible by creators, which is exactly what you want from a brief: low production cost, high fidelity to the real product, and no need for the creator to like your taste in clothes.
6. **Pinterest is the sleeper channel.** Fashion intent lives there; product pins with house-model renders that link to brand try-on pages compound slowly and cheaply.

### 11.3 Channel plan, ranked by expected efficiency
1. **Creator seeding** — 40 micro-creators/month (10k–150k, fashion, GRWM, hauls), gifted access + referral code + revenue share on attributed orders. Brief: the paste-link demo and a drop reaction. This is the primary channel for the first six months.
2. **Product-led virality** — polls (§11.1).
3. **Owned reactive content** — TikTok, IG Reels, YouTube Shorts; the calendar in §11.6.
4. **Apple Search Ads** on intent terms ("virtual try on," "try on clothes," "outfit app," "see it on me") — small budget, high intent.
5. **Meta/TikTok paid with UGC creative** — only after W4 retention ≥ 15% and a measured k. Shopping-app CAC is typically several dollars per install; affiliate-only payback exceeds 12 months, so paid is justified by retention plus the sponsored-drop revenue roadmap, not by affiliate alone.
6. **SEO** — slow, and slower now that dental has been spun out: that funnel carried the only concentrated, fast-ranking intent in the plan. Brand new-arrivals pages first (§11.7); expect nothing before month 6.
7. **Communities** (Reddit fashion subs, Discords) — manual, honest, low volume; never astroturf.

### 11.4 Ad copy
**Headlines — apparel**
- Every new drop. Already on you.
- Stop guessing how it'll look. See it on you.
- Try on the whole new-arrivals page in 30 seconds.
- The fitting room that follows your favorite brands.
- Before you buy it, wear it.
- Should I get it? Ask them — with it already on you.

**Headlines — jewelry**
- See the earrings on your ears, not a model's.
- Too long? Too big? Find out before it ships.

**Headlines — makeup (Phase 2)**
- Every shade on your face before you order.
- Her look. On you.

**Headlines — designers**
- Your next collection on 10,000 real bodies — before you make it.
- Drop it on your followers. Literally.

**Headlines — share sheet**
- Screenshot it. Share it. Wear it.
- See a dress on Instagram? Two taps and it's on you.
- The share button is the try-on button.
- Stop wondering how it'd look on someone your size.

**Primary text examples**
- "Follow Aritzia, Reformation, and Mejuri. When they drop something new, it shows up on you — not a model. Save it, buy it, or send it to the group chat and let them vote."
- "Screenshot anything — an Instagram post, a friend's text, a product page. Share it to OnMe. Ten seconds later it's on you. No avatar, no 30-minute setup — one photo you already have."
- "Brands photograph clothes on one body. You have a different one. See what it actually looks like on you before you pay for shipping twice."

**CTAs:** See it on me (primary) · Try the drop · Show me · Get my looks · Vote · Share it to try it.
**Avoid in headlines:** "AI," "virtual," "avatar," "digital twin." Hypothesis to test: these underperform "see it on you" with the beachhead audience.

### 11.5 Creative concepts
1. **The link demo** — raw screen recording: copy a Zara link from Safari, share to OnMe, 8-second timer on screen, render appears, creator reacts. 15 s. Runs everywhere; the hero ad.
2. **Entire new arrivals on me** — creator scrolls 20 renders of one drop on herself with voiceover rankings ("1, 7, and 12 — the rest are a no"). 30–45 s.
3. **Model vs me** — split screen: product photo / render on creator; includes at least one honest miss ("this one rendered the hem wrong, and that's why I'd still order a size up"). Trust content.
4. **The group chat decides** — screen recording of a poll in a WhatsApp group with real friend reactions; comedic; ends on the purchase.
5. **500 bodies, one dress** — an indie designer story: the dress on diverse house models and (consented) users, the pre-order count ticking up. Supply-side recruiting and consumer content at once.
6. **"Screenshot to closet"** — screen recording, no face, no voiceover: scrolling Instagram → screenshot a dress → share sheet → OnMe → 10 seconds → it's on her → poll to the group chat → "ok buying it." The whole product in 20 seconds, shot on a phone, trivially reproducible by any creator.

### 11.6 30-day content calendar
Platforms: TT = TikTok, IG = Reels (cross-post), YTS = YouTube Shorts (repost 24 h later), Pin = Pinterest (daily product pins, automated from house-model renders), X/Threads = short text + image. Sat/Sun are reactive slots: whichever brand dropped that week.

| Day | Platform | Format | Hook / angle | CTA |
|---|---|---|---|---|
| **Week 1 — The demo** | | | | |
| Mon | TT, IG | Link demo (creative 1) | "Paste any link. 10 seconds. On me." | See it on me |
| Tue | TT, IG | Link demo, jewelry | "The earrings looked tiny online. They're not." | See it on me |
| Wed | TT, IG, YTS | Model vs me (creative 3) | "Why the dress looks different on me than on the model" | See it on me |
| Thu | TT, IG | Link demo, different body type / creator | Same format, new face — repetition builds the format | See it on me |
| Fri | TT, IG | "5 things I'd never have ordered — until I saw them on me" | Discovery angle | Get my looks |
| Sat–Sun | TT, IG, Pin | Reactive: this week's biggest drop on 5 house models | "[Brand] dropped. All of it, on 5 bodies." | Try the drop |
| **Week 2 — Drop week** | | | | |
| Mon | TT, IG | Entire new arrivals on me (creative 2) | "[Brand] new arrivals, all 20, on me — ranked" | Try the drop |
| Tue | TT, IG, YTS | Same, second creator/brand | Different aesthetic (minimal vs maximal) | Try the drop |
| Wed | X/Threads, IG Story | Poll: "Which one should she keep?" (creator's renders) | Audience participation | Vote |
| Thu | TT, IG | "Follow a brand and this happens" — push notification demo | The habit loop, shown | Follow your brands |
| Fri | TT, IG | Price-drop story: "The dress I saved dropped 30% — OnMe told me first" | Closet value | Get my looks |
| Sat–Sun | TT, IG, Pin | Reactive drop | Same-day render of a real drop | Try the drop |
| **Week 3 — The group chat decides** | | | | |
| Mon | TT, IG | Group chat decides (creative 4) | "I let my friends pick my outfit for the wedding" | Vote |
| Tue | TT, IG, YTS | Ask-a-friend duet: friend reacts to render on camera | Social proof | Vote |
| Wed | TT, IG | Occasion mode: "Wedding guest — 8 options on me in 2 minutes" | Use case | Show me |
| Thu | X/Threads | Thread: why we will never slim your body (principles, plainly) | Trust | — |
| Fri | TT, IG | "We got it wrong" — a render miss and how the quality gate works | Trust | — |
| Sat–Sun | TT, IG, Pin | Reactive drop + repost week's best | | Try the drop |
| **Week 4 — Designers and honesty** | | | | |
| Mon | TT, IG | 500 bodies, one dress (creative 5) | Indie designer spotlight + pre-order | See it on me |
| Tue | TT, IG, YTS | Designer POV: "I saw 2,000 people try on my jacket before I made it" | Supply recruiting | Designers: apply |
| Wed | TT, IG | Jewelry: necklace-length guide, rendered on 3 necklines | Utility | See it on me |
| Thu | TT, IG | Creator "honest week with OnMe" — what she bought, what she returned | Trust + retention | Get my looks |
| Fri | TT, IG | Month recap: most-tried items, most-polled item, most-saved brand | Data story | See it on me |
| Sat–Sun | TT, IG, Pin | Reactive drop; share-sheet screen recording (creative 6) | | Share it to try it |

Cadence: 5 owned posts/week plus creator content; every post uses one of the CTAs above; every render shown is labeled. Measure per post: saves, shares, profile → install, and which hook formats clear 2% install CTR — then double down on those and kill the rest in month 2.

### 11.7 SEO and ASO
**ASO (matters more than SEO for the app):** keywords "try on clothes," "virtual try on," "outfit try on," "see clothes on me," "dress try on," "earrings try on," "screenshot try on." First screenshot = the share-sheet demo (the gesture, mid-tap, with the source post visible); second = drops on you; third = the poll. Title and subtitle carry "try on," not "AI."

**SEO engine 1 — Brand new-arrivals tracker:** "[Brand] new arrivals this week — see them on you," refreshed weekly from the catalog diff, with house-model renders and live price/stock. The renders are the unique content; without them these pages are thin and will not rank.

**SEO engine 2 — Editorial utility:** "[Item] on 5 body types," "necklace length guide with photos," "earring size guide" — all backed by real renders on consented models.

**SEO engine 3 — Share-sheet landing pages:** "how to try on clothes from an Instagram screenshot," "virtual try-on from a photo" — low volume, but the intent is exactly the mechanic and it converts to install rather than to a pageview.

Honest expectation: SEO is a 6–12 month channel, and with dental gone there is no early win in it. Fund it lightly from month 1 because it compounds, but do not count on it for launch.

---

## 12. Email program: from user to weekly user

**Principles**
- Never send an email without a render of the recipient in it. The image is the hook; text-only fashion email is noise.
- Measure clicks, not opens (Apple Mail Privacy Protection inflates opens).
- One anchor send per week; everything else is triggered by something that happened.
- Hard cap 3 emails/week; push and email are coordinated so a drop never arrives on both within an hour.
- Send-time optimization per user after two weeks of data; default Friday 7 a.m. local (weekend shopping), test Thursday evening.

**Lifecycle**

| When | Trigger | Subject line (example) | Content | CTA |
|---|---|---|---|---|
| T+0 | First render complete | Your first 5 looks are ready | 5 renders, 1 sentence each, follow 3 more brands | See my looks |
| T+1 | No second session | 3 more we think you'll want (on you) | 3 renders + "follow brands to get their drops on you" | Follow brands |
| T+3 | Has ≥ 2 saves, no poll | Can't decide? Let them vote. | Their 2 best saved renders side by side, one-tap poll creation | Ask friends |
| T+7 | — | This week, on you | First weekly digest (below) | See my looks |
| Weekly (Fri) | Anchor | [Brand] dropped. Here it is on you. / This week, on you | 5 renders from followed brands, 1 recommended, 1 poll prompt, price drops on saved items, at most one unlock card (hand/wrist) | See my looks |
| Triggered | Drop from followed brand (cap 1/day) | Aritzia dropped 6 pieces — already on you | The drop, rendered | Try the drop |
| Triggered | Price drop on saved item | The dress you saved is 30% off | Render + old/new price | Buy |
| Triggered | Back in stock | It's back — in your size | Render | Buy |
| Triggered | Friend voted / poll closed | Priya picked #2. Final results inside. | Results, buy links | See results |
| Triggered | Category selected, slot missing (max 2) | Rings on your hand — one 10-second photo | 3 rings on house model, "see them on you" | Unlock rings |
| D14 inactive | Win-back | 3 new looks since you've been gone | 3 renders from followed brands | See my looks |
| D30 inactive | Last win-back | Want us to keep your photos? | 1 render; keep / delete my photos (respectful exit, also a BIPA retention signal) | Keep / Delete |

**Metrics:** click rate by send type · email → app open · email → purchase (attributed) · unsubscribe < 0.3% per send · **holdout test:** 10% of users receive no weekly digest; measure W4 and W8 retention lift. If the digest lifts W4 retention by < 3 points, the renders or the supply are the problem, not the email.

**Experiments in the first 90 days:** render hero vs product-photo hero (expect a large lift for render); Friday a.m. vs Thursday p.m.; 5 vs 10 renders; brand-name subject vs generic.

---

## 13. Monetization and unit economics

### 13.1 Revenue lines

| Line | When | Mechanics | Margin | Scale |
|---|---|---|---|---|
| Affiliate commissions | Day 1 | Tracked links via Rakuten/CJ/Impact/Awin/ShareASale + Skimlinks; blended ~3–12% by category (apparel lower, jewelry higher; many fast-fashion brands have no program — still ingest for engagement) | High, but small per user | Needs millions of WAU |
| Sponsored drops | Phase 3 | Brands pay CPM/CPA to place rendered drops into lookalike feeds; quality-gated, labeled | The real business | Personalized rendered impressions should clear far higher CPMs than display — to be proven |
| Designer tools | Phase 3 | Analytics and pre-order tooling subscription; marketplace commission on in-app checkout | Good | Depends on supply growth |
| Consumer premium (quota-based) | Phase 2 — now the only direct-payment line | Unlimited share/on-demand renders above the free daily quota, plus outfit builder and early drops. The share sheet is what makes this saleable: a quota on a feature the user actively reaches for is felt, and felt quotas convert. A quota on a feed she passively receives is just a worse feed. | Highest per paying user | Unknown — test at 3–5% conversion, $4.99–7.99/mo |

### 13.2 Unit economics per weekly-active user per month (assumptions — replace with measured values)

Assumptions: 38 renders viewed (30 feed + 8 share/on-demand) · feed click-out 6%, share click-out 25% · click → order 3% feed / 4% share · AOV $85 · blended commission 7%.

Revenue: feed 1.8 clicks → 0.054 orders → $0.32 commission. Share 2.0 clicks → 0.080 orders → **$0.48 commission**. Total **$0.80/WAU/month**.

Note what that says: **eight share renders now out-earn thirty feed renders.** If that holds when measured, it is an argument for spending onboarding on the share sheet before the feed, and for letting the feed be smaller and better rather than larger.

| Cost scenario (feed renders) | Cost/render | Feed render cost | Share render cost (8 @ $0.045 API) | Total contribution |
|---|---|---|---|---|
| All-API (Gemini 3.1 Flash Image, 512px) | $0.045 | $1.35 | $0.36 | **−$0.91** |
| API batch for feed | $0.034 | $1.02 | $0.36 | −$0.58 |
| **Split routing: self-hosted feed + API share** | $0.006 | $0.18 | $0.36 | **+$0.26** |

Conclusions:
1. Affiliate-only is underwater on API rendering for the feed. Self-hosting the bulk feed model is not an optimization; it is the business model. **Split routing is the whole game: cheap self-hosted renders for the feed, expensive API renders for share and on-demand, where intent justifies the cost.**
2. Even in the good case, affiliate contribution is ~$0.20–0.40 per WAU per month. This is a scale business with thin per-user economics, like every commerce-media business before it. At 1M WAU that is ~$3–5M/yr — a company, not an outcome.
3. The outcome case is sponsored drops: if the personalized rendered impression earns even $1–3 per US WAU per month (within range of social-app ARPU in the US), revenue per user rises 5–10x. That requires (a) scale, (b) a measurement story (Tejas's home turf), and (c) brands trusting the render quality with their product.
4. **Spinning dental out removed the bridge.** It was the only line with direct consumer payment and month-one margin, and nothing else in this plan replaces it before Phase 3. Be honest about the consequence: this product is now unprofitable-by-design until either sponsored drops work or a premium tier does. Two options, and you should pick one deliberately rather than drift: (a) accept it, keep the burn small, and race to sponsored drops on the strength of retention; (b) test a quota-based premium tier in Phase 2 at $4.99–7.99/mo — 4% conversion at $5.99 adds ~$0.24/WAU/month, roughly doubling contribution. Option (b) only exists because of the share sheet.
5. Paid acquisition: with affiliate-only payback over 12 months, do not scale paid until retention and the sponsored-drop roadmap are real.

---

## 14. Metrics framework

**North Star:** **Weekly Engaged Try-On Users (WETU)** — users who viewed ≥ 3 renders of themselves *and* took ≥ 1 action (save, share, poll, click-out) in the week. Views alone reward a broken feed.
**Money metric:** attributed GMV (and revenue).
**Quality metric:** "looks like me" score — auto-QA pass rate, user "doesn't look like me" report rate, and weekly human panel.

**Input metric tree**
- Acquisition: installs by channel · creator-attributed installs · poll recipient → install (k).
- Activation: open → item picked → capture completed → guest render shown, full quality (p50/p90 time) · **guest render → sign-up conversion** · guest-render screenshot rate without signup · capture first-attempt success · first-session renders ≥ 5 · first-session save/download/share · Guest Session → account attach success rate.
- Engagement: renders viewed/WAU · saves/WAU · polls/WAU · **share-initiated renders/WAU · % WAU using the share sheet · share-user vs. non-share-user retention delta** · follows/user · feed completion · "not for me" rate.
- Retention: D1/D7/D30 · W1→W4 · digest-holdout lift · push opt-in and CTR · email click.
- Monetization: click-out rate · CVR · GMV · revenue/WAU · render cost/WAU · contribution/WAU · share-render click-out vs. feed click-out · premium conversion (Phase 2).
- Supply: brands ingested · drops/week · % WAU with ≥ 1 followed-brand drop/week · designers onboarded · % products try-on-ready · time to first drop.

**Guardrails:** QA pass rate · render failure/latency · proportion-drift violations (must be zero shown) · safety blocks (minor/other-person uploads) · deletion SLA · complaints per 1k users · push and email unsubscribe · "not for me" rate.

**Initial targets (hypotheses to calibrate in the first 5k users)**

| Metric | Target |
|---|---|
| Open → guest render shown p50 | < 60 s |
| Guest render → sign-up conversion | ≥ 40% (hypothesis — now the number that validates the *whole* v0.4 design, not just deferring auth, since a low result means paying authenticated-tier render cost with nothing to show for most of it) |
| Guest-render screenshot rate without signup | To be measured in Phase 0 — no target yet; a leading indicator that the popup/gate isn't converting even when the render clearly worked |
| Capture first-attempt success | > 85% |
| Auto-QA pass rate | > 80% |
| "Doesn't look like me" reports | < 2% of renders viewed |
| D1 / D7 / D30 retention | 45% / 25% / 12% |
| W4 retention | ≥ 15% (gate for paid spend) |
| Follows by D7 | ≥ 5 (at risk post-v0.3 — onboarding no longer forces brand follows; see C6 and §0.7) |
| Polls per WAU per week | ≥ 0.3, pushing to 0.7 |
| Click-out rate | ≥ 6% of renders |
| Render cost per WAU per month | ≤ $0.25 by month 9 |
| % of WAU using share sheet by W2 | ≥ 35% |
| Share renders per WAU per week | ≥ 2 by W4 |
| URL extraction success | ≥ 85% |
| Screenshot extraction success | ≥ 60% |
| Share click-out rate | ≥ 20% of share renders |

One dashboard per CUJ (C1–C9, D1–D5), each showing its funnel, its quality guardrail, and its cost.

---

## 15. Trust, safety, privacy, legal

- **Consent precedes capture, not sign-up.** The v0.3 onboarding (§7 C1) lets a visitor try the product before creating an account, but the consent and age-gate screen still runs before the camera opens for every user, guest or signed in. A product decision to defer auth does not get to quietly defer a legal requirement that never depended on auth in the first place.
- **Biometric privacy is the top legal risk.** Illinois BIPA requires written consent, a public retention and destruction schedule, and prohibits profiting from biometric data in ways counsel must review against an affiliate model tied to face-matched renders; Texas and Washington have their own statutes; GDPR/UK treat face images processed for identity matching as special-category data (explicit consent, DPIA). Retailers have been sued under BIPA over virtual try-on features. Design consent, retention, and deletion in from day one; consider geofencing Illinois and Texas at launch until counsel signs off.
- **Retention:** base photos kept while the account is active; auto-delete after 12 months of inactivity with a warning email; renders and caches purge with photos. (Google Doppl defaulted to ~3 months — a reasonable benchmark.) **Guest Sessions are a separate, shorter retention class:** captured photos and the full-quality guest render are purged 24–48 h after capture if no account is ever created, since there is no account relationship yet to justify holding biometric data longer (§6, §7 C1). Because the v0.4 guest render is full quality rather than degraded, its in-pixel AI label matters more, not less, during that window — it's the only thing distinguishing a legitimate pre-signup preview from an exportable asset if a guest screenshots it.
- **Minors:** 18+ only; age estimation on the live selfie with a conservative threshold → block; reject uploads containing multiple people or an estimated minor; no exceptions, no appeals flow that re-uploads the image.
- **Own-photo verification:** the live selfie is face-matched to any gallery photo before it becomes a base image. This single mechanism prevents "try on my ex / a celebrity / a stranger" and is the difference between a try-on product and a deepfake tool.
- **Body integrity:** proportion guard in the QA gate; no "slim," "tone," or "enhance" features, ever; skin-tone fidelity checked per render.
- **Fairness gate:** the eval set is stratified by skin tone (Monk scale), body size, and age; a category does not launch until QA pass rates are within a few points across strata.
- **Content policy:** swimwear allowed; lingerie deferred; no nudity; designer uploads moderated for NSFW, counterfeits, and IP; DMCA agent registered.
- **AI labeling and provenance:** visible watermark on every shared image, C2PA/SynthID-style provenance metadata, "AI-generated" label in-app.
- **Sharing controls:** expiring links (7-day default), revocation, `noindex`, recipients see renders only, never originals; no download of base photos by anyone.
- **Brand and IP:** affiliate-feed images are licensed for promotion; rendering them onto users is derivative use — get counsel's view and build a brand opt-out before launch. Designers grant rights explicitly in terms.
- **Share-sheet ingress:** every inbound image is classified before any model touches it (illegal-content hash matching, adult content, minor detection), and is treated as a garment source only — never as an identity photo, never rendered onto a face other than the verified user's. Shared source images are retained only as long as extraction requires, then discarded; the extracted garment asset persists, the source photo of someone else's body does not.
- **Security:** photos encrypted at rest with per-user keys, renders in a separate store, access logged, model-training data limited to explicit opt-in and paid house models.

---

## 16. Architecture and model strategy

**Services:** client capture (on-device pose/quality, candidate photo scan) · identity service (slots, base-look generation, face-match, versioning) · catalog service (affiliate-feed ingestion, designer uploads, segmentation, readiness scoring, drop detection) · render orchestrator (per-category model router, priority queues, cache, QA judge) · feed ranker (candidate generation from follows and drops + taste model; budget-aware scoring) · social web (polls, votes, OG images) · notifications (push/email with render images) · affiliate and attribution · experimentation and analytics · privacy and deletion pipeline.

**Model strategy — eval first, then route**
1. **Build the render eval set before building the app:** ~500 consented base photos stratified by skin tone × body size × age × lighting × capture source (gallery vs guided), × ~200 catalog items across categories. Score identity preservation, garment fidelity, proportion preservation, artifact rate, and human "looks like me" ratings. Bake off 3–4 models per category. The category launch decision is a number, not an opinion.
2. **Route by intent and cost:** share-initiated and on-demand → best API model (intent pays for it, §9.6); bulk feed → self-hosted fine-tuned open VTON; makeup → mask-limited face-edit model; jewelry → composite-and-relight. Garment extraction from worn-garment source photos is a *separate* model from try-on rendering and needs its own eval set (§9.3) — do not assume the try-on bake-off winner is good at it.
3. **Cache and reuse** by (identity version, item); regenerate only when the base look changes.
4. **Improve on consented data only:** explicit opt-in users plus paid house models; no silent training on user photos. Track QA pass rate per model version as the release gate.

---

## 17. Risks, open questions, kill criteria

| Risk | Early signal | Mitigation / kill rule |
|---|---|---|
| Render quality on real photos is not good enough | Eval pass rate < 75% after 6 weeks of model work | Do not launch that category. Launch jewelry-only if apparel fails; it is the easier render. |
| The feed is not a habit | W4 retention < 10% at 5k users | Pivot to tool + social decision (link paste + polls) and drop the pre-render cost. |
| Economics never close | Render cost/WAU > $0.50 after self-hosting | Cut Tier B to 3 renders/open; move fully just-in-time. |
| Doji ships drops + polls first | Public launch of equivalent features | Differentiate on designers (supply), multi-category identity, and share-sheet extraction quality; speed matters more than polish on launch. |
| Supply gaps | < 60% of beachhead WAU get a followed-brand drop each week | Ingest more feeds; Skimlinks long tail; paid ingestion of brands without affiliate programs. |
| Brand backlash over unauthorized renders | Takedown requests | Quality gate, opt-out mechanism, and early brand partnerships (the first three are worth more than 50 later). |
| BIPA / biometric action | Counsel flags | Geofence until resolved; consent and retention done right from day one. |
| Screenshot extraction quality is unfixable | Phase 0 eval < 50% acceptable on in-the-wild photos | Ship URL-only, market it honestly as such, lean harder on the near-match fallback (which needs no extraction at all — image search to catalog, then render the catalog item). |
| Share sheet becomes an abuse ingress | Reports of others' photos, adult or illegal content | Classify every inbound image pre-model; garment-source-only rule; never render on a non-verified face; rate limits. |
| Founder conflict with current employer | — | Resolve the side-project and IP question before writing code; this sits adjacent to Google Shopping's try-on work. |

**Open questions to answer in Phase 0:** Does "see it on you" beat "AI try-on" in creative? What share of beachhead users already have a usable full-body photo in their camera roll? What is the real blended commission for the top-50 brands the beachhead follows? What fraction of shares are screenshots vs. URLs, and what is the real extraction rate on each? Does share-sheet usage in week 1 predict W4 retention strongly enough to justify teaching it during onboarding? Which open VTON model clears the fairness gate on plus-size bodies and darker skin tones?

---

## 18. Phased roadmap

**Phase 0 — Prove the render *and* the extraction (weeks 0–6).** Two eval sets, not one: (a) try-on rendering, 500 consented base photos × 200 catalog items; (b) **garment extraction from in-the-wild photos** — 300 real Instagram-style screenshots, scored for whether the isolated garment is usable. Supply ingestion of 200 brands; legal (biometric consent, IP); brand and design; recruit 30 indie designers. Exit gate: ≥ 75% QA pass on apparel and jewelry across all fairness strata, **and ≥ 60% usable extraction on screenshots** (below 50%, ship URL-only).

**Phase 1 — MVP (weeks 6–18).** iOS: C1 (including the v0.4 full-quality guest render → sign-in popup → sign-up flow), C2, **C3 including the share extension and screenshot path**, C4, C6, C7, C9. TestFlight with 500 users → 5,000. Creator seeding begins. Exit gate: open → guest render shown p50 < 60 s, guest render → sign-up conversion measured against the §14 hypothesis (this is now a cost gate, not just an activation metric — §10.1), W4 ≥ 15%, "doesn't look like me" < 2%, ≥ 35% of WAU using the share sheet, follows-by-D7 re-validated now that onboarding no longer forces them.

**Phase 2 — Habit and supply (weeks 18–30).** Makeup and rings; designer self-serve (D1–D4); email program with holdout; Closet alerts; **Android with `ACTION_SEND`**; near-match fallback; premium quota test; Chrome desktop extension *if* a desktop cohort has shown up in the data. Exit gate: ≥ 60% of WAU receive a followed-brand drop weekly; render cost/WAU trending to ≤ $0.25.

**Phase 3 — Business (weeks 30+).** Sponsored drops with measurement; wardrobe ingestion and "complete the look"; size-prediction partner; shoes, bags, sunglasses; iOS Safari extension; TikTok/Reels frame extraction; international (GDPR-ready).

---

## Appendix A — Copy library

**Push (always with the render as the image):**
- Aritzia dropped 6 pieces. Here they are on you.
- The dress you saved is 30% off.
- Priya voted 👗 #2. See the results.
- Your rings are ready — one 10-second photo.
- 3 new looks for the weekend, on you.

**Email subject lines:** Your first 5 looks are ready · This week, on you · [Brand] dropped. Already on you. · Can't decide? Let them vote. · It's back — in your size · 3 new looks since you've been gone · Want us to keep your photos?

## Appendix B — Capture requirements matrix

| Slot | Used for | Requirements | Source options |
|---|---|---|---|
| Face-Front (live) | Identity verification, earrings, necklaces, makeup | Front, neutral, even light, hair back, no heavy makeup | Live only |
| FullBody-Front | Apparel | Front, neutral pose, fitted clothes, full figure visible, single person, plain background preferred | Gallery (face-matched) or guided camera |
| Face-3/4 | Makeup (Phase 2) | 3/4 view, same conditions as Face-Front | Live |
| Hand | Rings, bracelets | Back of hand, fingers relaxed, even light | Guided camera |
| Wrist | Watches, bracelets | Wrist and forearm | Guided camera |

## Appendix C — Supply notes
- Affiliate networks with product feeds: Rakuten, CJ, Impact, Awin, ShareASale; Skimlinks/Sovrn for long-tail coverage. Approximate commission ranges: apparel 3–10%, jewelry 5–12%, beauty 5–10% (varies by program; verify per brand).
- Brands without affiliate programs (e.g., some fast-fashion majors) should still be ingested for engagement; monetize via "find similar" into commissioned catalog.
- Seed designers: Shopify-based independents with active Instagram followings, occasion-wear boutiques, and jewelry makers — all have try-on-ready imagery and real drop cadences.
