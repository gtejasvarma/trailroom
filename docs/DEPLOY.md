# Deploy runbook — Trailroom on Firebase

> **Where this stands (2026-10-09).** The site is deployed: App Hosting backend `trailroom`, root
> directory `apps/web`, live branch `main`, project `virtual-tryon-tejas`, behind the password gate, at
> `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`. **Phases A, B and C (V0) are what is
> live** (commits `a5b7918`, `f3ab209`, `2f11325`). Pushes to `main` have not been triggering rollouts,
> so each one is started by hand:
>
> ```bash
> firebase apphosting:rollouts:create trailroom --git-branch main --project virtual-tryon-tejas --force
> ```
>
> **Done for this project:** steps 0 to 11 (2026-10-07 and 2026-10-08), the Phase A rules redeploy for the
> follows collection, and the catalogue images in `gs://<bucket>/catalog/` (the 31 files from
> `packages/catalog/assets/prototype/`). **Not yet observed: a successful render on the deployed site.**
> The first real run was refused by the image model (see the incident note below); the key has since been
> replaced, and seeing one real render is the first item of the smoke test in step 12. The garment-image
> step is repeated whenever the catalogue's images change.
>
> **When a try-on fails on the deployed site, run `runs/diag.sh` first.** It is local and git-ignored; it
> prints the latest job's per-pose reasons, the server-side error detail and the spend log.

### Incident note — 2026-10-08: the first real run was refused with HTTP 402

On 2026-10-08 every image-model call from the deployed app was refused with HTTP 402. The API key in
use was not on an account with billing for the image model. The Cloud Workflow ran correctly from
start to finish, so the first execution of the workflow is no longer an open question; what failed was
the model call. The key was replaced the same day with one verified by a single real image call; the
secret is `GEMINI_API_KEY` version 2. Phase C changed three things because of it: a set whose every
attempt failed on the provider's side now fails as `internal` ("something went wrong on our side"),
not as a quality failure; a provider rejection with a 4xx status settles at zero against the daily
cap, while timeouts and 5xx still settle at the estimate; and each failed model call is logged once
with its status (ADR 0004, 2026-10-08 amendment). As of 2026-10-09 no successful render has been
observed on the deployed site.

### Rolling out, and changing a secret

- **Rollouts are started by hand** (command above). A push alone does not deploy.
- **Changing a secret needs a rollout.** The running revision keeps the secret version it started
  with, so a new value does nothing until the next rollout:

```bash
firebase apphosting:secrets:set <NAME> --project virtual-tryon-tejas --data-file <path to a file holding the value>
firebase apphosting:rollouts:create trailroom --git-branch main --project virtual-tryon-tejas --force
```

### What went wrong on the first deploy, and the fixes

- **(a) `npm ci` failed in the build.** `package-lock.json` had been generated on macOS with
  `node_modules` present, so it lacked other platforms' optional packages. Regenerate it in a clean
  checkout with no `node_modules`, and check with `npm ci --dry-run --os=linux --cpu=x64`.
- **(b) The backend's root directory was `/` instead of `apps/web`.** Set it to `apps/web`.
- **(c) The backend had not been granted access to the three secrets.** Run
  `firebase apphosting:secrets:grantaccess <NAME> --backend trailroom` for `GEMINI_API_KEY`,
  `GATE_PASSWORD` and `GATE_COOKIE_SECRET`.
- **(d) After sign-in the password gate redirected to the container's own address behind the proxy.**
  Fixed in the app by a relative redirect.

Every command here is run by Tejas, by hand. Agents do not deploy (`CLAUDE.md` hard rule; the
`PreToolUse` guard blocks it). Project: `virtual-tryon-tejas`. Region assumed: `us-central1`.

Steps marked **verify** were written from Google's docs; check them against the project as you go. Besides the notes above, this file records no other results.

Set these once in your shell:

```bash
export PROJECT=virtual-tryon-tejas
export REGION=us-central1
```

## 0. Before anything

- [ ] ADR 0001's three checks: billing is active (App Hosting needs the Blaze plan), no leftover
      Firestore/Storage/Auth data from the earlier attempt, you are the sole IAM owner.
- [ ] `firebase --version` is 14 or newer; `gcloud auth login` and `firebase login` are current.
- [ ] Local gates are green from a clean install:
      `npm ci && npm run verify && npm test && npm run test:emu && npm run build && npm run test:e2e`
      (keep the Mac awake for the last one: `caffeinate -i npm run test:e2e`).
- [ ] The work is committed and pushed. App Hosting builds from GitHub, so nothing deploys until it
      is pushed. The live branch is `main` (step 6).

## 1. Enable APIs

```bash
gcloud services enable \
  firebaseapphosting.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  firestore.googleapis.com firebasestorage.googleapis.com storage.googleapis.com \
  identitytoolkit.googleapis.com workflows.googleapis.com workflowexecutions.googleapis.com \
  cloudscheduler.googleapis.com generativelanguage.googleapis.com \
  --project $PROJECT
```

## 2. Firebase console setup

- [ ] **Firestore**: a database exists in Native mode (create one in `us-central1` or the nearest
      multi-region if there is none).
- [ ] **Storage**: the default bucket exists. Note its name; it is either
      `virtual-tryon-tejas.appspot.com` or `virtual-tryon-tejas.firebasestorage.app`.
      `export BUCKET=<that name>`
- [ ] **Authentication → Sign-in method**: enable **Anonymous** and **Google**.
- [ ] **Project settings → Your apps**: a **Web app** is registered (App Hosting injects its
      config into the build).

## 3. Copy the garment images to Cloud Storage (done: the prototype's 31 images)

*Done for the current catalogue: `gs://<bucket>/catalog/` holds the 31 files from
`packages/catalog/assets/prototype/`. The original M2 text was for five garments; the commands below
are for the current set.*

Garment images live in the bucket under `catalog/`. Both the render step and the product pages
read them from there. In production a missing image fails the try-on with an `internal` error and
a log line naming the file; there is no fallback.

- [ ] Copy the files:

```bash
gcloud storage cp packages/catalog/assets/prototype/* gs://$BUCKET/catalog/ --project $PROJECT
```

- [ ] Check all 31 are listed:

```bash
gcloud storage ls gs://$BUCKET/catalog/ --project $PROJECT
```

Adding a garment later means: add the file to `packages/catalog/assets/prototype/`, add the item to
`packages/catalog/src/`, and copy the file to `gs://$BUCKET/catalog/` before the rollout.

- [ ] Add a lifecycle rule so pre-QA renders can never linger. `staging/` objects are deleted by
      the app when a job ends; this is the backstop for a job that never ends cleanly.

```bash
cat > /tmp/trailroom-lifecycle.json <<'JSON'
{ "rule": [ { "action": { "type": "Delete" },
              "condition": { "age": 1, "matchesPrefix": ["staging/"] } } ] }
JSON
gcloud storage buckets update gs://$BUCKET --lifecycle-file /tmp/trailroom-lifecycle.json --project $PROJECT
```

## 4. Rules and indexes (done; the rules were redeployed in Phase A for the follows collection)

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT
```

The four composite indexes (`jobs` and `photos` on `isGuest` + `expiresAt`, `jobs` on `status` +
`updatedAt`, `spendLog` on `state` + `createdAt`) take a few minutes to build. The housekeeping
endpoint fails until they are ready.

## 5. Secrets (done: all three set and access granted to the backend)

Use a paid-tier Gemini API key, on an account with billing for the image model (inputs are not used for training on the paid tier). A key without billing for the image model is refused with HTTP 402 (incident note above). `GEMINI_API_KEY` is at version 2; a new value needs a rollout (above).

```bash
firebase apphosting:secrets:set GEMINI_API_KEY --project $PROJECT      # paste the key
firebase apphosting:secrets:set GATE_PASSWORD --project $PROJECT       # the shared password
firebase apphosting:secrets:set GATE_COOKIE_SECRET --project $PROJECT  # paste: openssl rand -hex 32
```

The password and the cookie secret must be different values, or the gate refuses everyone.
Changing `GATE_PASSWORD` later signs everyone out.

Each command offers to grant the backend access; say yes once the backend exists (step 6), or run
`firebase apphosting:secrets:grantaccess <NAME> --backend trailroom --project $PROJECT` after.

**A second spend limit, on Google's side.** The app's daily cap only knows about calls it made
and recorded. Eval runs share this API key and use their own meter, and a call that dies
mid-flight is recorded at an estimate. Set a budget alert so billing itself tells you:
Cloud console → Billing → Budgets & alerts → create a budget on this project (for example $50 a
month, alerts at 50% and 90%). If the Gemini API console offers a per-day request quota for the
key, set it to a few hundred requests.

## 6. Create the App Hosting backend (done: backend `trailroom`, root `apps/web`, live branch `main`)

Firebase console → App Hosting → Create backend (or `firebase apphosting:backends:create --project $PROJECT`).

- Region: `us-central1`
- GitHub repo: `gtejasvarma/trailroom`
- **Root directory: `apps/web`**
- Live branch: the branch you pushed (`main`). Automatic rollouts are on by default in the console, but for this project pushes have not triggered them; start each by hand (command at the top).
- Backend name: `trailroom`

Note the URL it gives you, of the form `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`.

```bash
export APP_URL=<that URL, no trailing slash>
```

The first rollout will build but the app will not work yet: `apphosting.yaml` still has
placeholders. That is expected. **If the build itself fails, see "If the first build fails" below.**

## 7. Service accounts and IAM (done)

```bash
# The identity the workflow runs as, and the one Cloud Scheduler uses.
gcloud iam service-accounts create render-pose-set --project $PROJECT
gcloud iam service-accounts create purge-guests --project $PROJECT
export WF_SA=render-pose-set@$PROJECT.iam.gserviceaccount.com
export SCHED_SA=purge-guests@$PROJECT.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT \
  --member serviceAccount:$WF_SA --role roles/logging.logWriter
```

Find the App Hosting runtime service account (**verify**: by default
`firebase-app-hosting-compute@$PROJECT.iam.gserviceaccount.com`; confirm under Cloud Run →
`trailroom` → Security):

```bash
export APP_SA=firebase-app-hosting-compute@$PROJECT.iam.gserviceaccount.com

# Start workflow executions; read/write Firestore; read/write the bucket; manage Auth users.
for ROLE in roles/workflows.invoker roles/datastore.user roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding $PROJECT --member serviceAccount:$APP_SA --role $ROLE
done
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member serviceAccount:$APP_SA --role roles/storage.objectAdmin
```

Some of these may already be granted by App Hosting's defaults; re-adding is harmless.

The App Hosting service accepts public requests, so the workflow and scheduler need no Cloud Run
invoker role. What protects `/api/internal/*` is the app's own check of the caller's OIDC token:
Google-signed, audience equal to `INTERNAL_AUDIENCE`, and email equal to the expected service
account. **Verify** on first execution; if calls return 403 from Cloud Run rather than the app,
grant `roles/run.invoker` on the service to `$WF_SA` and `$SCHED_SA`.

## 8. Fill in `apps/web/apphosting.yaml`, commit, push (done)

Replace the four placeholders:

| Variable | Value |
|---|---|
| `STORAGE_BUCKET` | `$BUCKET` |
| `INTERNAL_AUDIENCE` | `$APP_URL` (no trailing slash) |
| `WORKFLOWS_SA_EMAIL` | `$WF_SA` |
| `SCHEDULER_SA_EMAIL` | `$SCHED_SA` |

Leave `RENDER_MODEL=nano-banana-2.1`, `DAILY_CAP_USD=5` and `ORCHESTRATOR=workflows`. Never set
`RENDER_PROVIDER` or `NEXT_PUBLIC_USE_EMULATORS` in production. Commit and push to the live branch;
that is meant to trigger a rollout; for this project start it by hand. The app refuses to start work with a placeholder still in
`STORAGE_BUCKET`, and refuses every internal call while the audience or emails are unset.

## 9. Deploy the workflow (done; it ran end to end on 2026-10-08)

```bash
gcloud workflows deploy render-pose-set \
  --source workflows/render-pose-set.yaml \
  --location $REGION \
  --service-account $WF_SA \
  --set-env-vars APP_URL=$APP_URL \
  --project $PROJECT
```

`APP_URL` here must equal `INTERNAL_AUDIENCE` in `apphosting.yaml` exactly.

## 10. Schedule the housekeeping job (done)

One endpoint, called every 15 minutes, does the housekeeping the product's promises depend on: it deletes
guests' photos and renders about 48 hours after capture if no account was created, fails jobs
that have been stuck rendering, and releases spend reservations that never settled. **The deletion
promise in the Details sheet is only true while this job is running.**

```bash
gcloud scheduler jobs create http purge-guests \
  --location $REGION \
  --schedule "*/15 * * * *" \
  --uri "$APP_URL/api/internal/purge" \
  --http-method POST \
  --oidc-service-account-email $SCHED_SA \
  --oidc-token-audience $APP_URL \
  --project $PROJECT
```

## 11. Authorised domain (done)

Firebase console → Authentication → Settings → Authorised domains: add the host from `$APP_URL`
(and `trailroom.ai` when it points here). Google sign-in from the account sheet fails without it.

## 12. Smoke test, in this order (not yet passed: step 6 has not been observed)

For the product as it is now (V0, Phases A to C). Steps 1 to 4 do not need the image model; **step 6
is the first real render on the deployed site and has not been observed.** If it fails, run
`runs/diag.sh` before anything else.

1. Open `$APP_URL`. You should land on `/gate`. A wrong password is refused; the right one shows
   Discover **with images** (images prove the catalogue copy in step 3 and the bucket setting).
2. Internal endpoints are closed: `curl -i -X POST $APP_URL/api/internal/purge` returns 401. Run the
   purge once: `gcloud scheduler jobs run purge-guests --location $REGION --project $PROJECT`, then
   check the app's logs for a 200 whose body starts `{"purged":0`.
3. Open a jewellery piece and tap **Try it on**: it shows the "not yet" state with apparel
   alternatives. Open the leather jacket and tap **Try it on**: it shows the honest reason and the
   closest three. Neither asks for a photo.
4. Open an apparel piece and tap **Try it on**. The upload screen shows the consent line under the
   upload controls ("By adding a photo you confirm you're 18 or over and agree to it being used to make
   your try-ons.") and **no tick**. Add a photo.
5. The queue screen shows four tiles filling in. Navigate away: the chip appears on every screen
   with the true count of poses ready, and a toast with **See it** appears when the set is ready.
   **This is the first real execution of the model path.** If nothing fills, stop and run
   `runs/diag.sh`; watch the workflow with
   `gcloud workflows executions list render-pose-set --location $REGION --project $PROJECT --limit 3`
6. **A real render succeeds.** All four tiles fill with a picture of you in the piece. Not yet seen on
   the deployed site (incident note above).
7. As a guest the result will not open ("4 poses, ready. Create an account to open them."), and a
   direct request for a full-size image is refused: the server hands a guest tile-sized images of
   their own finished set only. Check with the browser's network tab, or `curl` with the session
   cookie, on an `/api/renders/...` URL.
8. **Continue with Google.** The guest session is linked: the result opens with four poses and the AI
   caption under the gallery (nothing drawn on the images), with no re-render. Buy is the filled
   action; Buy, Add to a list and Build the outfit show a "coming soon" toast.
9. Back in Discover, the piece you tried is shown "on you" with "See your 4 poses". **You → Your
   try-ons** lists it.
10. **You → remove a photo**, then **Delete everything**, and confirm in the Storage browser that
    `photos/<uid>/` and `renders/<uid>/` are gone.
11. Check spend in Firestore: `spend/<today, UTC>` shows about 150,000 `committedMicros` ($0.15) and
    zero `pendingMicros`; `spendLog` has four settled lines. A call the provider rejected with a 4xx
    status settles at zero.

## If the first build fails

Three things could not be checked locally.

- **Workspace packages don't resolve.** App Hosting documents Turborepo and Nx monorepos but not
  whether a build rooted at `apps/web` installs from the repo root. If the build log shows
  `Cannot find module '@trailroom/...'`, that is this. Tell Claude; the fix is in the build
  configuration, not the app.
- **Firebase web config is missing in the browser** (console error about `apiKey` on first load).
  The client relies on App Hosting injecting `FIREBASE_WEBAPP_CONFIG` at build time. The fallback
  is to add `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID` to `apphosting.yaml` with
  `availability: [BUILD, RUNTIME]`, from Project settings → Your apps.
- **A workflow step fails on its first run.** The YAML is checked against the app's routes by a
  contract test, and a TypeScript port of its branch logic is checked against the inline
  orchestrator, but the YAML itself has never executed. Two things in it were written from memory
  of Google's docs because the pages would not load: the `get_type(e)` helper in the error
  handler, and the assumption that an unhandled error in one parallel branch stops the others. The execution's error names the failing step:
  `gcloud workflows executions describe <id> --workflow render-pose-set --location $REGION --project $PROJECT`

## Changing things later

- **Daily cap or model:** edit `DAILY_CAP_USD` or `RENDER_MODEL` in `apphosting.yaml`, push. A cap
  above 1000 is rejected as a likely typo.
- **Per-person limits:** guests get 2 try-on starts a day and signed-in users 5, in
  `apps/web/src/server/limits.ts`.
- **Kill switch:** set `DAILY_CAP_USD` to `0.01`. Every try-on then ends on the capacity screen
  without calling the model.
- **Secret value:** `firebase apphosting:secrets:set`, then a rollout (top of this file).
- **Workflow change:** re-run step 9.
- **Rules or indexes:** re-run step 4.

## What this deploy is not

It is behind a password for you and a few consenting friends. Before anyone else gets the
password, the list in `docs/decisions/0004-m2-m3-ahead-of-m1.md` ("Owed before the password gate
comes off") applies: M1's real quality checks, the live-selfie face match, a BIPA review, a legal
view on AI disclosure without an in-pixel label, and Vertex AI in place of the API key.
