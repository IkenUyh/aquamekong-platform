# ========================
# Build Stage — cài dependencies vào venv
# ========================
FROM python:3.12-slim AS build

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# torch bản CPU (~200MB) thay vì bản CUDA mặc định (~2-3GB); cài trước để requirements không kéo bản CUDA
RUN pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.2.0"

COPY requirements.txt .
RUN pip install -r requirements.txt

# ========================
# Runtime Stage
# ========================
FROM python:3.12-slim

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MPLCONFIGDIR=/tmp/matplotlib

RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app

WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY --chown=app:app app/ app/
COPY --chown=app:app scripts/ scripts/

# Thư mục model (mount volume ml_models) phải thuộc user app
RUN mkdir -p /app/trained_models /app/data/inbox && chown -R app:app /app/trained_models /app/data

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
