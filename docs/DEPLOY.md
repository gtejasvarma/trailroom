# Deploy runbook — M2 + M3 on Firebase

> **Which build this describes.** This runbook is for the M2 + M3 build that is deployed first
> (BUILD_PLAN §12.2), so that App Hosting, the workflow and the IAM bindings are exercised on a small
> app. The screens and catalogue it mentions are replaced from Phase A on (PRD v0.7 §22). The
> infrastructure steps stay valid; the garment-image step and the smoke test are repeated or
> rewritten as noted in them.

Every command here is run by Tejas, by hand. Agents do not deploy (`CLAUDE.md` hard rule; the
`PreToolUse` guard blocks it). Project: `virtual-tryon-tejas`. Region assumed: `us-central1`.

Steps marked **verify** were written from Google's docs and have not been exercised against this
project. Nothing in this runbook has been run: the first rollout is the first real test of the
App Hosting build, the workflow and the IAM bindings.

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
- [ ] The work is committed and pushed. It currently sits uncommitted on branch `m2-m3-build`,
      alongside uncommitted M1 work. App Hosting builds from GitHub, so nothing deploys until it
      is pushed. Decide which branch is the live branch (step 6).

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

## 3. TODO — copy the garment images to Cloud Storage

*This is the M2 catalogue of five garments. **The catalogue images change in Phase A** (the prototype's
catalogue, BUILD_PLAN §12.3). The copy step is repeated then with
`packages/catalog/assets/prototype/`, and the check below lists the new set instead of these five.*

Garment images live in the bucket under `catalog/`. Both the render step and the product pages
read them from there. In production a missing image fails the try-on with an `internal` error and
a log line naming the file; there is no fallback.

- [ ] Copy the five files:

```bash
gcloud storage cp packages/catalog/assets/*.jpg gs://$BUCKET/catalog/ --project $PROJECT
```

- [ ] Check all five are listed:

```bash
gcloud storage ls gs://$BUCKET/catalog/ --project $PROJECT
# commons-denim-jacket.jpg  commons-elbow-sweater.jpg  commons-leather-coat.jpg
# commons-parka.jpg         commons-shell-jacket.jpg
```

Adding a garment later means: add the file to `packages/catalog/assets/`, add the item to
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

## 4. Rules and indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT
```

The four composite indexes (`jobs` and `photos` on `isGuest` + `expiresAt`, `jobs` on `status` +
`updatedAt`, `spendLog` on `state` + `createdAt`) take a few minutes to build. The housekeeping
endpoint fails until they are ready.

## 5. Secrets

Use a paid-tier Gemini API key (inputs are not used for training on the paid tier).

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

## 6. Create the App Hosting backend

Firebase console → App Hosting → Create backend (or `firebase apphosting:backends:create --project $PROJECT`).

- Region: `us-central1`
- GitHub repo: `gtejasvarma/trailroom`
- **Root directory: `apps/web`**
- Live branch: the branch you pushed. Automatic rollouts are on by default, so every push to it
  deploys.
- Backend name: `trailroom`

Note the URL it gives you, of the form `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app`.

```bash
export APP_URL=<that URL, no trailing slash>
```

The first rollout will build but the app will not work yet: `apphosting.yaml` still has
placeholders. That is expected. **If the build itself fails, see "If the first build fails" below.**

## 7. Service accounts and IAM

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

## 8. Fill in `apps/web/apphosting.yaml`, commit, push

Replace the four placeholders:

| Variable | Value |
|---|---|
| `STORAGE_BUCKET` | `$BUCKET` |
| `INTERNAL_AUDIENCE` | `$APP_URL` (no trailing slash) |
| `WORKFLOWS_SA_EMAIL` | `$WF_SA` |
| `SCHEDULER_SA_EMAIL` | `$SCHED_SA` |

Leave `RENDER_MODEL=nano-banana-2.1`, `DAILY_CAP_USD=5` and `ORCHESTRATOR=workflows`. Never set
`RENDER_PROVIDER` or `NEXT_PUBLIC_USE_EMULATORS` in production. Commit and push to the live branch;
that triggers a rollout. The app refuses to start work with a placeholder still in
`STORAGE_BUCKET`, and refuses every internal call while the audience or emails are unset.

## 9. Deploy the workflow

```bash
gcloud workflows deploy render-pose-set \
  --source workflows/render-pose-set.yaml \
  --location $REGION \
  --service-account $WF_SA \
  --set-env-vars APP_URL=$APP_URL \
  --project $PROJECT
```

`APP_URL` here must equal `INTERNAL_AUDIENCE` in `apphosting.yaml` exactly.

## 10. Schedule the housekeeping job

One endpoint, called every 15 minutes, does the housekeeping the product's promises depend on: it deletes
guests' photos and renders about 48 hours after capture if no account was created, fails jobs
that have been stuck rendering, and releases spend reservations that never settled. **The consent
screen's deletion promise is only true while this job is running.**

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

## 11. Authorised domain

Firebase console → Authentication → Settings → Authorised domains: add the host from `$APP_URL`
(and `trailroom.ai` when it points here). Google sign-in from the account sheet fails without it.

## 12. Smoke test, in this order

*These steps describe the M2 build that is deployed first: its five garments, its consent screen and its
account sheet. They will be rewritten when Phase C ships, against the prototype's screens (consent tick
on the upload screen, account-to-open, no email sent).*

1. Open `$APP_URL`. You should land on `/gate`. A wrong password is refused; the right one shows
   the catalogue with five garments **and their images** (images prove step 3 and the bucket
   setting).
2. Internal endpoints are closed: `curl -i -X POST $APP_URL/api/internal/purge` returns 401.
3. Run the purge once: `gcloud scheduler jobs run purge-guests --location $REGION --project $PROJECT`,
   then check the app's logs for a 200 whose body starts `{"purged":0`.
4. Open the leather coat and tap **Try it on**: the honest-failure screen appears with three
   alternatives, and you were not asked for a photo.
5. Open the denim jacket, **Try it on**, accept consent, upload a photo. Four tiles should fill.
   **This is the first real execution of the workflow.** Watch it:
   `gcloud workflows executions list render-pose-set --location $REGION --project $PROJECT --limit 3`
6. Check spend in Firestore: `spend/<today, UTC>` shows about 150,000 `committedMicros` ($0.15)
   and zero `pendingMicros`; `spendLog` has four settled lines.
7. On the result: the caption under each render says it is AI-generated; nothing is drawn on the
   image; the account sheet dismisses; **Continue with Google** unlocks Save.
8. **You → Delete my photo**, then confirm in the Storage browser that `photos/<uid>/` and
   `renders/<uid>/` are gone.

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
- **Workflow change:** re-run step 9.
- **Rules or indexes:** re-run step 4.

## What this deploy is not

It is behind a password for you and a few consenting friends. Before anyone else gets the
password, the list in `docs/decisions/0004-m2-m3-ahead-of-m1.md` ("Owed before the password gate
comes off") applies: M1's real quality checks, the live-selfie face match, a BIPA review, a legal
view on AI disclosure without an in-pixel label, and Vertex AI in place of the API key.
