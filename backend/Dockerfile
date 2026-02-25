# =============================================================================
# Savitara Backend — Multi-stage Dockerfile
# =============================================================================
#
# Stages:
#   builder  — installs Python deps with full build toolchain
#   runtime  — minimal production image (no gcc, no pip, no test packages)
#
# Build:
#   docker build -t savitara-backend:latest .
#
# Build for specific environment:
#   docker build --build-arg APP_ENV=production -t savitara-backend:latest .
# =============================================================================

# ── Stage 1: dependency builder ─────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build-time system deps (gcc for C extensions, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
        libssl-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first — maximises cache reuse on code changes
COPY requirements.txt .

# Install into a prefix dir so we can COPY it cleanly into the runtime stage.
# Use --no-compile to skip .pyc generation here; the runtime stage will do it.
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: production runtime ─────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ARG APP_ENV=production
ENV APP_ENV=${APP_ENV} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=0 \
    # place our installed packages on the path
    PYTHONPATH=/app

WORKDIR /app

# Minimal runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    # Non-root user for security
    && groupadd -r appuser \
    && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    # Persistent dirs with correct ownership
    && mkdir -p /app/uploads/documents /app/logs \
    && chown -R appuser:appuser /app

# Copy installed packages from builder — avoids gcc et al in final image
COPY --from=builder /install /usr/local

# Compile bytecode now so the first request isn't slow
RUN python -m compileall -q /usr/local/lib/python3.11/site-packages 2>/dev/null || true

# Copy application source with correct ownership
COPY --chown=appuser:appuser . .

# Drop to non-root
USER appuser

# Tell Docker which port to document (actual binding is in CMD)
EXPOSE 8000

# Health check — /health endpoint must return 200
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Graceful shutdown: uvicorn handles SIGTERM with --timeout-graceful-shutdown
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--timeout-graceful-shutdown", "30", \
     "--access-log", \
     "--log-level", "info"]
