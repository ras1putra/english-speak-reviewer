# Base UV binary
FROM ghcr.io/astral-sh/uv:latest AS uv-binary

# CPU Base Image
FROM python:3.12-slim-bookworm AS cpu-base
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:${PATH}"
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=uv-binary /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN mkdir -p /app/.venv

# GPU Base Image
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04 AS gpu-base
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:${PATH}"
RUN apt-get update && apt-get install -y \
    software-properties-common \
    curl \
    ffmpeg \
    libsndfile1 \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get update && apt-get install -y \
    python3.12 \
    python3.12-venv \
    python3.12-distutils \
    python3.12-dev \
    && rm -rf /var/lib/apt/lists/*
RUN ln -sf /usr/bin/python3.12 /usr/local/bin/python3 && \
    ln -sf /usr/bin/python3.12 /usr/local/bin/python
RUN python3 -m ensurepip && \
    python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel
COPY --from=uv-binary /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN mkdir -p /app/.venv

# CPU Development (with auto-reload)
FROM cpu-base AS cpu-dev
ENV PYTHONUNBUFFERED=1
ENV ENV=development
ENV WORKER_DEVICE_MODE=cpu
RUN uv sync --frozen --no-install-project --group dev
COPY . .
CMD ["uv", "run", "watchmedo", "auto-restart", \
     "--directory=.", \
     "--pattern=*.py", \
     "--recursive", \
     "--", \
     "uv", "run", "main.py"]

# CPU Production
FROM cpu-base AS cpu-prod
ENV WORKER_DEVICE_MODE=cpu
RUN uv sync --frozen
COPY . .
CMD ["uv", "run", "main.py"]

# GPU Development (with auto-reload)
FROM gpu-base AS gpu-dev
ENV PYTHONUNBUFFERED=1
ENV ENV=development
ENV WORKER_DEVICE_MODE=gpu
RUN uv sync --frozen --no-install-project --group dev
RUN uv pip install --force-reinstall torch torchaudio \
    --index-url https://download.pytorch.org/whl/cu124
COPY . .
CMD ["uv", "run", "watchmedo", "auto-restart", \
     "--directory=.", \
     "--pattern=*.py", \
     "--recursive", \
     "--", \
     "uv", "run", "main.py"]

# GPU Production
FROM gpu-base AS gpu-prod
ENV WORKER_DEVICE_MODE=gpu
RUN uv sync --frozen
RUN uv pip install --force-reinstall torch torchaudio \
    --index-url https://download.pytorch.org/whl/cu124
COPY . .
CMD ["uv", "run", "main.py"]