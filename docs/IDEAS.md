# Ideas log

Directions the owner is weighing, written down so they are not lost. Nothing here is decided or
built unless it says so. Decisions go in `docs/PRD.md` §22.1; this file is the thinking before
them. Newest entry first.

## 2026-10-12: where Trailroom goes next

**Why this came up.** A try-on costs about $0.15 in renders (four poses at about $0.0375). A
shopper paying $10 a month could cost more than they pay, and the demo catalogue is twelve
invented pieces, so nobody can try on something they actually want to buy. Both ideas below are
answers to that.

### Idea 1: plugins for store platforms, with "Sign in with ChatGPT"

Build a try-on plugin for the commerce platforms (Shopify first, then others) and sell it to
store owners for a few hundred dollars a month. The shopper signs in with their own ChatGPT
account, so the model cost falls on the shopper's plan, not on the store or on Trailroom.

- **For it.** The store gets the benefit (more sales, fewer returns) and pays a flat fee. Stores
  already buy apps this way. Real merchandise, real product photos.
- **Against it.** "Sign in with ChatGPT" launched with sixteen named partners, mostly developer
  tools. Not confirmed: that any developer can use it, or that it covers image generation. Only
  paying ChatGPT subscribers could use it, and they would have to sign in mid-shopping. Try-on
  apps on Shopify are numerous and mostly priced at $20 to $200 a month.
- **What would have to be true.** OpenAI opens the programme to this use, or the store simply
  pays for usage (at $0.04 an image that is affordable without ChatGPT at all).
- **Next step if pursued.** Ask OpenAI about access. Separately, test how the pipeline does on
  real store product photos.

### Idea 2: shoppers pay $20 a month for 100 try-ons, on any piece they find

Three ways in, all feeding the same thing: try on a garment that is not in our catalogue.

**2a. A Chrome extension.** On popular apparel sites it shows a gentle nudge on product pages.
The person clicks, the extension collects the garments on the page, renders in the background,
and tells them when the renders are ready, with a link and an email or push notification
carrying the images.

- For it: meets people at the moment they are deciding, on the real product, with no deal needed
  with any store.
- Against it: desktop Chrome only, and most clothes shopping happens on phones. Each site needs
  its own handling and breaks when the site changes. Store review and broad page permissions put
  some people off. Email and push are not built.

**2b. Share a screenshot from Instagram.** Screenshot something, share it to the Trailroom app,
get a render.

- For it: the most natural gesture, and it is where people discover clothes.
- Against it: receiving a share needs a native app on iPhone (a web app cannot be a share target
  on iOS). A screenshot is cluttered: buttons, captions, another person wearing the piece. The
  PRD had already deferred this (§9).

**2c. Paste a link.** Copy a product URL, paste it in the app, try it on.

- For it: the easiest to build. Works on phone and desktop with nothing to install.
- Against it: copy and paste is friction. Many large retailers block automated page fetches, so
  it will fail on some sites and needs a fallback. Fetching arbitrary URLs from the server must
  be locked down (no internal addresses, size and time limits).

### Recommendation: build 2c first, as "bring your own piece"

Build one screen: **paste a link, or add a screenshot or photo of the piece.** The link path
reads the product page and offers its photos to choose from. The image path is the fallback when
a site blocks us, and it is also most of 2b without the share sheet.

Why this first:

1. **All three flows need the same engine,** and it does not exist yet: take any picture of a
   garment (a clean product shot, a model wearing it, a cluttered screenshot) and render it on
   the person. The extension and the share sheet are only different doors into it. Building 2c
   builds the engine.
2. **It tests the two things that decide everything, in days.** Does the render hold up on real
   product photos from real stores? And will anyone pay $20? Neither needs an extension or a
   native app to find out.
3. **It fixes the product's biggest gap today:** people can only try on twelve invented pieces.
4. **It is also what Idea 1 needs.** A store plugin has the same problem of arbitrary product
   photos, so nothing is wasted if the merchant route wins.

Then, in order: **2a** if the link flow shows people using it from desktop shopping sites;
**2b** only when a native app is justified (an installed web app can receive shares on Android,
which is a cheap partial version); **Idea 1** in parallel as a question to OpenAI, not a build.

### What must be settled alongside it

- **The price only works with a cheaper try-on.** $20 for 100 four-pose try-ons leaves about 15%
  if all are used. Rendering the Front pose first and the other three only on a tap brings the
  cost to about $0.07 a try-on and the margin to about 60%. The Lite model saves about 8% more
  and is faster, quality untested. Batch pricing is half but results take hours, so it suits
  only renders nobody is waiting for.
- **A paywall to test payment.** A few free try-ons, then $20 for 100. Not built; no payment
  code exists.
- **Whose images.** Rendering a retailer's product photo for one person's private preview is
  different from republishing it, but it is a question for a lawyer, as is fetching pages
  against a site's terms.
- **Quality on unknown photos.** The quality gate has a face check now and nothing yet for
  whether the garment is right. Flat product shots and busy screenshots will be harder than the
  catalogue's clean photos. This is the real risk and the first thing to measure.

### Also considered this week (not pursued yet)

- **Cosmetic dentistry and clinics:** practices show a patient a preview of a treatment. High
  price per customer; health-privacy rules, outcome claims and sales effort are the cost.
- **Home exteriors for contractors (roofing, siding, paint):** the highest margin and no face or
  health data; means leaving fashion. Reach by integrations, Facebook and a short demo call, not
  field sales.
- **Bridal and made-to-order occasion wear:** closest to what is built; fine embroidery is where
  image models are weakest.
