FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn httpx cryptography PyJWT mcp

COPY agent/ agent/
COPY server/ server/
COPY config.py serve_ui.py ./
COPY ui/out/ static/

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "serve_ui:app", "--host", "0.0.0.0", "--port", "8080"]
