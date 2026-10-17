"""Shared test setup: the real app on an in-memory MongoDB, local photo storage and a fake Claude.

No network, no keys. Run: cd backend && python -m pytest
"""
import base64
import io
import json
import os
import sys
import tempfile
from pathlib import Path

os.environ.update(
    MONGO_URL="mongodb://localhost:27017", DB_NAME="test", STORAGE_BACKEND="local",
    LOCAL_STORAGE_DIR=tempfile.mkdtemp(), JWT_SECRET="test-secret-0123456789-abcdefghijklmnop",
    ADMIN_PHONES="9000000001", AI_DAILY_LIMIT="5", PUBLIC_BASE_URL="https://pos.test",
)
os.environ.pop("GOOGLE_CLIENT_IDS", None)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic  # noqa: E402
import httpx2  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402
from PIL import Image  # noqa: E402

import ai_client  # noqa: E402
import db as db_module  # noqa: E402
import server  # noqa: E402

PLANT = {"kind": "plant", "reason": "a potted plant", "plant_name": "Money Plant", "scientific_name": "Epipremnum aureum", "confidence": 91,
         "alternatives": ["Pothos"], "matched_catalog_name": "Money Plant", "suggested_category": "indoor plants"}
INVOICE = {"is_bill": True, "reason": "a printed invoice", "same_supplier": True, "same_bill": True,
           "pages": [{"page": 1, "is_bill": True, "supplier": "Green Farms", "supplier_gstin": "", "invoice_number": "GF-12"}],
           "supplier": "Green Farms", "supplier_phone": "98111 00000", "supplier_address": "Sohna Road, Gurugram",
           "supplier_gstin": "", "invoice_number": "GF-12", "date": "12/10/2026", "total": 1250,
           "items": [{"name": "Snake Plant", "quantity": 5, "purchase_price": 200}]}


@pytest.fixture
def client():
    """A fresh, empty app per test."""
    db_module.state.db = AsyncMongoMockClient()["test"]
    with TestClient(server.app) as c:
        yield c
    db_module.state.db = None


def claude_message(text, stop_reason="end_turn", **extra):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": ai_client.MODEL_NAME,
            "content": [{"type": "text", "text": text}], "stop_reason": stop_reason,
            "stop_sequence": None, "usage": {"input_tokens": 1500, "output_tokens": 80}, **extra}


def fake_claude_client(handler, max_retries=2):
    return anthropic.AsyncAnthropic(api_key="test", max_retries=max_retries,
                                    http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)))


class FakeClaude(list):
    """The (headers, body) of each request sent; set .plant / .invoice to change what it answers."""

    def __init__(self):
        super().__init__()
        self.plant, self.invoice = dict(PLANT), dict(INVOICE)


@pytest.fixture
def claude():
    """Fake Claude that answers like the real API."""
    calls = FakeClaude()

    def handler(req):
        body = json.loads(req.content)
        calls.append((dict(req.headers), body))
        reply = calls.invoice if body["system"] == ai_client.SYSTEM_INVOICE else calls.plant
        return httpx2.Response(200, json=claude_message(json.dumps(reply)))

    ai_client._client = fake_claude_client(handler)
    yield calls
    ai_client._client = None


def photo_b64(size=(1200, 900), fmt="JPEG", color=(30, 120, 40)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return base64.b64encode(buf.getvalue()).decode()


class Shop:
    """An owner logged in to a shop that finished setup, with helpers for common calls."""

    def __init__(self, client, phone="9811122334", name="Suresh", gst=True):
        self.c = client
        r = client.post("/api/auth/register", json={"name": name, "phone": phone, "password": "secret123"})
        assert r.status_code == 200, r.text
        self.token = r.json()["token"]
        self.h = {"Authorization": f"Bearer {self.token}"}
        r = client.put("/api/business", headers=self.h, json={
            "name": f"{name}'s Nursery", "address": "Sector 5", "phone": phone, "gst_registered": gst,
            "gstin": "06abcde1234f1z5" if gst else "", "upi_id": "shop@upi", "onboarding_done": True})
        assert r.status_code == 200, r.text
        cats = client.post("/api/categories/bulk", headers=self.h, json={"items": [
            {"name": "Indoor Plants", "gst_percent": 0}, {"name": "Pots", "gst_percent": 18}]}).json()
        self.cat = {c["name"]: c["id"] for c in cats}

    def get(self, url, **kw):
        return self.c.get(url, headers=self.h, **kw)

    def post(self, url, json=None, **kw):
        return self.c.post(url, headers=self.h, json=json, **kw)

    def product(self, name, price, stock, category="Indoor Plants", **extra):
        r = self.post("/api/products", {"name": name, "selling_price": price, "stock": stock,
                                        "category_id": self.cat.get(category), **extra})
        assert r.status_code == 200, r.text
        return r.json()

    def worker(self, phone="9822233445", pin="4821", **perms):
        r = self.post("/api/staff", {"name": "Ramesh", "phone": phone, "password": pin,
                                     "permissions": {"sell": True, "stock": True, "customers": True,
                                                     "reports": False, **perms}})
        assert r.status_code == 200, r.text
        login = self.c.post("/api/auth/login", json={"phone": phone, "password": pin})
        assert login.status_code == 200, login.text
        return r.json()["id"], {"Authorization": f"Bearer {login.json()['token']}"}
