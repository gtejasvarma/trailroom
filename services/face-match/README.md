# face-match

A small private service the QA gate calls to ask: is the face in this try-on render the face in the
person's own photo? A render whose match probability is below 50% is not shown (the owner's rule;
`FACE_MATCH_MIN` in the app moves the line).

Python 3.11, FastAPI, and the [`face_recognition`](https://github.com/ageitgey/face_recognition)
library (dlib). The library is MIT and its models are free to use commercially. InsightFace's
pretrained models are deliberately not used: their licence is non-commercial.

## API

- `GET /healthz` returns `{"ok": true}`.
- `POST /match`, multipart with two file parts, `person` (the person's photo) and `render` (the
  try-on render). Up to 12 MB each; anything that is not an image is a 422, a larger file a 413.

```json
{
  "person_face_found": true,
  "render_face_found": true,
  "distance": 0.52,
  "probability": 0.62
}
```

When an image holds several faces the largest is used. Images are shrunk to a long edge of about
1600 px before detection. The HOG detector runs first, then once more with one upsample if it found
nothing. When either face is missing, `distance` and `probability` are `null` and the app treats the
check as "could not judge", not as a failure.

### What `probability` is

`probability = 1 / (1 + exp(10 * (distance - 0.6)))`, defined once in `probability_from_distance`
in `app.py`. A distance of 0.6 (dlib's usual same-person threshold) gives 0.50, about 0.82 gives
0.10, and 0.4 gives about 0.88.

**This is a convenience mapping, not a measured probability.** It has not been calibrated on real
try-on data: nobody has measured how often a render of the right person, or of someone else, lands
at a given distance. That is what the unfinished eval (M1) is for. Read it as a score where bigger
means more alike.

## Privacy

- Images are decoded in memory and never written to disk.
- No face encoding is stored, logged or returned.
- Logs carry only the distance, the probability and timings.
- The service has no auth of its own. In production it is deployed with Cloud Run IAM
  (`--no-allow-unauthenticated`), and only the app's runtime service account may call it.

## Run it locally

```sh
cd services/face-match
docker build -t trailroom-face-match:local .
docker run --rm -p 8080:8080 trailroom-face-match:local
curl -s localhost:8080/healthz
curl -s -F person=@person.jpg -F render=@render.png localhost:8080/match
```

To point the app at it, set `FACE_MATCH_URL=http://localhost:8080` for the dev server (a local URL
gets no auth token).

The first docker build compiles dlib and takes several minutes.

## Tests

```sh
python3.11 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt     # compiles dlib; needs cmake
pytest
```

Or run them in the image: `docker run --rm -v "$PWD/tests:/app/tests" trailroom-face-match:local sh -c "pip install -q pytest httpx && pytest -q /app/tests"`.

## Deploy (by hand, by the owner)

1. Deploy the service, private:

   ```sh
   gcloud run deploy trailroom-face-match --source services/face-match --project virtual-tryon-tejas --region us-central1 --no-allow-unauthenticated --memory 2Gi --cpu 2 --concurrency 4 --min-instances 0 --max-instances 3 --timeout 60
   ```

   Note the service URL it prints (`https://trailroom-face-match-<hash>-uc.a.run.app` or
   `https://trailroom-face-match-<number>.us-central1.run.app`).

2. Let the app call it. The App Hosting backend runs as the service account below (the default,
   per `docs/DEPLOY.md` section 7; confirm under Cloud Run, `trailroom`, Security, and if it
   differs use that one):

   ```sh
   gcloud run services add-iam-policy-binding trailroom-face-match --project virtual-tryon-tejas --region us-central1 --member serviceAccount:firebase-app-hosting-compute@virtual-tryon-tejas.iam.gserviceaccount.com --role roles/run.invoker
   ```

   To see which service account the backend runs as:

   ```sh
   gcloud run services describe trailroom --project virtual-tryon-tejas --region us-central1 --format "value(spec.template.spec.serviceAccountName)"
   ```

3. In `apps/web/apphosting.yaml`, uncomment the `FACE_MATCH_URL` entry, set it to the service URL
   from step 1 (no trailing slash), and roll the backend out. Until this step the check stays
   switched off and nothing about the app changes.

Cost note: a request takes a second or two on 2 vCPUs; with `--min-instances 0` the first request
after idle also pays a cold start (the models load at start-up). A cold or unavailable service
never blocks a try-on: the identity check is then skipped for that pose and the job records that it
did not run.
