# Builds on Cloud Run (gcloud run deploy --source) and locally (docker build).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# dlib compiles from source: it needs cmake and a C++ toolchain. libgomp1 is its runtime
# dependency. The toolchain is removed in the same layer to keep the image small.
WORKDIR /app
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake libgomp1 \
    && pip install -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential cmake \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY app.py .

# Cloud Run sets PORT (8080). One worker: the models are loaded once, and Cloud Run scales by
# instances. Requests are CPU bound, so the service's --concurrency is kept low.
ENV PORT=8080
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
