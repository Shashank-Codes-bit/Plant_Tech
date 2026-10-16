"""AI requests (shape, refusals, outages, daily limit) and photo uploads."""
import base64
import io

import httpx2
from PIL import Image

import ai_client
from conftest import Shop, claude_message, fake_claude_client, photo_b64


def test_identify_request_and_match(client, claude):
    shop = Shop(client)
    shop.product("Money Plant", 250, 10)
    r = shop.post("/api/ai/identify-plant", {"image_base64": "data:image/png;base64," + photo_b64((4000, 3000), "PNG")})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["matched_product"]["name"] == "Money Plant" and data["confidence_label"] == "High"
    assert data["suggested_category"] == "Indoor Plants" and data["suggested_category_id"] == shop.cat["Indoor Plants"]
    headers, body = claude[-1]
    assert body["model"] == ai_client.MODEL_NAME and body["fallbacks"] == "default"
    assert body["output_config"]["effort"] == ai_client.EFFORT_PLANT
    assert ai_client.FALLBACK_BETA in headers.get("anthropic-beta", "")
    src = body["messages"][0]["content"][0]["source"]
    assert src["media_type"] == "image/jpeg"
    assert max(Image.open(io.BytesIO(base64.b64decode(src["data"]))).size) <= ai_client.MAX_IMAGE_EDGE


def test_scan_invoice_matches_products(client, claude):
    shop = Shop(client)
    p = shop.product("Snake Plant", 450, 1)
    item = shop.post("/api/ai/scan-invoice", {"image_base64": photo_b64()}).json()["items"][0]
    assert item["product_id"] == p["id"]


def test_daily_ai_limit(client, claude):
    shop = Shop(client)
    codes = [shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))}).status_code
             for _ in range(6)]
    assert codes == [200] * 5 + [429]  # AI_DAILY_LIMIT=5 in tests


def test_bad_image_refusal_and_outage(client, claude):
    shop = Shop(client)
    assert shop.post("/api/ai/identify-plant", {"image_base64": "bm90IGFuIGltYWdl"}).status_code == 400

    ai_client._client = fake_claude_client(lambda req: httpx2.Response(200, json=claude_message(
        "I can't help with that.", "refusal", stop_details={"type": "refusal", "category": None, "explanation": None})))
    r = shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))})
    assert r.status_code == 200 and r.json()["plant_name"] == "Unknown Plant"

    ai_client._client = fake_claude_client(lambda req: httpx2.Response(
        529, json={"type": "error", "error": {"type": "overloaded_error", "message": "busy"}}), max_retries=0)
    assert shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))}).status_code == 503


def test_uploads(client):
    shop = Shop(client)
    r = shop.post("/api/upload-base64", {"image_base64": photo_b64((4000, 3000))})
    path = r.json()["path"]
    assert f"/shops/{client.get('/api/auth/me', headers=shop.h).json()['business']['id']}/" in path
    f = client.get(f"/api/files/{path}")  # no login needed to show a photo
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
    assert max(Image.open(io.BytesIO(f.content)).size) <= ai_client.MAX_IMAGE_EDGE
    html = base64.b64encode(b"<html>not a photo</html>").decode()
    assert shop.post("/api/upload-base64", {"image_base64": html}).status_code == 400
    assert client.post("/api/upload-base64", json={"image_base64": photo_b64()}).status_code == 401
