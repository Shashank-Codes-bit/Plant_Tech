"""Offline smoke test, run in CI before every deploy.

The real FastAPI app and the real Anthropic SDK are exercised; MongoDB is replaced by
mongomock and the Claude HTTP API by a mock transport, so no keys or network are needed.
Run: cd backend && python -m pytest -n 0 tests/test_smoke_mocked.py
"""
import base64
import io
import json
import os
import sys
import tempfile
from pathlib import Path

os.environ.update(
    MONGO_URL="mongodb://localhost:27017",
    DB_NAME="smoke",
    APP_API_KEY="smoke-key",
    STORAGE_BACKEND="local",
    LOCAL_STORAGE_DIR=tempfile.mkdtemp(),
)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic  # noqa: E402
import httpx2  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402
from PIL import Image  # noqa: E402

import ai_client  # noqa: E402
import server  # noqa: E402

KEY = {"X-App-Key": "smoke-key"}
PLANT = {"plant_name": "Money Plant", "scientific_name": "Epipremnum aureum", "confidence": 91,
         "alternatives": ["Pothos"], "matched_catalog_name": "Money Plant",
         "suggested_category": "indoor plants"}
INVOICE = {"supplier": "Green Farms", "invoice_number": "GF-12", "date": "12/10/2026", "total": 1250,
           "items": [{"name": "Snake Plant", "quantity": 5, "purchase_price": 200}]}


def _message(text, stop_reason="end_turn", **extra):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": ai_client.MODEL_NAME,
            "content": [{"type": "text", "text": text}], "stop_reason": stop_reason,
            "stop_sequence": None, "usage": {"input_tokens": 1500, "output_tokens": 80}, **extra}


def _fake_claude(handler, max_retries=2):
    transport = httpx2.MockTransport(handler)
    return anthropic.AsyncAnthropic(api_key="test", max_retries=max_retries,
                                    http_client=httpx2.AsyncClient(transport=transport))


def _photo_b64(size=(4000, 3000), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", size, (30, 120, 40)).save(buf, fmt)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def client():
    server.db = AsyncMongoMockClient()["smoke"]
    with TestClient(server.app) as c:
        yield c


@pytest.fixture
def sent():
    """Install a fake Claude that answers like the real API and records each request body."""
    calls = []

    def handler(req):
        body = json.loads(req.content)
        calls.append((dict(req.headers), body))
        return httpx2.Response(200, json=_message(json.dumps(INVOICE if "OCR" in body["system"] else PLANT)))

    ai_client._client = _fake_claude(handler)
    yield calls
    ai_client._client = None


def test_health_is_open(client):
    assert client.get("/health").json() == {"ok": True}


def test_api_requires_app_key(client):
    assert client.get("/api/").status_code == 401
    assert client.get("/api/", headers={"X-App-Key": "wrong"}).status_code == 401
    assert client.get("/api/", headers=KEY).json() == {"message": "NurseryPOS API"}


def test_seeded_products(client):
    products = client.get("/api/products", headers=KEY).json()
    assert any(p["name"] == "Money Plant" for p in products)


def test_identify_plant_request_and_match(client, sent):
    r = client.post("/api/ai/identify-plant", json={"image_base64": "data:image/png;base64," + _photo_b64()},
                    headers=KEY)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["confidence_label"] == "High"
    assert data["matched_product"]["name"] == "Money Plant"
    assert data["suggested_category"] == "Indoor Plants"  # mapped to the real category's spelling

    headers, body = sent[-1]
    assert body["model"] == ai_client.MODEL_NAME
    assert body["output_config"]["effort"] == ai_client.EFFORT_PLANT
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["fallbacks"] == "default"
    assert ai_client.FALLBACK_BETA in headers.get("anthropic-beta", "")
    src = body["messages"][0]["content"][0]["source"]
    assert src["media_type"] == "image/jpeg"
    assert max(Image.open(io.BytesIO(base64.b64decode(src["data"]))).size) <= ai_client.MAX_IMAGE_EDGE


def test_scan_invoice_matches_existing_product(client, sent):
    r = client.post("/api/ai/scan-invoice", json={"image_base64": _photo_b64((800, 1000), "JPEG")}, headers=KEY)
    assert r.status_code == 200, r.text
    item = r.json()["items"][0]
    assert item["matched_name"] == "Snake Plant" and item["product_id"]
    assert sent[-1][1]["output_config"]["effort"] == ai_client.EFFORT_INVOICE


def test_unreadable_image_is_400(client, sent):
    r = client.post("/api/ai/identify-plant", json={"image_base64": "bm90IGFuIGltYWdl"}, headers=KEY)
    assert r.status_code == 400


def test_refusal_returns_unknown_plant(client):
    def refuse(req):
        return httpx2.Response(200, json=_message("I can't help with that.", "refusal",
                                                  stop_details={"type": "refusal", "category": None,
                                                                "explanation": None}))
    ai_client._client = _fake_claude(refuse)
    try:
        r = client.post("/api/ai/identify-plant", json={"image_base64": _photo_b64((200, 200))}, headers=KEY)
    finally:
        ai_client._client = None
    assert r.status_code == 200
    assert r.json()["plant_name"] == "Unknown Plant" and r.json()["confidence_label"] == "Low"


def test_overloaded_claude_is_503(client):
    def busy(req):
        return httpx2.Response(529, json={"type": "error", "error": {"type": "overloaded_error", "message": "busy"}})
    ai_client._client = _fake_claude(busy, max_retries=0)
    try:
        r = client.post("/api/ai/identify-plant", json={"image_base64": _photo_b64((200, 200))}, headers=KEY)
    finally:
        ai_client._client = None
    assert r.status_code == 503


def test_upload_base64_is_shrunk_and_served(client):
    r = client.post("/api/upload-base64", json={"image_base64": _photo_b64()}, headers=KEY)
    assert r.status_code == 200, r.text
    f = client.get(f"/api/files/{r.json()['path']}")
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
    assert max(Image.open(io.BytesIO(f.content)).size) <= ai_client.MAX_IMAGE_EDGE


def test_upload_rejects_non_images(client):
    html = base64.b64encode(b"<html>not a photo</html>").decode()
    assert client.post("/api/upload-base64", json={"image_base64": html}, headers=KEY).status_code == 400
    r = client.post("/api/upload", files={"file": ("a.jpg", b"<html>", "image/jpeg")}, headers=KEY)
    assert r.status_code == 400


def test_upload_then_fetch_without_key(client):
    jpg = io.BytesIO()
    Image.new("RGB", (50, 50)).save(jpg, "JPEG")
    r = client.post("/api/upload", files={"file": ("a.jpg", jpg.getvalue(), "image/jpeg")}, headers=KEY)
    assert r.status_code == 200, r.text
    f = client.get(f"/api/files/{r.json()['path']}")
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
