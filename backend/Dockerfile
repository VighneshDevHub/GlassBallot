# syntax=docker/dockerfile:1.6

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH="/app/backend:/app"

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 10001 gbapp \
 && useradd -u 10000 -g gbapp -m -s /sbin/nologin gbapp

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r /app/backend/requirements.txt

COPY gb /app/gb
COPY backend /app/backend
COPY data /app/data
COPY backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh \
 && chown -R gbapp:gbapp /app /app/data || true

USER gbapp

EXPOSE 8000

ENTRYPOINT ["/app/start.sh"]
