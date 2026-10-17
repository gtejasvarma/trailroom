# Deploy runbook — Trailroom on Firebase

> **Where this stands (2026-10-12).** The site is deployed: App Hosting backend `trailroom`, root
> directory `apps/web`, live branch `main`, project `virtual-tryon-tejas`, at
> `https://trailroom--virtual-tryon-tejas.us-central1.hosted.app` and, since the same day, at
> `https://trailroom.ai` (see "Custom domain" below). **The rollout of commit `9d5694d` is done: Phases A to
> G, the fixes of the security review and the redesign of 2026-10-11 (ADR 0006) are live, and the site is
> public, with no password** (owner's decision, PRD §22.1 row 41). Real try-ons have been generated on the
> hosted site. Pushes to `main` have not been triggering rollouts, so each one is started by hand:
>
> ```bash
> firebase apphosting:rollouts:create trailroom --git-branch main --project virtual-tryon-tejas --force
> ```
>
> **Two changes of 2026-10-11 were rolled out on 2026-10-12 with `847e9ba`** (PRD §22.1 rows 42 and 43): the
> "Pick three labels" step is removed (after signing up a person lands on "Your photo is in"; the old
> address `/upload/labels` redirects there), and the QA gate has a face check. The owner deployed the
> face-match service on 2026-10-12 and `FACE_MATCH_URL` is set, so the check is on in production
> ("The face-match service" below); one real four-pose try-on after the rollout passed all four poses, and
> that the identity result was recorded as passed is **not yet confirmed**. The same change makes a four-pose
> try-on complete with two or three passed poses (it needed three), so **a result with only two poses is now
> possible**, and a result with fewer than two is the failure screen.
>
> **One change of 2026-10-12 is on `main` after the next commit and needs a rollout** (PRD §22.1 row 44):
> **an account is required to start any render.** A guest can browse, keep Favourites and upload a photo,
> but the server refuses their `POST /api/try-on` with `account_required`; pressing "Try it on" raises the
> account sheet, and after Google sign-in the try-on starts by itself. The guest limit of two starts a day is
> gone (signed-in people get 5). It changes no rules, no indexes and no config, so it needs only the rollout
> command above. A try-on a guest made before the rollout still shows tiles and opens after sign-in until
> the guest is purged, about 48 hours after capture; nothing needs doing about it.
>
> **The password is off.** `apps/web/apphosting.yaml` sets `GATE` to `"off"` and the rollout of `9d5694d`
> took effect: the site is open to anyone and search engines may index it. The eval (M1), the legal review
> and the other items of ADR 0004's list are still open (see "What this deploy is not"). Run smoke test step
> 19 if it has not been run. See "The password gate" below for how to put the password back.
>
> **Rules and indexes.** The rollout of `9d5694d` needs the rules and the indexes of Phases E and G and the
> redesign: Phase E added the server-only `purchases` collection, Phase G added six more
> (`publishedPieces`, `publishEvents`, `arrivals`, `emailPrefs`, `emailSent`, `emailTokens`), and the redesign
> added one composite index on `lists` (`isGuest`, `expiresAt`) that the guest purge needs, because a guest's
> Favourites are purged with the guest. Tejas ran this deploy on 2026-10-11, before the rollout of `9d5694d` (rules released, indexes deployed). It is repeated whenever `firestore.rules` or `firestore.indexes.json` changes:
>
> ```bash
> firebase deploy --only firestore:indexes,firestore:rules --project virtual-tryon-tejas
> ```
>
> Then wait until the new index shows as built (a few minutes; Firebase console, Firestore, Indexes),
> because the housekeeping endpoint fails until it is. The two changes of 2026-10-11 change no rules and
> add no index. Phases F and G changed no workflow and added no Scheduler job: the follow loop runs inside
> the existing 15-minute housekeeping call (step 10). One query (`publishEvents`: equality on `type` with a
> range on `createdAt`) may need a composite index in production, and the emulator cannot tell. If the
> logs show an index error, create the index from the link in the error.
>
> **Phase G ships with two switches, both off:** `EMAIL_TRANSPORT` (default `none`: nothing is sent and
> the product shows no email controls) and `ARRIVALS_BUFFER` (default `off`: nothing is rendered that a
> person did not ask for). Both are in `apps/web/apphosting.yaml`; leave them as they are. Nothing has
> been published on the hosted site, the buffer has never run with the real image model, and no real email
> has been sent.
>
> **Done for this project:** steps 0 to 11 (2026-10-07 and 2026-10-08), the Phase A rules redeploy for the
> follows collection, the Phase D rules and indexes, and the catalogue images in `gs://<bucket>/catalog/`
> (all 33 files from `packages/catalog/assets/prototype/`, copied by the owner on 2026-10-11 after the
> sharper photographs replaced the old ones). The garment-image step is repeated whenever a catalogue
> image changes, and it must be done before the rollout that needs it.
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
with its status (ADR 0004, 2026-10-08 amendment). As of 2026-10-09 no successful render had been
observed on the deployed site; real try-ons have been generated there since.

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

## 3. Copy the garment images to Cloud Storage (done: all 33 files, 2026-10-11)

*Done for the current catalogue: on 2026-10-11 the owner copied all 33 files from
`packages/catalog/assets/prototype/` to `gs://virtual-tryon-tejas.firebasestorage.app/catalog/`. They
are the sharper photographs (eleven stock photographs at 1400 px, sixteen restored pose-set photographs
at 896 x 1200, four unchanged wrap-top photographs) and the two files of the home page hero,
`proof-label.jpg` and `proof-on-her.jpg`. **Repeat this step whenever a file in that folder changes,**
and before the rollout that uses it: the restored photographs are also the garment reference the try-on
sends to the image model, and a missing or stale file fails the try-on. The original M2 text was for
five garments; the commands below are for the current set.*

Garment images live in the bucket under `catalog/`. Both the render step and the product pages
read them from there. In production a missing image fails the try-on with an `internal` error and
a log line naming the file; there is no fallback.

- [ ] Copy the files:

```bash
gcloud storage cp packages/catalog/assets/prototype/* gs://$BUCKET/catalog/ --project $PROJECT
```

- [ ] Check all 33 are listed:

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

## 4. Rules and indexes (done through Phase D; the Phase E and Phase G rules and the redesign's `lists` index are still to deploy)

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT
```

Phases D and E added explicit denies in `firestore.rules` for `lists`, `asks` (with `votes`), `inbox` and `purchases`, and Phase D added a field override on `votes.voterUid` in `firestore.indexes.json`. Phase G added explicit denies for `publishedPieces`, `publishEvents`, `arrivals`, `emailPrefs`, `emailSent` and `emailTokens`. The rules for `purchases` and for those six are not yet deployed. The 2026-10-11 redesign changed no rules but added a composite index on `lists` (`isGuest` + `expiresAt`), which the guest purge uses to find a guest's expired Favourites. One command deploys all of it, rules and indexes together:

```bash
firebase deploy --only firestore:indexes,firestore:rules --project virtual-tryon-tejas
```

The five composite indexes (`jobs`, `photos` and `lists` on `isGuest` + `expiresAt`, `jobs` on `status` +
`updatedAt`, `spendLog` on `state` + `createdAt`) take a few minutes to build. The housekeeping
endpoint fails until they are ready, so for the new `lists` index, wait for it before the rollout.

## 5. Secrets (done: all three set and access granted to the backend)

Use a paid-tier Gemini API key, on an account with billing for the image model (inputs are not used for training on the paid tier). A key without billing for the image model is refused with HTTP 402 (incident note above). `GEMINI_API_KEY` is at version 2; a new value needs a rollout (above).

```bash
firebase apphosting:secrets:set GEMINI_API_KEY --project $PROJECT      # paste the key
firebase apphosting:secrets:set GATE_PASSWORD --project $PROJECT       # the shared password
firebase apphosting:secrets:set GATE_COOKIE_SECRET --project $PROJECT  # paste: openssl rand -hex 32
```

The password and the cookie secret must be different values, or the gate refuses everyone.
Changing `GATE_PASSWORD` later signs everyone out. With `GATE` set to `off` the two secrets are unused but stay in place, so the password can be put back ("The password gate").

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
that have been stuck rendering, and releases spend reservations that never settled. Since Phase G it
also runs the follow loop (the "arrives on you" buffer and the email step); each part does nothing unless
its switch is on, and the Scheduler job and the workflow did not change. **The deletion
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

Firebase console → Authentication → Settings → Authorised domains: add the host from `$APP_URL`.
Google sign-in from the account sheet fails without it. **`trailroom.ai` now points here, so it must be
added as well (not done yet; see "Custom domain" below).**

## The password gate

The site has sat behind one shared password. From the rollout after 2026-10-11 it does not.

- **The switch.** `GATE` in `apps/web/apphosting.yaml` (runtime). `gateIsOff` in `apps/web/src/lib/gate.ts` is true only for exactly `off`. Any other value, or removing the entry, leaves the password gate on, so a typo can never open the site. The checked-in value is `"off"`.
- **What it does when off.** `apps/web/src/middleware.ts` lets every path through; `/gate` sends the visitor to `/`; `POST /api/gate` leads home. `/api/internal/*` is unchanged: it is still authenticated by OIDC in its own handlers. The public ask and unsubscribe paths keep their own `noindex`, no-store and no-referrer headers. Nothing else carries `noindex`, so the rest of the site can be indexed by search engines.
- **What stays.** The gate code, the `GATE_PASSWORD` and `GATE_COOKIE_SECRET` secrets (section 5) and the gate tests. Local development and the test suites do not set `GATE`, so they still run with the gate on.
- **When it takes effect.** At the next manual rollout, not before (see the top of this file). Editing the file or pushing does nothing by itself.
- **To put the password back.** Set `GATE` to anything other than `off` (or delete the entry) in `apps/web/apphosting.yaml`, commit and push, then run the rollout command at the top of this file. The secrets are still in place, so the password is the same one as before unless `GATE_PASSWORD` was changed. With the gate back on, the older smoke test steps (a visit lands on `/gate`; the private-window checks that other paths go to `/gate`) apply again, and step 19 can be done by posting wrong passwords to `/api/gate` as it used to be.

## The face-match service

A small private Python service, `services/face-match/`, which the QA gate calls to ask whether the face
in a render is the face in the person's own photo (ADR 0007). It is a service of its own because the Node
app cannot run a Python library in-process. **Done on 2026-10-12.** The owner deployed it as the private
Cloud Run service `trailroom-face-match`, at `https://trailroom-face-match-zghitd3y5q-uc.a.run.app`. The Cloud
Build on amd64 succeeded first time, and an unauthenticated `POST /match` is refused with 403. The owner granted
`roles/run.invoker` to `firebase-app-hosting-compute@virtual-tryon-tejas.iam.gserviceaccount.com`. `FACE_MATCH_URL` is set in
`apps/web/apphosting.yaml` (commit `847e9ba`), and that commit was rolled out the same day, so the check
is on in production. Cloud Run reserves the path `/healthz`, so the service's health path answers 404 from
outside; that is expected and is not a fault.

**What remains:** confirm that the identity result was recorded as passed on a real job. One real four-pose
try-on after the rollout completed with all four poses passed, but the diagnostic script did not print the
identity result at the time. It does now. Run `bash runs/diag.sh`: for each pose it prints the face result
(status, probability, note) and the job's list of checks that did not run, followed by three log sections
(what the app logged, requests that failed, and the face-match service's lines). The identity result is
`pass` with a probability and the job's `qaSkipped` does not list `identity` (smoke test step 27).

The steps below are kept as the record of what was done and for redeploying; they are copied from the
service's `README.md` "Deploy" section, which has the API, the privacy notes and how to run it locally.

1. Deploy the service, private:

   ```bash
   gcloud run deploy trailroom-face-match --source services/face-match --project virtual-tryon-tejas --region us-central1 --no-allow-unauthenticated --memory 2Gi --cpu 2 --concurrency 4 --min-instances 0 --max-instances 3 --timeout 60
   ```

   Note the service URL it prints (`https://trailroom-face-match-<hash>-uc.a.run.app` or
   `https://trailroom-face-match-<number>.us-central1.run.app`). The first build compiles dlib and
   takes several minutes. The image was built and run on arm64 locally; Cloud Build built it on amd64
   on 2026-10-12 and succeeded first time. Read the build log if a later build fails.

2. Let the app call it. The App Hosting backend runs as the service account below (the default, per
   section 7; confirm under Cloud Run, `trailroom`, Security, and if it differs use that one):

   ```bash
   gcloud run services add-iam-policy-binding trailroom-face-match --project virtual-tryon-tejas --region us-central1 --member serviceAccount:firebase-app-hosting-compute@virtual-tryon-tejas.iam.gserviceaccount.com --role roles/run.invoker
   ```

   To see which service account the backend runs as:

   ```bash
   gcloud run services describe trailroom --project virtual-tryon-tejas --region us-central1 --format "value(spec.template.spec.serviceAccountName)"
   ```

3. In `apps/web/apphosting.yaml`, uncomment the `FACE_MATCH_URL` entry, set it to the service URL from step
   1 (no trailing slash), and roll the backend out (the command at the top of this file). Until this step
   the check stays switched off and nothing about the app changes. (Done: it is set to the URL above.) `FACE_MATCH_MIN` (default `0.50` since 2026-10-12; it was `0.10`, the
   owner's rule) is in the same file.
4. Run smoke test steps 27 and 28.

What to know before relying on it:

- **The score is uncalibrated.** The "probability" is a logistic mapping of dlib's face distance (centred
  on 0.6, `k = 10`), not a measured probability. Locally, four real renders of the fictional test person
  scored 0.99, 19 of 21 different-person pairs scored under 0.10, and two scored 0.108 and 0.482. The
  sample is small and nearly all front-facing; nothing is known about the Walking and Seated poses. The
  data suggested a higher `FACE_MATCH_MIN` (around 0.3 to 0.5) would be safer than the first default of
  0.10; the owner set 0.50 on 2026-10-12.
- **What fails and what skips.** A match below the minimum fails the pose (`identity_mismatch`), the render
  is never published, and the pose is retried once, so a mismatching pose costs two renders (about $0.04
  extra). No face found in the photo or in the render is a skip. The service being unreachable (a cold
  start that outlasts the 20-second timeout, an outage) is a skip, logged; `IDENTITY_ON_SERVICE_ERROR` in
  `packages/pipeline/src/qa.ts` can be set to `"fail"` to refuse renders instead. The job document's
  `qaSkipped` lists `identity` unless the check judged every published pose.
- **Cost and cold starts.** With `--min-instances 0` the first request after idle pays a cold start (the
  models load at start-up); a request takes a second or two on 2 vCPUs.
- **Privacy.** The service decodes both images in memory, writes nothing to disk, returns no face
  encodings and logs only the distance, the probability and timings. It is nonetheless processing of face
  geometry; whether the consent line covers it is an open question for the legal review (PRD §22.5
  question 11).
- **To switch it off again:** comment out `FACE_MATCH_URL` in `apps/web/apphosting.yaml` and roll out.

## 12. Smoke test, in this order

For the product as it is now (Phases A to G, rolled out, with the defaults of both switches, and with the account requirement of 2026-10-12, which needs its own rollout first), **with the password gate off, as `apphosting.yaml` has it and as the site has been since the rollout of `9d5694d` on 2026-10-11: nobody enters a password.** If the gate is put back, the steps that mention `/gate` or a password apply again ("The password gate"). Steps 1 to 4 do not need the image
model; steps 5 and 6 are the first model calls. If a try-on fails, run `runs/diag.sh` before anything else.
Steps 1 to 11 were written for V0; steps 12 to 20 cover Phases D to F and the security fixes, steps 21 and 22 cover Phase G, steps 23 to 26 cover the 2026-10-11 redesign, and steps 27 and 28 cover the two changes made after it (the starters screen with no label step, and the face check, whose service is deployed). Steps 4 to 8 were rewritten on 2026-10-12 for the account requirement: nobody renders before signing in. This file does not record that any of steps 12 to 28 has been run on the deployed site. Run steps 23 to 26 on both addresses: `https://trailroom.ai` and `$APP_URL` (the `hosted.app` address).

1. Open `$APP_URL`. It shows Discover **with images**, with no password page. Open `$APP_URL/gate`: it leads home
   (`/`). (With the gate put back, the visit lands on `/gate` instead, a wrong password is refused and the right one shows Discover.) The images prove the catalogue copy in step 3 and the bucket setting.
2. Internal endpoints are closed: `curl -i -X POST $APP_URL/api/internal/purge` returns 401. Run the
   purge once: `gcloud scheduler jobs run purge-guests --location $REGION --project $PROJECT`, then
   check the app's logs for a 200 whose body starts `{"purged":0`.
3. Open a jewellery piece and tap **Try it on**: it shows the "not yet" state with apparel
   alternatives. Open the leather jacket and tap **Try it on**: it shows the honest reason and the
   closest three. Neither asks for a photo.
4. In a private window, not signed in, open an apparel piece and tap **Try it on**. The upload screen
   shows the consent line under the upload controls ("By adding a photo you confirm you're 18 or over and
   agree to it being used to make your try-ons.") and **no tick**; its line under the title says an
   account comes after the photo. Add a photo.
5. **The account comes before the render.** The account sheet rises with "Create an account to try it on".
   Nothing has been rendered: no new job for the guest in Firestore, `spend/<today, UTC>` has not moved,
   and a `POST /api/try-on` with the guest's ID token answers 403 `account_required`. Close the sheet:
   still nothing renders, and the photo is kept. Then press **Continue with Google**. When the popup
   closes the try-on starts by itself, with no second press, and you land on the queue screen: four
   tiles filling in. Navigate away: the chip appears on every screen with the true count of poses ready,
   and a toast with **See it** appears when the set is ready. If nothing fills, stop and run
   `runs/diag.sh`; watch the workflow with
   `gcloud workflows executions list render-pose-set --location $REGION --project $PROJECT --limit 3`
   Do this once with a Google account that is new to the site (the guest is linked and keeps its uid)
   and once with one that already exists (the guest's photo is merged in under the same photo id; if it
   did not carry over, the try-on uses the account's default photo).
6. **A real render succeeds.** All four tiles fill with a picture of you in the piece. (Seen on the
   deployed site since the incident note above.) Since the change of 2026-10-11 a result with only two or
   three poses is also a finished try-on, with a line saying how many poses are shown; fewer than two is
   the failure screen. That includes a pose refused by the face check.
7. **A guest cannot start a render, and cannot see a full-size image.** Beyond the 403 in step 5, check
   a guest's request for a full-size image: it is refused, and the server hands a guest tile-sized images
   of their own finished set only. Check with the browser's network tab, or `curl` with the session
   cookie, on an `/api/renders/...` URL. A guest can only have a finished set if it was made before the
   rollout of the account requirement; such a set shows "4 poses, ready. Create an account to open them."
   until the guest signs in or is purged, about 48 hours after capture. A leftover set needs no action.
8. **The result is the mirror.** The first time, the picture comes into focus and she turns all the way
   round once on her own, then settles. Drag across the picture to turn; the thumbnails and the dots
   follow; press and hold the picture for the label's photograph. Under the name: "Label, $price.
   AI-generated preview." The choices are **Not for me**, **Ask a friend** and **Love it**; there is no
   Buy while `BUY_ENABLED` is false (`apps/web/src/lib/flags.ts`). (When there is no
   try-on yet, because the sign-in came right after an upload from the home page, you land on "Your
   photo is in" instead, with no label picker: see step 28.)
9. Back in Discover, the piece you tried is shown "on you" with "See your 4 poses". **You → Your
   try-ons** lists it.
10. **You → remove a photo**, then **Delete everything**, and confirm in the Storage browser that
    `photos/<uid>/` and `renders/<uid>/` are gone. Deleting everything also removes the sign-in, so
    signing in again gives a new uid and a fresh daily try-on count (the old `usage` documents are
    kept; removing a single try-on never resets the count).
11. Check spend in Firestore: `spend/<today, UTC>` shows about 150,000 `committedMicros` ($0.15) and
    zero `pendingMicros`; `spendLog` has four settled lines. A call the provider rejected with a 4xx
    status settles at zero.

Phases D to F (run after step 8, signed in with a fresh photo and try-on if step 10 deleted them):

12. **Lists.** Tap the heart on a piece: it saves to **Favourites** at once and a toast offers
    **Change**, which opens the list sheet; create a list and add the piece there. Favourites is shown
    first under the **Lists** tab and on its page, and cannot be renamed or deleted. As a guest, the heart
    still saves to Favourites, but **Change** and "Add to a list" open the account sheet and a list
    cannot be created.
13. **Ask.** On the list page, start an ask with one to four pieces. The share screen says the link
    shows those renders to whoever holds it, before the link exists. Copy the link.
14. **The public vote page.** In a private window, open the link
    (`$APP_URL/ask/<token>`). It opens, shows the asker's first name, the list
    name, the question and one image per piece (your Front render, or the label's photo), and nothing
    else. Vote once. Back in the signed-in window the count shows on the list; the Asks inbox shows
    the ask when the link is opened while signed in. Check the response headers on the vote page
    (`noindex`, no caching, no referrer). Revoke the ask: the link stops working on the next request.
    With the gate off, another path (for example `$APP_URL/lists`) in the private window also opens, and
    it does not carry the ask page's `noindex` headers. (With the gate put back, it goes to `/gate`.)
15. **Studio and You.** On a wide screen, `/studio` shows real counts, your try-ons and photos. Remove
    one try-on; it disappears at once.
16. **Compare.** On a wide screen select two to four tried pieces into the tray (or press `C`) and open
    Compare: one pose switcher moves every column, and a set missing that pose shows a plain placeholder.
    Outfits are not offered.
17. **Buy and the demonstration checkout.** *Skip while `BUY_ENABLED` is false: no Buy shows anywhere
    (check that none does, on a card you have tried, a product page, a list, Compare and an outfit).*
    With it on: on a result, Buy opens the buy sheet; **Go to LABEL** opens
    `/demo-checkout/<piece>`, which says there is nothing to purchase and takes no payment. Return and
    answer "Did it arrive?"; it is asked once per piece.
18. **Outfit.** On the coat's result, **Build the outfit** (or **Wear it with**) offers the vest, the
    slip dress and the wrap top. Start one: the queue shows one image, and when ready the outfit screen
    shows the AI caption beside it, **Buy the outfit** and **Add outfit to a list**, and **Try it on**
    for a piece you have not tried. The outfit appears in Your try-ons with a tag. Real cost is about
    $0.039 per outfit (three local runs on 2026-10-10 with `scripts/outfit-smoke.ts`).
19. **The attempt limit cannot be dodged. Required straight after the rollout that removes the password.**
    The password page can no longer be used for this, so use the public ask page's miss limit: 30
    requests per client in 10 minutes for tokens that are not found (`apps/web/src/server/ask-public.ts`).
    A token is 43 characters from `A-Z a-z 0-9 _ -`; the loop below makes made-up ones of that shape.
    From one machine, send 31 requests, each with a different made-up first hop in `X-Forwarded-For`:

    ```bash
    for i in $(seq 1 31); do curl -s -o /dev/null -w "$i %{http_code}\n" -H "X-Forwarded-For: 10.0.$((i / 250)).$((i % 250))" "$APP_URL/api/ask/$(printf '%043d' $i)"; done
    ```

    The first 30 answer with a not-found status; the 31st must answer 429. If it does not,
    `TRUSTED_PROXY_HOPS` in `apps/web/apphosting.yaml` is too high (the made-up hops are counting as
    different clients), or the requests were spread over more than one instance (the limits are in memory
    per instance): repeat the loop a few times before concluding. If people on different networks block
    each other, it is too low: raise it by one, roll out, and repeat this step. Wait ten minutes
    afterwards, or votes and ask-page reads from your network are refused too. Until this is checked the
    limits (votes, public reads) may be shared by every visitor. With the gate put back, this step can
    again be done by posting 11 wrong passwords to `/api/gate` in the same way; the 11th must answer 429.
20. **Sign in with Google still works** on the hosted site (the 2026-10-10 change added framing
    headers and checks on every request that the account still exists; the tests cover this only
    against the Auth emulator).
21. **The follow loop does nothing unasked, with the defaults.** Signed in, open You: there is **no**
    email section and no sentence about email. Open Discover: no "New from labels you follow" section
    appears (nothing has been published), and no card appears that you did not ask for. In the logs the
    housekeeping call answers 200 with `"arrivalsStarted":0` and `"emailsSent":0`. After a day, `spendLog`
    has no lines marked `unrequested`.
22. **The unsubscribe page answers every token alike.** In a private window, open
    `$APP_URL/unsubscribe/not-a-real-token`. It answers with the same plain page it gives any token, and
    the response carries `noindex`, no caching and no referrer. (With the gate put back, any other path in
    the private window, for example `$APP_URL/lists`, goes to `/gate`.)

The redesign (ADR 0006; PRD §22.1 rows 33 to 40). Run each on `https://trailroom.ai` and on `$APP_URL`:

23. **The hero is in the first paint.** In a private window (no `tr_hp` cookie), open the site. The first thing painted is the hero with its two photographs, the same pink wrap top
    on both sides, with "AI-generated preview" beside it, and the feed is not pushed down afterwards.
    The divider glides once; reload and it glides again once, never twice. Then add a photo and
    reload in the same window: the hero is gone from the first paint, with no flash of it. In the
    browser's storage the cookie `tr_hp` is `1`. After "Delete everything" the hero is back.
    The category row is one row of text tabs and nothing else (no tiles, no "Start with these"
    box, no DEMO chip); the demo-catalogue notice is still at the foot.
24. **The heart saves to Favourites as a guest.** In a private window,
    not signed in, tap the heart on a card: it fills at once, a toast says it is saved and offers
    **Change**, and no account sheet appeared. Open **Lists**: Favourites is there and holds the
    piece. Tap the heart again: it empties. Tap a heart, then **Change**: as a guest this opens the
    account sheet. Then sign in with Google: Favourites arrives in the account with the piece in it
    (try it with a Google account that already exists, and with a new one).
25. **The mirror, after a real try-on.** Signed in, start a real try-on and wait. When it finishes the
    picture comes into focus on white and she turns round once on her own; touch it to skip to the end.
    Open the same try-on again from You: no arrival this time (remembered per browser). With "reduce
    motion" on, it cross-fades and does not turn. **Not for me**: the picture drops away with Undo for
    five seconds; let it run out and the try-on is gone from You and the next one opens. **Ask a
    friend**: the share sheet opens with a vote link for this one piece (on a laptop the link is
    copied). **Love it**: the piece appears in Favourites.
26. **The hold.** Press and hold the picture: the label's own photograph replaces the render in place,
    with "On the label's model" at the top; let go and it returns. A drag does not trigger it. The
    keyboard equivalent is "See the label's photo" in the details. On a phone, check the page does not
    scroll or select text while holding. On desktop, check images in the Discover grid scrub with the
    mouse pointer, the left and right arrow keys work on a focused carousel, and no arrows or count chips
    are drawn on any photograph.
27. **The face check judges each pose. This is what confirms the open item of 2026-10-12.** The face-match service is deployed and `FACE_MATCH_URL` is set ("The face-match service"). Run a real try-on with a photo of a face, then read the
    latest job with `runs/diag.sh` (or in the Firebase console, Firestore, `jobs/<jobId>`). For each pose,
    the attempt's `qa.identity` is `pass` with a `probability` (the only real renders scored so far, locally, were
    0.99 in the Front pose; write the Three-quarter, Walking and Seated numbers down, because nobody has
    measured them), and the job's `qaSkipped` does **not** list `identity`. In Cloud
    Run, `trailroom-face-match` shows one request per attempt, logging a distance, a probability and
    timings, and nothing else. A request to the service URL without a token is refused by Cloud Run (it answers 403). If `qa.identity` says `skipped`, its `note` says why
    (`service_unavailable`, `no_face_in_photo`, `no_face_in_render`, `not_run` when an earlier check had already failed the image), and `qaSkipped`
    keeps `identity`. With `FACE_MATCH_URL` unset, every attempt has no `qa.identity` and `qaSkipped` lists `identity`.
28. **No label step after sign-up; the starters.** In a private window, on the home page, add a photo from
    the hero, then sign in with Google. You land on "Your photo is in" (`/upload/done`): four pieces,
    dresses and full-length pieces first, each with one **Try it on** that starts a try-on straight away,
    and a link to browse the whole catalogue. There is no "Pick three labels" screen and nothing asks you to
    follow a label. `curl -i $APP_URL/upload/labels` answers with a redirect (307) to `/upload/done`. Open
    Discover as that new account: there is no "New from labels you follow" section (the account follows
    nothing), and following a label from its page still works.

## Changing things later

- **Daily cap or model:** edit `DAILY_CAP_USD` or `RENDER_MODEL` in `apphosting.yaml`, push. A cap
  above 1000 is rejected as a likely typo.
- **Per-person limits:** signed-in users get 5 try-on starts a day, in
  `apps/web/src/server/limits.ts`. There is no guest limit: since 2026-10-12 a guest cannot start a render at all.
- **Kill switch:** set `DAILY_CAP_USD` to `0.01`. Every try-on then ends on the capacity screen
  without calling the model.
- **Secret value:** `firebase apphosting:secrets:set`, then a rollout (top of this file).
- **Workflow change:** re-run step 9.
- **Rules or indexes:** re-run step 4 (`firebase deploy --only firestore:indexes,firestore:rules --project virtual-tryon-tejas`).
- **A catalogue image:** re-run step 3 for the changed file, then roll out.

## What this deploy is not

The password is gone (the rollout of `9d5694d`, 2026-10-11) and this is open to the public (PRD §22.1 row 41, ADR 0004
amendment of 2026-10-11). The owner went ahead knowing that the list in
`docs/decisions/0004-m2-m3-ahead-of-m1.md` ("Owed before the password gate comes off") is mostly
still open. The things that matter most:

- **M1 is unfinished.** The QA gate is structural, except for the identity check, which has been deployed and
  on in production since 2026-10-12 (the identity result on a real job is not yet confirmed); it is uncalibrated, and the gate cannot
  tell whether a render changed the person's body or got the garment right (the proportion, garment and
  cross-pose checks are empty slots).
- **Strangers can spend the render budget.** Anyone with a Google account can start a render (a guest
  cannot, since 2026-10-12, which is a friction and not a control). The cost is bounded by
  `DAILY_CAP_USD` (5) and the per-person limits, but the budget can be used up, after which real
  visitors are told the service is at capacity until the next UTC day.
- **Anyone can upload a photograph of anyone**, another person or a minor included. The only safeguard
  is the consent line under the upload control; no check is performed, and the product claims none.
- **The attempt limits are in memory per instance**, and the proxy-hop check (step 19) has not been run on the hosted site.
- **No legal review** (the consent wording, renders shown to friends on vote pages, the retention of account renders, and whether the consent line covers the face check, which processes face geometry).
- Also open from the ADR list: App Check or a per-device guest limit, Cloud Armor, upload safety filters, the live-selfie face match (deferred), a BIPA review, and Vertex AI in place of the API key.
- **The site can be indexed by search engines.** Only the ask and unsubscribe pages say otherwise.

To close the site again, see "The password gate".
