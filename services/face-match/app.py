"""Face-match service: does the face in a render look like the face in the person's own photo?

POST /match takes two images as multipart file parts, `person` (the person's photo) and `render`
(a try-on render), and answers with whether a face was found in each, the dlib face distance when
both were, and `probability` (see `probability_from_distance`).

Privacy, by construction:
  * Images are decoded in memory and never written to disk.
  * No face encoding is returned, stored or logged.
  * Logs carry only the distance, the probability and timings.
The service has no auth of its own: in production it is deployed with Cloud Run IAM
(--no-allow-unauthenticated) and only the app's service account may invoke it.
"""

import io
import logging
import math
import time
from contextlib import asynccontextmanager
from typing import Optional

import face_recognition
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger("face-match")
logging.basicConfig(level=logging.INFO, format="%(message)s")

# dlib's usual same-person threshold for its face-recognition model: distances under it are
# usually the same person.
SAME_PERSON_DISTANCE = 0.6
# Steepness of the logistic below.
LOGISTIC_K = 10.0
# Larger images are shrunk to this long edge before detection (detection cost grows with pixels).
MAX_LONG_EDGE = 1600
# Per image. The app's own photo limit is 10 MiB; renders are smaller.
MAX_IMAGE_BYTES = 12 * 1024 * 1024
# Refuse to decode absurd pixel counts (a small file can expand to gigabytes of pixels).
Image.MAX_IMAGE_PIXELS = 60_000_000


def probability_from_distance(distance: float) -> float:
    """Maps a dlib face distance to 0..1: p = 1 / (1 + exp(k * (d - 0.6))), k = 10.

    d = 0.6 (dlib's usual same-person threshold) gives 0.50, d about 0.82 gives 0.10, d = 0.4
    gives about 0.88.

    THIS IS A CONVENIENCE MAPPING, NOT A MEASURED PROBABILITY. It has not been calibrated on real
    try-on data: nobody has measured how often a render of the right person lands at a given
    distance, or a render of someone else does. That is what the unfinished eval (M1) is for.
    Until then, treat `probability` as a monotonic score where bigger means more alike.
    """
    x = LOGISTIC_K * (distance - SAME_PERSON_DISTANCE)
    # Clamp so exp() cannot overflow for a very large distance.
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(x))


def load_image(data: bytes, what: str) -> np.ndarray:
    """Decodes upload bytes to an RGB array with the long edge at most MAX_LONG_EDGE."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(status_code=422, detail=f"{what} is not an image")
    img = ImageOps.exif_transpose(img).convert("RGB")
    long_edge = max(img.size)
    if long_edge > MAX_LONG_EDGE:
        scale = MAX_LONG_EDGE / long_edge
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.LANCZOS,
        )
    return np.ascontiguousarray(np.asarray(img))


def find_face(rgb: np.ndarray):
    """The largest face's box as (top, right, bottom, left), or None.

    The HOG detector first (fast); if it finds nothing, once more with the image upsampled once.
    """
    for upsample in (0, 1):
        boxes = face_recognition.face_locations(
            rgb, number_of_times_to_upsample=upsample, model="hog"
        )
        if boxes:
            return max(boxes, key=lambda b: (b[2] - b[0]) * (b[1] - b[3]))
    return None


def encode(rgb: np.ndarray, box) -> np.ndarray:
    return face_recognition.face_encodings(rgb, known_face_locations=[box])[0]


async def read_limited(upload: UploadFile, what: str) -> bytes:
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"{what} is larger than 12 MB")
    if not data:
        raise HTTPException(status_code=422, detail=f"{what} is empty")
    return data


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load dlib's models now, not on the first request: a tiny detect + encode touches both the
    # face detector and the 128-d recognition network.
    t = time.perf_counter()
    blank = np.zeros((64, 64, 3), dtype=np.uint8)
    face_recognition.face_locations(blank)
    face_recognition.face_encodings(blank, known_face_locations=[(0, 63, 63, 0)])
    log.info("models ready in %.2fs", time.perf_counter() - t)
    yield


app = FastAPI(title="trailroom face-match", lifespan=lifespan)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/match")
async def match(person: UploadFile = File(...), render: UploadFile = File(...)):
    t0 = time.perf_counter()
    person_bytes = await read_limited(person, "person")
    render_bytes = await read_limited(render, "render")
    person_rgb = load_image(person_bytes, "person")
    render_rgb = load_image(render_bytes, "render")
    # The uploads are no longer needed; only the decoded arrays are kept.
    del person_bytes, render_bytes

    person_box = find_face(person_rgb)
    render_box = find_face(render_rgb)
    t_detect = time.perf_counter()

    distance: Optional[float] = None
    probability: Optional[float] = None
    if person_box is not None and render_box is not None:
        a = encode(person_rgb, person_box)
        b = encode(render_rgb, render_box)
        distance = float(np.linalg.norm(a - b))
        probability = probability_from_distance(distance)

    # Only the numbers: no image data, no encodings, no file names.
    log.info(
        "match distance=%s probability=%s detect_s=%.2f total_s=%.2f",
        "none" if distance is None else f"{distance:.3f}",
        "none" if probability is None else f"{probability:.3f}",
        t_detect - t0,
        time.perf_counter() - t0,
    )
    return {
        "person_face_found": person_box is not None,
        "render_face_found": render_box is not None,
        "distance": distance,
        "probability": probability,
    }
