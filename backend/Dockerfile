FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8001
# Only the VM's Caddy can reach the published port (bound to 127.0.0.1), but inside
# Docker its requests arrive from the bridge gateway, so trust forwarded headers from any peer.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'"]
