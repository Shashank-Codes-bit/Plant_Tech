# NurseryPOS backend tests - comprehensive API coverage
import os
import base64
import time
import io
import pytest
import requests
from pathlib import Path

API = None


@pytest.fixture(scope="module", autouse=True)
def _setup_api(base_url):
    global API
    API = f"{base_url}/api"


# ---------------- helpers ----------------
def _real_plant_image_b64():
    """Fetch a real plant photo and return raw base64 (no data: prefix)."""
    url = "https://images.pexels.com/photos/1005058/pexels-photo-1005058.jpeg?auto=compress&cs=tinysrgb&w=640"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return base64.b64encode(r.content).decode("ascii")


def _real_receipt_image_b64():
    url = "https://images.pexels.com/photos/6169668/pexels-photo-6169668.jpeg?auto=compress&cs=tinysrgb&w=640"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return base64.b64encode(r.content).decode("ascii")


# ---------------- Root / Health ----------------
class TestRoot:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------------- Business ----------------
class TestBusiness:
    def test_get_business(self, api_client):
        r = api_client.get(f"{API}/business")
        assert r.status_code == 200
        # can be null or dict

    def test_save_business(self, api_client):
        payload = {"business_name": "TEST_Green Nursery", "owner_name": "TEST_Owner",
                   "phone": "9999999999", "tax_enabled": False}
        r = api_client.post(f"{API}/business", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["business_name"] == "TEST_Green Nursery"

        # verify persistence
        r2 = api_client.get(f"{API}/business")
        assert r2.status_code == 200
        assert r2.json()["business_name"] == "TEST_Green Nursery"


# ---------------- Categories ----------------
class TestCategories:
    def test_list_categories(self, api_client):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) >= 1  # seeded

    def test_create_and_delete_category(self, api_client):
        r = api_client.post(f"{API}/categories", json={"name": "TEST_Category"})
        assert r.status_code == 200
        cid = r.json()["id"]
        # duplicate should 400
        r2 = api_client.post(f"{API}/categories", json={"name": "TEST_Category"})
        assert r2.status_code == 400
        # delete
        r3 = api_client.delete(f"{API}/categories/{cid}")
        assert r3.status_code == 200


# ---------------- Products ----------------
class TestProducts:
    def test_list_products_seeded(self, api_client):
        r = api_client.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert isinstance(prods, list)
        assert len(prods) >= 1
        assert "sku" in prods[0]
        assert "stock" in prods[0]

    def test_search_and_low_stock(self, api_client):
        r = api_client.get(f"{API}/products", params={"search": "plant"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        r2 = api_client.get(f"{API}/products", params={"low_stock": "true"})
        assert r2.status_code == 200
        for p in r2.json():
            assert p["stock"] <= p["min_stock"]

    def test_create_get_update_adjust_history(self, api_client):
        payload = {"name": "TEST_ProductX", "category": "Indoor Plants",
                   "cost_price": 50, "selling_price": 100, "stock": 10, "min_stock": 2}
        r = api_client.post(f"{API}/products", json=payload)
        assert r.status_code == 200
        p = r.json()
        pid = p["id"]
        assert p["sku"].startswith("NP-")
        assert p["stock"] == 10

        # GET
        r2 = api_client.get(f"{API}/products/{pid}")
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_ProductX"

        # UPDATE (should not change stock)
        r3 = api_client.put(f"{API}/products/{pid}", json={
            "name": "TEST_ProductX_v2", "selling_price": 120, "stock": 999,
            "cost_price": 50, "min_stock": 2
        })
        assert r3.status_code == 200
        assert r3.json()["name"] == "TEST_ProductX_v2"
        assert r3.json()["stock"] == 10  # stock unchanged via PUT

        # ADJUST
        r4 = api_client.post(f"{API}/products/{pid}/adjust-stock",
                             json={"change": 5, "reason": "TEST_correction"})
        assert r4.status_code == 200
        assert r4.json()["stock"] == 15

        # HISTORY
        r5 = api_client.get(f"{API}/products/{pid}/history")
        assert r5.status_code == 200
        body = r5.json()
        assert "stock_history" in body and "sales_history" in body
        assert any(h["type"] == "adjustment" for h in body["stock_history"])

    def test_get_missing_product_404(self, api_client):
        r = api_client.get(f"{API}/products/nonexistent-id")
        assert r.status_code == 404


# ---------------- Customers ----------------
class TestCustomers:
    def test_create_get_list_customer(self, api_client):
        r = api_client.post(f"{API}/customers",
                            json={"name": "TEST_Cust", "phone": "8888888888"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["total_purchases"] == 0
        assert r.json()["purchase_count"] == 0

        r2 = api_client.get(f"{API}/customers/{cid}")
        assert r2.status_code == 200
        assert "invoices" in r2.json()

        r3 = api_client.get(f"{API}/customers", params={"search": "TEST_Cust"})
        assert r3.status_code == 200
        assert any(c["id"] == cid for c in r3.json())


# ---------------- Invoices / Sales ----------------
class TestInvoices:
    def test_create_invoice_and_stock_decrement(self, api_client):
        # Create a fresh product with known stock
        p = api_client.post(f"{API}/products", json={
            "name": "TEST_SaleProd", "cost_price": 10, "selling_price": 100,
            "stock": 20, "min_stock": 2
        }).json()
        pid = p["id"]

        # Create a customer to verify purchase counters
        cust = api_client.post(f"{API}/customers", json={"name": "TEST_InvCust"}).json()

        r = api_client.post(f"{API}/invoices", json={
            "items": [{"product_id": pid, "name": p["name"], "quantity": 3, "price": 100}],
            "customer_id": cust["id"], "customer_name": cust["name"],
            "payment_method": "Cash",
        })
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["invoice_number"].startswith("INV-")
        assert inv["grand_total"] == 300
        assert inv["status"] == "Paid"

        # verify stock decreased
        after = api_client.get(f"{API}/products/{pid}").json()
        assert after["stock"] == 17

        # verify customer counters incremented
        cust2 = api_client.get(f"{API}/customers/{cust['id']}").json()
        assert cust2["purchase_count"] == 1
        assert cust2["total_purchases"] == 300
        assert len(cust2["invoices"]) == 1

        # get invoice by id
        r2 = api_client.get(f"{API}/invoices/{inv['id']}")
        assert r2.status_code == 200

        # list invoices
        r3 = api_client.get(f"{API}/invoices")
        assert r3.status_code == 200
        assert any(i["id"] == inv["id"] for i in r3.json())

    def test_insufficient_stock_400_and_rollback(self, api_client):
        # product A with 5 stock, product B with 1 stock
        pA = api_client.post(f"{API}/products", json={
            "name": "TEST_RollA", "selling_price": 10, "stock": 5, "min_stock": 1
        }).json()
        pB = api_client.post(f"{API}/products", json={
            "name": "TEST_RollB", "selling_price": 10, "stock": 1, "min_stock": 1
        }).json()

        r = api_client.post(f"{API}/invoices", json={
            "items": [
                {"product_id": pA["id"], "name": pA["name"], "quantity": 2, "price": 10},
                {"product_id": pB["id"], "name": pB["name"], "quantity": 5, "price": 10},
            ],
            "payment_method": "Cash",
        })
        assert r.status_code == 400

        # verify rollback - A stock must still be 5
        A2 = api_client.get(f"{API}/products/{pA['id']}").json()
        B2 = api_client.get(f"{API}/products/{pB['id']}").json()
        assert A2["stock"] == 5, f"rollback failed, A={A2['stock']}"
        assert B2["stock"] == 1

    def test_empty_cart_400(self, api_client):
        r = api_client.post(f"{API}/invoices", json={"items": [], "payment_method": "Cash"})
        assert r.status_code == 400


# ---------------- Purchases ----------------
class TestPurchases:
    def test_purchase_increases_stock_and_creates_new(self, api_client):
        # existing product
        p = api_client.post(f"{API}/products", json={
            "name": "TEST_PurchProd", "selling_price": 100, "stock": 5, "min_stock": 2
        }).json()

        r = api_client.post(f"{API}/purchases", json={
            "supplier": "TEST_Supplier", "invoice_number": "TEST-INV-99",
            "items": [
                {"product_id": p["id"], "name": p["name"], "quantity": 10,
                 "purchase_price": 40},
                {"product_id": None, "name": "TEST_NewFromPurchase",
                 "quantity": 7, "purchase_price": 30, "category": "Pots"},
            ],
            "total": 610,
        })
        assert r.status_code == 200, r.text

        # existing product stock increased
        after = api_client.get(f"{API}/products/{p['id']}").json()
        assert after["stock"] == 15
        assert after["cost_price"] == 40

        # new product created
        listing = api_client.get(f"{API}/products",
                                 params={"search": "TEST_NewFromPurchase"}).json()
        assert any(x["name"] == "TEST_NewFromPurchase" and x["stock"] == 7 for x in listing)


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_summary(self, api_client):
        r = api_client.get(f"{API}/dashboard/summary")
        assert r.status_code == 200
        data = r.json()
        assert "today" in data
        today = data["today"]
        for k in ("sales", "bills", "items_sold", "cash_collected"):
            assert k in today
        assert "low_stock" in data
        assert "low_stock_count" in data
        assert "total_products" in data
        assert data["total_products"] >= 1


# ---------------- Upload / Files ----------------
class TestUpload:
    def test_upload_and_retrieve(self, api_client):
        # tiny valid JPEG (2x2)
        import struct
        # use a real image from an asset if exists
        content = None
        for candidate in ["/app/frontend/assets/images/icon.png"]:
            if Path(candidate).exists():
                content = Path(candidate).read_bytes()
                fname = "icon.png"
                ctype = "image/png"
                break
        if content is None:
            # 1x1 png
            content = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            )
            fname = "px.png"
            ctype = "image/png"

        files = {"file": (fname, content, ctype)}
        r = requests.post(f"{API}/upload", files=files, timeout=60)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        assert path

        # retrieve
        r2 = requests.get(f"{API}/files/{path}", timeout=60)
        assert r2.status_code == 200
        assert len(r2.content) > 0


# ---------------- AI ----------------
class TestAI:
    def test_identify_plant(self, api_client):
        img = _real_plant_image_b64()
        r = api_client.post(f"{API}/ai/identify-plant",
                            json={"image_base64": img}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plant_name" in data
        assert "confidence" in data
        assert 0 <= data["confidence"] <= 100
        assert data["confidence_label"] in ("High", "Medium", "Low")
        assert "alternatives" in data
        assert "matched_catalog_name" in data
        assert "matched_product" in data  # can be null

    def test_scan_invoice(self, api_client):
        img = _real_receipt_image_b64()
        r = api_client.post(f"{API}/ai/scan-invoice",
                            json={"image_base64": img}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("supplier", "invoice_number", "date", "total", "items"):
            assert k in data
        for it in data["items"]:
            assert "name" in it
            assert "quantity" in it
            assert "purchase_price" in it
            assert "product_id" in it
            assert "matched_name" in it
