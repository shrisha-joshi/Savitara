# Backend Dockerfile
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements FIRST to leverage Docker cache
COPY requirements.txt .

# Install dependencies, create user, and set up directories in a single RUN command
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && pip install --no-cache-dir -r requirements.txt \
    && groupadd -r appuser && useradd -r -g appuser appuser \
    && mkdir -p /app/uploads/documents /app/logs \
    && chown -R appuser:appuser /app/uploads /app/logs \
    && rm -rf /var/lib/apt/lists/*

# Copy application code with ownership
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
