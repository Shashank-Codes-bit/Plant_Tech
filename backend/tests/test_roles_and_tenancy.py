"""Workers only do what the owner allowed; one shop never sees another shop's data."""
from conftest import Shop


def test_worker_permissions(client):
    shop = Shop(client)
    shop.product("Money Plant", 250, 10)
    _, wh = shop.worker()
    me = client.get("/api/auth/me", headers=wh).json()
    assert me["role"] == "worker" and me["permissions"]["reports"] is False
    assert client.get("/api/staff", headers=wh).status_code == 403
    assert client.get("/api/reports/sales", headers=wh).status_code == 403
    assert client.put("/api/business", headers=wh, json={"name": "X"}).status_code == 403
    products = client.get("/api/products", headers=wh).json()
    assert "cost_price" not in products[0]  # workers never see cost prices
    pid = products[0]["id"]
    r = client.post("/api/invoices", headers=wh, json={"items": [{"product_id": pid, "name": "Money Plant",
                                                                    "quantity": 1, "price": 250}], "customer_phone": "9811100099", "customer_name": "Test Customer"})
    assert r.status_code == 200 and r.json()["created_by"]["name"] == "Ramesh"


def test_worker_without_stock_permission_cannot_add_products(client):
    shop = Shop(client)
    _, wh = shop.worker(stock=False)
    r = client.post("/api/products", headers=wh, json={"name": "Rose", "selling_price": 100})
    assert r.status_code == 403


def test_switching_off_or_new_pin_logs_worker_out(client):
    shop = Shop(client)
    wid, wh = shop.worker()
    assert client.patch(f"/api/staff/{wid}", headers=shop.h, json={"password": "9999"}).status_code == 200
    assert client.get("/api/auth/me", headers=wh).status_code == 401
    assert client.post("/api/auth/login", json={"phone": "9822233445", "password": "9999"}).status_code == 200
    client.patch(f"/api/staff/{wid}", headers=shop.h, json={"active": False})
    assert client.post("/api/auth/login", json={"phone": "9822233445", "password": "9999"}).status_code == 403


def test_shops_are_isolated(client):
    a = Shop(client, phone="9811122334", name="Asha")
    b = Shop(client, phone="9811155667", name="Bina")
    pa = a.product("Money Plant", 250, 5)
    a.post("/api/invoices", {"items": [{"product_id": pa["id"], "name": "Money Plant", "quantity": 1, "price": 250}],
                             "customer_phone": "9876501234", "customer_name": "Anita"})
    assert b.get("/api/products").json() == []
    assert b.get("/api/customers").json() == []
    assert b.get("/api/invoices").json() == []
    assert b.get(f"/api/products/{pa['id']}").status_code == 404
    # B can't sell A's product, and A's stock is untouched by the attempt
    r = b.post("/api/invoices", {"items": [{"product_id": pa["id"], "name": "x", "quantity": 1, "price": 1}], "customer_phone": "9811100099", "customer_name": "Test Customer"})
    assert r.status_code == 400
    assert a.get(f"/api/products/{pa['id']}").json()["stock"] == 4
    # a worker of B can't edit A's categories either
    assert client.patch(f"/api/categories/{a.cat['Pots']}", headers=b.h, json={"gst_percent": 5}).status_code == 404


def test_worker_sees_only_own_orders(client):
    shop = Shop(client)
    p = shop.product("Money Plant", 250, 10)
    _, wh = shop.worker()
    line = {"items": [{"product_id": p["id"], "name": "Money Plant", "quantity": 1, "price": 250}], "customer_phone": "9811100099", "customer_name": "Test Customer"}
    shop.post("/api/invoices", line)
    client.post("/api/invoices", headers=wh, json=line)
    assert len(shop.get("/api/invoices").json()) == 2
    assert len(client.get("/api/invoices", headers=wh).json()) == 1
    assert shop.get("/api/dashboard/today").json()["orders"] == 2
    mine = client.get("/api/dashboard/today", headers=wh).json()
    assert mine["scope"] == "mine" and mine["orders"] == 1
