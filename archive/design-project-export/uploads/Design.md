# Design.md — Trailroom

Design system for **trailroom.ai**. Read this before writing any UI. Derive every color, size, spacing, and motion value from §11. Do not invent tokens.

**North star:** the feeling of hanging out at a mall with friends, trying on outfits. Every tradeoff in this file is made in service of that.

---

## 1. Three rules

Everything below is downstream of these. When a decision is unclear, resolve it against these in order.

### Rule 1 — The interface must be colorless enough that a garment's color reads true

The user is deciding whether a rust dress works on them. A saturated surround shifts perceived hue and saturation of everything sitting on it. This is color management, not minimalism — it's why SSENSE, Net-a-Porter, and Zara are all near-monochrome.

- Try-on imagery sits on `--canvas` (white) or `--ink` (near-black). Never on a tint, never on a gradient.
- The primary button is near-black, not a brand color.
- The accent is for **state and identity** — focus, selection, links, the logo. Never a large fill next to a garment.
- No gradient anywhere in the product. Not in heroes, not in headings, not in loading states.

### Rule 2 — Place, layer, interrupt

A mall is continuous and peripheral. You never dismiss a friend to look at a jacket. So:

| Pattern | Definition | Use it? |
|---|---|---|
| **Place** | Owns the screen, you routed to it, back works | ✅ Yes — capture, result, item detail |
| **Layer** | Floats over content, blocks it, must be dismissed | ❌ No — replace with inline expansion or a push panel |
| **Interrupt** | Appears because the *system* decided, not because the user tapped | ❌ No — replace with the rack dock filling in place |

Two exceptions, both deliberate: the **OS share sheet** (system-owned, already trusted) and the **OS photo picker** (same). Push notification is allowed only when the app is backgrounded — the user already left.

### Rule 3 — Low stakes

At a mall you try the ridiculous thing because nothing is recorded. Rejecting is half the fun. So: discarding is a satisfying gesture, not a hidden state; generated try-ons are ephemeral by default; nothing the user tries is broadcast without an explicit act.

---

## 2. The v1 flow

Single-player. Polls are the only social surface. Curation stands in for "a friend picks something off the rack for you."

```
1. CATALOG        primary action on every card is "Try it on", not "Buy"
                  ~20% of the feed is explicitly labeled "Outside your usual"

2. CAPTURE        only if we lack the shots this item needs
                  upload from camera roll (default) or capture with camera
                  validate before generation, with a specific reason on reject

3. GENERATE       full quality always — watermarked if signed out
                  never a degraded render (see §2.1)

4. RESULT         Add another · Share / poll · Save · Buy

5. SIGN UP        triggered by save, poll, buy, or try-on #2
                  never by image quality

6. RETURNING      additions queue asynchronously into the rack dock,
                  which fills in place — no popup, no interrupt
```

### 2.1 Why we watermark instead of degrading

A degraded render of someone's own body reads as *"I look bad"* or *"this product doesn't work"* — the user can't tell which, and either one loses them. It also destroys our only demo. Gate on **quantity** (one free try-on per device) and on **actions that obviously need an account**, never on quality.

### 2.2 Capture is item-aware, not one-time

A ring needs hands. A dress needs full body. The rule is *capture the shots this item needs that we don't already have*, which means capture can recur months later. Do not build it as a one-time onboarding gate.

### 2.3 Polls need two options

"Which one?" gets a reply. "Do you like this?" gets left on read. Batch try-on is therefore a prerequisite for the poll loop, not a v2 nicety — the armful mechanic and the growth loop are the same feature. **The recipient must be able to vote without installing.**

---

## 3. Color

Material Design palette. Neutral ramp is Material **Grey** (not Blue Grey) because true neutral is what Rule 1 requires.

### Neutrals — the whole system

| Token | Material | Hex | Use | Contrast on white |
|---|---|---|---|---|
| `--ink` | Grey 900 | `#212121` | Headings, primary button, primary icons, dark surfaces | 16.1:1 |
| `--ink-800` | Grey 800 | `#424242` | Pressed primary button, strong labels | 10.4:1 |
| `--ink-700` | Grey 700 | `#616161` | **Body copy.** Default paragraph color | 6.2:1 ✓ |
| `--ink-600` | Grey 600 | `#757575` | Meta, timestamps, secondary price | 4.6:1 ✓ |
| `--ink-500` | Grey 500 | `#9E9E9E` | Placeholders, disabled. **2.7:1 — decorative only** | ✗ |
| `--ink-400` | Grey 400 | `#BDBDBD` | Skeleton base, empty-state icons | ✗ |
| `--line` | Grey 300 | `#E0E0E0` | Card borders, dividers, input borders |
| `--line-soft` | Grey 200 | `#EEEEEE` | Hairlines inside cards, list separators |
| `--surface` | Grey 100 | `#F5F5F5` | Chrome surface — never behind try-on media |
| `--surface-alt` | Grey 50 | `#FAFAFA` | Alternating rows, sheet backgrounds |
| `--canvas` | — | `#FFFFFF` | Page background; the only surface behind try-on media |

### Accent

| Token | Material | Hex | Use | Contrast |
|---|---|---|---|---|
| `--accent` | Teal 700 | `#00796B` | Focus ring, selected state, links, logo, active tab | 5.3:1 ✓ |
| `--accent-dark` | Teal 800 | `#00695C` | Pressed accent | 7.0:1 |
| `--accent-tint` | Teal 50 | `#E0F2F1` | Selected chip fill, active row background |

Teal 700 is the accent because it is distinctly *not* the default AI purple, it is cool enough not to fight warm garments, and it clears AA on white for text. It appears on **state**, never as a large surface next to a garment.

### Semantic

| Token | Material | Hex | Bg | Use |
|---|---|---|---|---|
| `--success` | Green 800 | `#2E7D32` | `#E8F5E9` | Saved, order placed, photo deleted |
| `--danger` | Red 700 | `#D32F2F` | `#FFEBEE` | Generation failed, out of stock, destructive confirm |
| `--warning` | Deep Orange 900 | `#BF360C` | `#FFF8E1` | Photo needs retaking, low-quality source |
| `--info` | Blue 700 | `#1976D2` | `#E3F2FD` | Privacy notices, "this is a preview, not a fitting" |

All four clear 4.5:1 on white.

### Dark surfaces

Full-bleed result viewer and camera flow only. Background `--ink`, text `#FFFFFF`, body `#BDBDBD`, hairlines `rgba(255,255,255,.12)`. Nothing else in the product goes dark.

---

## 4. Typography

**Inter.** SIL Open Font License, variable, neutral neo-grotesque. Install from the official source — the Google Fonts build is outdated and ships no italics.

```html
<link rel="preconnect" href="https://rsms.me/">
<link rel="stylesheet" href="https://rsms.me/inter/inter.css">
```

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
```

Two rules do most of the work: **negative tracking at display sizes** and **weight 500 max on headings**. Weight 700 headings are the fastest way to look generic. Do not enable `cv11` (single-storey `a`) — it reads as a Tailwind-site tell.

### Scale — mobile first

| Role | Mobile | Desktop | Weight | Tracking | Color |
|---|---|---|---|---|---|
| Display | 32 / 36 | 48 / 52 | 500 | `-0.02em` | `--ink` |
| H1 | 24 / 30 | 32 / 38 | 500 | `-0.02em` | `--ink` |
| H2 | 20 / 26 | 24 / 32 | 500 | `-0.01em` | `--ink` |
| H3 | 17 / 24 | 18 / 26 | 600 | `-0.01em` | `--ink` |
| Body | 16 / 24 | 16 / 26 | 400 | `0` | `--ink-700` |
| Body small | 14 / 20 | 14 / 22 | 400 | `0` | `--ink-700` |
| Caption | 12 / 16 | 12 / 18 | 400 | `0` | `--ink-600` |
| Label | 11 / 14 | 11 / 14 | 600 | `+0.08em` uppercase | `--ink-600` |
| Brand name | 14 / 18 | 14 / 20 | 600 | `+0.01em` | `--ink-800` |
| Price | 16 / 20 | 16 / 22 | 500 | `0`, `tnum` | `--ink` |

- Prices and any number in a column get `font-variant-numeric: tabular-nums`.
- Brand names use the Brand style, never Body. On a 40-item feed, brand recognition is a scanning task.
- Max prose measure: `min(60ch, 620px)`.
- Never bold body copy for emphasis — switch to `--ink` at 500.

---

## 5. Space & layout

8px base unit. Every margin, padding, and gap is a multiple.

```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
```

| Token | Mobile | Desktop |
|---|---|---|
| `--gutter` | `16px` | `32px` |
| `--container` | `100%` | `1120px` |
| `--section-y` | `40px` | `80px` |
| `--dock-h` | `72px` + safe area | `80px` |

**The atomic unit is a 3:4 portrait frame.** Try-on results, catalog cards, rack items, saved items — all 3:4. Flat-lay product shots are 1:1. **Never mix ratios inside one scroll container** — a ragged grid advertises inconsistent renders.

**Feed grid:** 2-up mobile (12px gap), 3-up ≥768px, 4-up ≥1200px (20px gap). The first result of a session is full-width 3:4 — the magic moment gets the whole screen once.

**Rack dock:** persistent bottom dock, `--dock-h`, `--canvas` with a `--line-soft` top hairline. Always visible, expands to a shelf on tap, **never covers content** — the page insets by `--dock-h`. This is where async generations land.

---

## 6. Radius, borders, elevation

| Token | Value | Applies to |
|---|---|---|
| `--radius-sm` | `8px` | Chips, badges, inputs, thumbnails |
| `--radius-md` | `12px` | Secondary buttons, small cards, toasts |
| `--radius-lg` | `16px` | Try-on cards, catalog cards, sheets |
| `--radius-xl` | `24px` | Rack shelf, full-bleed media containers |
| `--radius-pill` | `9999px` | Primary CTA, filter chips, avatars |

Borders are `1px solid var(--line)`. Never 2px, never dark. **A card containing try-on media gets no border and no tint** — the photograph provides its own edge.

Elevation follows Material's structure at reduced opacity; full-strength Material shadows go muddy next to photography.

```css
--elev-1: 0 1px 2px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06);
--elev-2: 0 2px 4px rgba(0,0,0,.08), 0 3px 8px rgba(0,0,0,.06);
--elev-4: 0 4px 8px rgba(0,0,0,.10), 0 8px 16px rgba(0,0,0,.08);
--elev-8: 0 8px 16px rgba(0,0,0,.12), 0 16px 32px rgba(0,0,0,.10);
```

Elevation maps to importance, not nesting depth. `--elev-8` appears once per screen at most. Catalog cards get `--elev-1` or nothing.

---

## 7. Motion

| Token | Value |
|---|---|
| `--ease` | `cubic-bezier(.2,0,0,1)` |
| `--dur-fast` | `150ms` |
| `--dur` | `250ms` |
| `--dur-slow` | `400ms` |

- **Tap feedback:** `scale(.98)` over `--dur-fast`.
- **Card entry:** opacity `0→1` + `translateY(8px→0)` over `--dur-slow`, 50ms stagger, once per card.
- **Catalog → result:** shared-element transition on the garment image. This is what replaces a modal — it makes the result a *place* you travelled to, not a layer that appeared.
- **Result reveal:** crossfade at `scale(1.02)→1` over `--dur-slow`. The payoff frame gets the longest duration in the system.
- **Rack dock fill:** the new card slides in from the right over `--dur`. No badge bounce, no toast.
- `prefers-reduced-motion: reduce` drops all transforms, keeps opacity.

---

## 8. Components

### Catalog card

The primary action is **Try it on**, not Buy. If the card sells buying, we're a store with a filter attached.

```
┌─────────────────┐
│                 │  3:4 garment image, --radius-lg, no border
│                 │
│                 │
├─────────────────┤
│ BRAND           │  Label style
│ Item name       │  Body small, --ink-700, 1 line, truncate
│ $128            │  Price style
│ ┌─────────────┐ │
│ │ Try it on   │ │  full-width pill, --ink fill, white text
│ └─────────────┘ │
└─────────────────┘
```

Save (heart) is a 44×44 tap target top-right of the image, white icon with `drop-shadow(0 1px 2px rgba(0,0,0,.35))` so it survives dark and light garments. No solid chips on top of the image.

**Curation shelves** carry a stated reason in Label style above the row: `BECAUSE YOU SAVED THE LINEN SHIRT` / `OUTSIDE YOUR USUAL`. A recommender that explains itself is the closest single-player thing we have to a friend handing you something.

### Capture screen (place, full screen)

```
Before the camera opens — one screen, three lines:
  "We need one full-body photo to try things on you."
  "Bright light, plain background, arms slightly away from your body."
  [ Choose from photos ]  ← primary, --ink pill
  [ Take a photo ]        ← secondary, outline
```

Camera roll is the **default** path; capture is the alternate. The best full-body photo of the user already exists and they already like how they look in it.

Live capture rules, copied from Apple Camera / Warby Parker:
- Silhouette guide overlay in `rgba(255,255,255,.6)`, 2px, that the user fits themselves into.
- **One correction at a time**, never a checklist. "Step back" → then "More light" → then capture.
- **Auto-capture** with a 3-2-1 count when conditions are met. No shutter button — the user never performs a photography task.
- Audio cues, since at full-body distance the screen is unreadable.
- Immediate accept / retake with the guide still visible.

Validation runs **before** generation, on both paths, and rejects with one specific fixable reason: `That photo is cropped below the knee — we need your full body.` Never `Invalid photo.`

Privacy is stated on this screen, in mechanism terms, at the point of use: what we keep, for how long, who sees it.

### Generating state

Not a spinner. The card is already in place at 3:4 with the garment thumbnail visible, and a **neutral shimmer** passes over the placeholder.

```css
.skeleton {
  background: linear-gradient(90deg,
    var(--ink-400) 0%, #D5D5D5 40%, var(--ink-400) 80%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
```

Grey, not colored. A colored shimmer next to a garment breaks Rule 1 and reads as slop.

- One line of honest status. If p50 latency is known, use a determinate bar in `--ink`.
- **Do not invent pipeline steps** ("Analyzing your style…") that don't map to real stages. Users clock it, and it costs more trust than the wait does.
- On failure: resolve to a `--danger` state with exactly one action — retry, or use a different photo. Never a dead end.

**Perceived latency is the binding constraint on this entire product.** It outranks every other decision in this file.

### Result screen (place)

Full-bleed 3:4 on `--canvas`. Actions in a bottom bar, in this order:

| Action | Weight | Note |
|---|---|---|
| **Add another** | Primary pill, `--ink` | Keeps the armful going; feeds the poll loop |
| **Ask friends** | Secondary outline | Opens OS share sheet — the one allowed system modal |
| **Save** | Icon | Signup trigger |
| **Buy** | Text link, `--accent` | Deliberately quietest. We are not a store first |

Expectation-setting sits directly under the image in Caption style: *a preview, not a fitting — it can't tell you size or fit.* Honest, defuses the worst reviews, costs nothing.

**Share is primary over download.** A download leaks the image into the camera roll with no attribution and no return path. Download exists post-signup as a convenience.

### Poll

Two or three 3:4 options side by side, each with a pill vote button beneath. Results render as an `--ink` bar filling from the left over `--dur-slow`, percentage in tabular numerals. No confetti, no winner crown — this is a decision aid, not a game.

The shared artifact must be **votable without installing**: web view, no auth, one tap, renders in an iMessage preview. If voting requires an install, the loop is dead.

### Buttons

```css
.btn-primary {
  height: 48px; padding: 0 24px;
  background: var(--ink); color: #fff;
  border-radius: var(--radius-pill);
  font: 500 16px/1 var(--font-sans);
  box-shadow: var(--elev-1);
  transition: transform var(--dur-fast) var(--ease),
              background var(--dur-fast) var(--ease);
}
.btn-primary:active   { transform: scale(.98); background: var(--ink-800); }
.btn-primary:disabled { background: var(--ink-500); box-shadow: none; }
```

Secondary: `--canvas` fill, `1px solid var(--line)`, `--ink` text. Tertiary: bare `--accent` text at 500 with a trailing `→`.

**One filled button per screen.** "Try it on" and "Save" are not peers.

### Input

```css
.input {
  height: 48px; padding: 0 16px;
  border: 1px solid var(--line); border-radius: var(--radius-md);
  font-size: 16px;                    /* 16px min — smaller triggers iOS zoom */
  color: var(--ink); background: var(--canvas);
}
.input::placeholder { color: var(--ink-500); }
.input:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0,121,107,.22);
}
```

### Filter chip

32px, `--radius-pill`, `--line` border, `--ink-700` text at 14/500. Selected: `--accent-tint` fill, `--accent` border and text.

### Trust bar

Sticky under the header, 40px, `--surface`, `--line-soft` bottom hairline. 16px icon + 13px `--ink-700` text, 20px gap, horizontally scrollable on mobile. Info icon opens a **push panel**, not a modal.

Claims must be verifiable in the panel. State the mechanism, not the vibe: *your reference photo is kept until you delete it; generated try-ons expire in 24 hours.* Split retention this way — a blanket "deleted in 24h" would force users to re-upload constantly and kill the persistent-model benefit.

---

## 9. Copy

- **Sentence case everywhere.** Headings, buttons, nav, labels.
- **Buttons name the outcome:** `Try it on`, `Ask friends`, `Save`, `Delete my photo`. Not `Submit`, `Learn more`, `Continue`.
- **Verb consistency:** the button that says `Save` produces a toast that says `Saved`.
- **Errors say what happened and what to do**, in one sentence, no apology.
- **Empty states are an invitation** — the saved-items empty state contains a live item, not a shrug.
- **Privacy copy states the mechanism**, never the sentiment.

### Body-image guardrails — hard product constraints, not tone preferences

- Never "before / after." There is no "before."
- No scoring, rating, or ranking of how something looks on the user.
- No language about flattering, slimming, hiding, or fixing anything.
- Sizing guidance is functional and neutral; measurements are never surfaced as judgments.
- The user's face or body is never used as marketing material without a separate explicit opt-in.
- **Critique the object, never the subject.** If we ever ship feedback: *"the shoulder seam sits wide — size down"* is fine; *"this isn't flattering"* is not. The grammatical subject is always the garment.

---

## 10. Anti-patterns

| Don't | Why |
|---|---|
| Any gradient, anywhere | Rule 1. A colored shimmer is the most common slop tell |
| Purple / violet accent | Default AI palette; we use Teal 700 |
| Colored or tinted background behind try-on media | Contaminates garment color |
| Modal or dialog | Rule 2 — use a place, a push panel, or inline expansion |
| Popup when generation completes | Interrupt. The rack dock fills in place |
| Degraded render as a signup gate | Reads as "I look bad." Gate on count, not quality |
| Generic spinner during generation | The wait is the product's most emotional moment |
| Fake progress steps | Detectable; costs more trust than the wait |
| Mixed aspect ratios in one scroll container | Advertises inconsistent renders |
| Font-weight 700+ headings | Generic |
| `Buy` as the card's primary action | Makes us a store with a filter attached |
| Download as the primary result action | Leaks the image with no return path |
| Borders around try-on cards | Competes with the garment silhouette |
| Tap targets under 44px | Phone-first product |
| Poll with one option | "Do you like this?" gets left on read |

---

## 11. Tokens

```css
:root {
  /* neutrals — Material Grey */
  --ink:#212121; --ink-800:#424242; --ink-700:#616161;
  --ink-600:#757575; --ink-500:#9E9E9E; --ink-400:#BDBDBD;
  --line:#E0E0E0; --line-soft:#EEEEEE;
  --surface:#F5F5F5; --surface-alt:#FAFAFA; --canvas:#FFFFFF;

  /* accent — Material Teal */
  --accent:#00796B; --accent-dark:#00695C; --accent-tint:#E0F2F1;

  /* semantic — Material */
  --success:#2E7D32; --success-bg:#E8F5E9;
  --danger:#D32F2F;  --danger-bg:#FFEBEE;
  --warning:#BF360C; --warning-bg:#FFF8E1;
  --info:#1976D2;    --info-bg:#E3F2FD;

  /* type */
  --font-sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;

  /* space */
  --gutter:16px; --container:100%; --section-y:40px; --dock-h:72px;

  /* radius */
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
  --radius-xl:24px; --radius-pill:9999px;

  /* elevation — Material structure, reduced opacity */
  --elev-1:0 1px 2px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06);
  --elev-2:0 2px 4px rgba(0,0,0,.08),0 3px 8px rgba(0,0,0,.06);
  --elev-4:0 4px 8px rgba(0,0,0,.10),0 8px 16px rgba(0,0,0,.08);
  --elev-8:0 8px 16px rgba(0,0,0,.12),0 16px 32px rgba(0,0,0,.10);

  /* motion */
  --ease:cubic-bezier(.2,0,0,1);
  --dur-fast:150ms; --dur:250ms; --dur-slow:400ms;
}

@media (min-width:768px){
  :root{ --gutter:32px; --container:1120px; --section-y:80px; --dock-h:80px; }
}
```

### Tailwind

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        ink:     { DEFAULT:'#212121', 800:'#424242', 700:'#616161',
                   600:'#757575', 500:'#9E9E9E', 400:'#BDBDBD' },
        line:    { DEFAULT:'#E0E0E0', soft:'#EEEEEE' },
        surface: { DEFAULT:'#F5F5F5', alt:'#FAFAFA' },
        canvas:  '#FFFFFF',
        accent:  { DEFAULT:'#00796B', dark:'#00695C', tint:'#E0F2F1' },
        success: { DEFAULT:'#2E7D32', bg:'#E8F5E9' },
        danger:  { DEFAULT:'#D32F2F', bg:'#FFEBEE' },
        warning: { DEFAULT:'#BF360C', bg:'#FFF8E1' },
        info:    { DEFAULT:'#1976D2', bg:'#E3F2FD' },
      },
      fontFamily: { sans:['Inter','system-ui','sans-serif'] },
      borderRadius: { sm:'8px', md:'12px', lg:'16px', xl:'24px' },
      aspectRatio: { tryon:'3 / 4' },
      maxWidth: { container:'1120px' },
      boxShadow: {
        1:'0 1px 2px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06)',
        2:'0 2px 4px rgba(0,0,0,.08),0 3px 8px rgba(0,0,0,.06)',
        4:'0 4px 8px rgba(0,0,0,.10),0 8px 16px rgba(0,0,0,.08)',
        8:'0 8px 16px rgba(0,0,0,.12),0 16px 32px rgba(0,0,0,.10)',
      },
      transitionTimingFunction: { brand:'cubic-bezier(.2,0,0,1)' },
    },
  },
}
```

---

## 12. Quality floor

- Phone-first: works at 360px. Test at 360, 390, 430 before any desktop width.
- **44×44 minimum tap target.** Save hearts and close buttons are the usual violators.
- Inputs at 16px minimum font-size, or iOS zooms on focus.
- Body text ≥ 4.5:1. `--ink-700` and `--ink-600` pass; `--ink-500` and below do not — decorative and disabled only.
- Visible keyboard focus everywhere — the 3px accent halo, never bare `outline: none`.
- `prefers-reduced-motion` respected, including the shimmer.
- Real `alt` text on every image: `"Black wool coat by [brand], shown on you"`. Never a filename.
- Try-on images ship as AVIF/WebP with explicit `width`/`height` or `aspect-ratio` so the feed never shifts.
- Skeletons use the exact final aspect ratio. Zero layout shift between skeleton and image.
- **Safety filters at upload**, day one: block suggestive images and public-figure images. Camera-roll upload means someone will try.

---

## 13. Open decisions

Tracked here so they don't get silently resolved by whoever writes the code first.

- **Capture mode for full body.** Deferred — v1 accepts camera-roll upload or a plain camera capture, and we revisit once we know how much occlusion and framing variance the model tolerates. That ML answer, not design, decides whether mirror mode is viable.
- **Watermark design.** Needs to be legible in a screenshot without damaging the render. It is a virality asset, not just a gate.
- **What makes two people open Trailroom at once.** Unanswered. Until it is, polls are async-only and the social layer stays thin — which is the correct v1 scope, but it is a deferred question, not a solved one.
- **Curation cold start.** Session one has no behavioral data, so "personalized for you" is a claim the user can falsify in three swipes. First session runs on stated onboarding preferences and what's moving, and the shelf labels should say so.
