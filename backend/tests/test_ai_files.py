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
    assert r.status_code == 422 and r.json()["code"] == "not_identified"

    ai_client._client = fake_claude_client(lambda req: httpx2.Response(
        529, json={"type": "error", "error": {"type": "overloaded_error", "message": "busy"}}), max_retries=0)
    assert shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))}).status_code == 503


def test_scans_given_back_when_claude_is_not_reached(client, claude):
    shop = Shop(client)
    normal = ai_client._client
    shop.post("/api/ai/identify-plant", {"image_base64": "bm90IGFuIGltYWdl"})  # unreadable photo
    ai_client._client = fake_claude_client(lambda req: httpx2.Response(
        529, json={"type": "error", "error": {"type": "overloaded_error", "message": "busy"}}), max_retries=0)
    for _ in range(5):
        assert shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))}).status_code == 503
    ai_client._client = normal
    # AI_DAILY_LIMIT is 5 in tests: none of the six failed scans used it up.
    assert shop.post("/api/ai/identify-plant", {"image_base64": photo_b64((200, 200))}).status_code == 200


def test_identify_refuses_things_a_nursery_does_not_sell(client, claude):
    shop = Shop(client)
    shop.product("Money Plant", 250, 10)
    claude.plant = {**claude.plant, "kind": "other", "reason": "a laptop", "plant_name": "",
                    "matched_catalog_name": "", "alternatives": []}
    r = shop.post("/api/ai/identify-plant", {"image_base64": photo_b64()})
    assert r.status_code == 422 and r.json()["code"] == "not_nursery_item"
    assert "does not appear to show a plant" in r.json()["detail"]
    claude.plant = {**claude.plant, "kind": "bill", "reason": "an invoice"}
    r = shop.post("/api/ai/identify-plant", {"image_base64": photo_b64()})
    assert r.status_code == 422 and r.json()["code"] == "looks_like_bill"


def test_identify_matches_whole_words_only(client, claude):
    shop = Shop(client)
    pothos = shop.product("Pothos", 150, 4)
    shop.product("Primrose", 90, 4)
    claude.plant = {**claude.plant, "kind": "nursery_product", "plant_name": "Pot", "scientific_name": "",
                    "alternatives": [], "matched_catalog_name": ""}
    r = shop.post("/api/ai/identify-plant", {"image_base64": photo_b64()}).json()
    assert r["matched_product"] is None and r["similar_products"] == []
    claude.plant = {**claude.plant, "kind": "plant", "plant_name": "Golden Pothos", "matched_catalog_name": ""}
    r = shop.post("/api/ai/identify-plant", {"image_base64": photo_b64()}).json()
    assert r["matched_product"]["id"] == pothos["id"]


def test_best_product_unit():
    from search import best_product
    products = [{"id": "1", "name": "Snake Plant 6 inch"}, {"id": "2", "name": "Snake Plant 8 inch"},
                {"id": "3", "name": "Rose", "botanical_name": "Rosa"}, {"id": "4", "name": "Terracotta Pot"}]
    assert best_product(products, ["Primrose"])[0] is None
    assert best_product(products, ["Rosa"])[0]["id"] == "3"  # exact botanical name
    match, similar = best_product(products, ["Snake Plant"])
    assert match is None and {p["id"] for p in similar} == {"1", "2"}  # two sizes: ask, don't guess
    assert best_product(products, ['Terracotta Pot 8"'])[0]["id"] == "4"


def test_scan_invoice_refuses_a_photo_that_is_not_a_bill(client, claude):
    shop = Shop(client)
    claude.invoice = {**claude.invoice, "is_bill": False, "reason": "a plant", "supplier": "", "items": []}
    r = shop.post("/api/ai/scan-invoice", {"image_base64": photo_b64()})
    assert r.status_code == 422 and r.json()["code"] == "not_a_bill"


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
