import io
import math
import os
import sys

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as service  # noqa: E402


def png(width=200, height=300, color=(120, 130, 140)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


def files(person: bytes, render: bytes):
    return {
        "person": ("person", person, "application/octet-stream"),
        "render": ("render", render, "application/octet-stream"),
    }


@pytest.fixture()
def client():
    with TestClient(service.app) as c:  # runs the lifespan: models load at start-up
        yield c


# ---- the mapping ---------------------------------------------------------------------------


def test_mapping_matches_the_documented_values():
    p = service.probability_from_distance
    assert p(0.6) == pytest.approx(0.5)
    assert p(0.82) == pytest.approx(0.10, abs=0.005)
    assert p(0.4) == pytest.approx(0.88, abs=0.005)


def test_mapping_is_monotonic_and_bounded():
    p = service.probability_from_distance
    values = [p(d / 100) for d in range(0, 200)]
    assert all(a > b for a, b in zip(values, values[1:]))
    assert all(0.0 < v < 1.0 for v in values)
    assert p(1e6) == pytest.approx(0.0, abs=1e-12)  # no overflow
    assert p(-1e6) == pytest.approx(1.0)
    assert math.isfinite(p(0.0))


# ---- the endpoints -------------------------------------------------------------------------


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_no_face_in_either_image(client):
    r = client.post("/match", files=files(png(), png()))
    assert r.status_code == 200
    assert r.json() == {
        "person_face_found": False,
        "render_face_found": False,
        "distance": None,
        "probability": None,
    }


def test_no_face_in_one_image(client, monkeypatch):
    # A face in the person's photo only: the render is a flat colour, the person is faked.
    person_marker = png(color=(1, 2, 3))

    def fake_locations(rgb, number_of_times_to_upsample=1, model="hog"):
        return [(10, 90, 90, 10)] if int(rgb[0, 0, 0]) == 1 else []

    monkeypatch.setattr(service.face_recognition, "face_locations", fake_locations)
    r = client.post("/match", files=files(person_marker, png()))
    assert r.status_code == 200
    body = r.json()
    assert body["person_face_found"] is True
    assert body["render_face_found"] is False
    assert body["distance"] is None and body["probability"] is None


def test_several_faces_uses_the_largest(client, monkeypatch):
    small, large = (0, 40, 40, 0), (10, 190, 190, 10)
    monkeypatch.setattr(
        service.face_recognition,
        "face_locations",
        lambda rgb, number_of_times_to_upsample=1, model="hog": [small, large],
    )
    used = []

    def fake_encodings(rgb, known_face_locations=None, **_):
        used.append(known_face_locations)
        return [np.zeros(128)]

    monkeypatch.setattr(service.face_recognition, "face_encodings", fake_encodings)
    r = client.post("/match", files=files(png(), png()))
    assert r.status_code == 200
    assert used == [[large], [large]]
    body = r.json()
    assert body["distance"] == 0.0
    assert body["probability"] == pytest.approx(service.probability_from_distance(0.0))


def test_distance_and_probability_follow_the_encodings(client, monkeypatch):
    monkeypatch.setattr(
        service.face_recognition,
        "face_locations",
        lambda rgb, number_of_times_to_upsample=1, model="hog": [(0, 50, 50, 0)],
    )
    vectors = iter([np.zeros(128), np.full(128, 0.6 / math.sqrt(128))])
    monkeypatch.setattr(
        service.face_recognition,
        "face_encodings",
        lambda rgb, known_face_locations=None, **_: [next(vectors)],
    )
    body = client.post("/match", files=files(png(), png())).json()
    assert body["distance"] == pytest.approx(0.6)
    assert body["probability"] == pytest.approx(0.5)
    # Nothing but the numbers comes back: no encodings.
    assert set(body) == {
        "person_face_found",
        "render_face_found",
        "distance",
        "probability",
    }


def test_hog_is_tried_first_then_one_upsample(monkeypatch):
    calls = []

    def fake(rgb, number_of_times_to_upsample=1, model="hog"):
        calls.append((number_of_times_to_upsample, model))
        return []

    monkeypatch.setattr(service.face_recognition, "face_locations", fake)
    assert service.find_face(np.zeros((50, 50, 3), dtype=np.uint8)) is None
    assert calls == [(0, "hog"), (1, "hog")]


def test_a_non_image_upload_is_refused(client):
    r = client.post("/match", files=files(b"this is not an image", png()))
    assert r.status_code == 422
    assert "person" in r.json()["detail"]
    r = client.post("/match", files=files(png(), b"%PDF-1.4 nope"))
    assert r.status_code == 422
    assert "render" in r.json()["detail"]


def test_an_empty_upload_is_refused(client):
    assert client.post("/match", files=files(b"", png())).status_code == 422


def test_an_oversized_upload_is_refused(client, monkeypatch):
    monkeypatch.setattr(service, "MAX_IMAGE_BYTES", 1000)
    r = client.post("/match", files=files(png(width=600, height=800), png()))
    assert r.status_code == 413


def test_a_missing_part_is_refused(client):
    r = client.post("/match", files={"person": ("p", png(), "image/png")})
    assert r.status_code == 422


def test_large_images_are_downscaled_before_detection():
    arr = service.load_image(png(width=3200, height=4000), "person")
    assert max(arr.shape[:2]) == service.MAX_LONG_EDGE
    small = service.load_image(png(width=300, height=400), "person")
    assert small.shape[:2] == (400, 300)


def test_nothing_is_written_to_disk(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    before = set(os.listdir("/tmp"))
    client.post("/match", files=files(png(), png()))
    assert list(tmp_path.iterdir()) == []
    assert set(os.listdir("/tmp")) - before == set()


# ---- a real face, when the (git-ignored) fixtures are on this machine ------------------------

FIXTURE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "fixtures",
    "people",
    "Gemini_Generated_Image_z3d9y6z3d9y6z3d9.png",
)


@pytest.mark.skipif(not os.path.exists(FIXTURE), reason="fixture photo not on this machine")
def test_a_photo_against_itself_is_a_near_perfect_match(client):
    data = open(FIXTURE, "rb").read()
    body = client.post("/match", files=files(data, data)).json()
    assert body["person_face_found"] and body["render_face_found"]
    assert body["distance"] < 0.05
    assert body["probability"] > 0.95
