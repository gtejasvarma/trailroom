# 0007 — A face check in the QA gate

Status: accepted, 2026-10-11. The code is built and tested and sits on `main` after commit
`9d5694d`. The service it calls is **not deployed yet**, so on the hosted site the check is off.

## Context

Until now the QA gate in `packages/pipeline` was structural only (ADR 0004): it could tell that a
render was a usable, new picture, and it could not tell whether the face in it was the person's.
Its identity check was an empty slot. That was accepted while the site sat behind a password.

On 2026-10-11 the owner took the password off (PRD §22.1 row 41), and the rollout of `9d5694d`
completed the same day: `https://trailroom.ai` now opens for anyone. The same day he asked for the
first real check to go into the gate. His rule, in his words as recorded: check that the face in
each render matches the person; below a 10% match, do not show the image; if one or two of the four
poses fail, show the others; if three or more fail, show the failure screen.

## Decision

**A separate Python service does the comparison.** `services/face-match/` is Python 3.11, FastAPI
and the `face_recognition` library (dlib). It was chosen because the library and its models may be
used commercially (the library is MIT; InsightFace's pretrained models were rejected because their
licence is non-commercial). The Node app cannot run a Python library in-process, which is why it is
a service of its own. It is to be deployed by the owner as a private Cloud Run service,
`trailroom-face-match`, that only the App Hosting runtime service account may call
(`roles/run.invoker`; the app presents a Google-signed ID token, `apps/web/src/server/face-match-auth.ts`).
It takes the person's photo and the render, finds the largest face in each, and returns the dlib
face distance and a "probability".

**The mapping.** `probability = 1 / (1 + exp(10 * (distance - 0.6)))`: a logistic centred on dlib's
usual same-person distance of 0.6, with `k = 10`. A distance of 0.6 gives 0.50, about 0.82 gives
0.10, and 0.4 gives about 0.88. **This is a convenience mapping of a distance, not a measured
probability, and it has not been calibrated on real try-on data.**

**The default.** The owner's 10% is the default minimum (`DEFAULT_FACE_MATCH_MIN` = 0.10 in
`packages/pipeline/src/face-match.ts`). `FACE_MATCH_MIN` in `apps/web/apphosting.yaml` moves it; a
value that is not a number from 0 to 1 falls back to 0.10.

**The gate.** The identity slot in `packages/pipeline/src/qa.ts` is now a real check, switched by
`FACE_MATCH_URL`. Unset, which is the state of production until the owner deploys the service, it
is skipped exactly as before. When set:

- A probability below the minimum fails the pose with the reason `identity_mismatch`. The render is
  never published. Like any QA failure the pose is retried once, so a mismatching pose costs two
  renders, about $0.04 more.
- No face found in the person's photo, or none in the render, is a **skip**, not a failure: the
  check could not judge.
- The service being unreachable (a timeout, a 5xx after the retry) is a **skip**, logged. This is
  one constant, `IDENTITY_ON_SERVICE_ERROR` in `qa.ts`, set to `"skip"`. Setting it to `"fail"`
  refuses every render whenever the check cannot run.
- The job document records honestly whether the identity check judged every published pose: the
  `qaSkipped` list on the job keeps `identity` unless every published pose was judged, and each
  attempt records `qa.identity` (status, probability, and a note when skipped). No user-facing
  copy claims a face check (CLAUDE.md, "Never claim a check the product doesn't perform").

**Skip rather than fail when the check cannot run.** The helper service is cold at times (it
scales to zero) and can be down. Failing closed would turn every cold start or outage into a failed
try-on that cost the person a render and showed them nothing, for a check whose threshold nobody has
calibrated. The honest record in `qaSkipped` is the safeguard against passing a skip off as a pass.
The constant is there so the owner can choose the other way.

**The set rule: 2 of 4.** The owner's rule changed how a set is routed, for everyone and whatever
the reason a pose failed. A four-pose try-on now completes with 2 or 3 passed poses (it used to need
3) and fails with 0 or 1. The rule is `routeSet` in `packages/pipeline/src/policy.ts`: a set fails
when fewer than `min(2, N)` poses passed. Single-pose jobs (outfits, arrivals) are unchanged: they
need their one pose. When the Front pose is among the failed ones, asks and the vote page fall back
to the label's photograph, as they did before. The result screen says how many poses are shown and
nothing about why.

## What was measured

Locally, on 2026-10-11, with the service run in Docker on an arm64 Mac:

- Four real renders of the fictional test person each scored 0.99 against her photo.
- Nineteen of 21 pairs of different people scored under 0.10. Two scored 0.108 and 0.482.

## What is not known

- **The sample is small and nearly all front-facing.** Nothing is known yet about the Walking and
  Seated poses, where the face is smaller, turned or partly hidden. A real person may score lower
  against their own renders than the fictional test person did.
- **The threshold.** One different-person pair scored 0.482, far above 10%, and another 0.108. The
  data suggests a higher minimum, around 0.3 to 0.5, would be safer. The owner's 10% stays the
  default; it lets through a face that is clearly someone else more often than a higher line would,
  and a higher line might also refuse the right person in the harder poses. Neither has been
  measured on enough data.
- **Cold starts and amd64.** The Docker image was built and run only on arm64 locally. Cloud Build
  will build it on amd64 for the first time at deploy, and the first request after idle pays a cold
  start (the models load at start-up).
- This check is one of five. The proportion, garment, artifact and cross-pose checks are still
  empty slots. The gate is no longer structural only once the service is deployed, but it still
  cannot tell whether a render changed a person's body or got the garment right.

## Privacy: an open question for the legal review

The service decodes both images in memory, writes nothing to disk, stores nothing, returns no face
encodings, and logs only the distance, the probability and timings. It is nonetheless processing of
face geometry. Some laws treat that as biometric data (for example Illinois BIPA) or as
special-category data (GDPR). Whether this processing is covered by the consent line under the
upload controls is an open question for the legal review, alongside the questions already recorded
(PRD §15, §22.5 question 6). This ADR draws no legal conclusion.

## How to tighten it later

- Set `FACE_MATCH_MIN` in `apps/web/apphosting.yaml` and roll out. No code change.
- Set `IDENTITY_ON_SERVICE_ERROR` to `"fail"` in `packages/pipeline/src/qa.ts` to refuse renders
  whenever the check cannot run.
- Replace the logistic mapping with a calibrated one, or compare the distance directly, once M1 (the
  eval) has real renders of real consented people in every pose: that is the work that calibrates
  the threshold. M1 is still unfinished.
- Compare against more than one of the person's photos, if the false matches and misses call for it.

## Consequences

- The set rule is looser for everyone: a try-on with only two poses can now complete. Two-pose
  results show up in the smoke test and in the product (DEPLOY, "Smoke test").
- Deploying the service is a manual step by the owner (`services/face-match/README.md`, copied into
  `docs/DEPLOY.md`). Until then nothing about the hosted site changes except the set rule.
- If the service is later removed or `FACE_MATCH_URL` is unset, the identity check is skipped again
  and `qaSkipped` says so.

## Amendment, 2026-10-12: the minimum is 50%

The owner raised the minimum from 10% to 50% the day after the check was built, having seen the
measurements above: two pairs of different people scored 0.108 and 0.482, so 10% would have shown
both. `DEFAULT_FACE_MATCH_MIN` is now 0.5 (`packages/pipeline/src/face-match.ts`), and
`FACE_MATCH_MIN` still overrides it. 50% on this mapping is a dlib face distance of 0.6, the
library's own line between "same person" and "not".

On the same small sample: all four same-person renders (0.99) still pass, and all 21
different-person pairs now fail, the closest at 0.482. What is still unknown is unchanged and
matters more at a stricter setting: no walking or seated renders have been measured, and a real
person turned away from the camera may score lower than a front-facing one. A stricter minimum
means more poses retried (about $0.04 each) and more two-pose or failed results if those poses
score low. Wherever this document says the default is 10%, read 50%.

## Amendment, 2026-10-12 (second): deployed and switched on; one result not yet confirmed

The owner deployed the service on 2026-10-12 as the private Cloud Run service `trailroom-face-match`
(`https://trailroom-face-match-zghitd3y5q-uc.a.run.app`). The Cloud Build on amd64, which this ADR listed
as untried, succeeded first time. An unauthenticated `POST /match` is refused with 403. The owner granted
`roles/run.invoker` to the App Hosting runtime service account, `FACE_MATCH_URL` is set in
`apps/web/apphosting.yaml` (commit `847e9ba`), and that commit was rolled out the same day. The identity
check is therefore on in production, with the minimum at 50%. Cloud Run reserves the path `/healthz`, so
the service's health path answers 404 from outside; that is expected.

One real four-pose try-on after the rollout completed with all four poses passed. **What is not
confirmed** is that the identity result was recorded as passed on those poses: the diagnostic script
(`runs/diag.sh`, local) did not print it at the time. It now prints, per pose, the face result (status,
probability, note) and the job's list of checks that did not run, and three log sections (what the app
logged, requests that failed, the face-match service's lines). Running it on the next real job answers
the question; until then it is recorded here as open. Nothing about calibration has changed: no walking or
seated render has been measured, and M1 is still unfinished.

Wherever this document says the service is not deployed, or that production skips the check, read this
amendment: it is deployed and on.
