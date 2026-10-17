"""Products, stock, categories with GST, and the shared picture library."""
from conftest import Shop, photo_b64


def test_starter_library_and_suggestions(client):
    shop = Shop(client)
    s = shop.get("/api/products/suggest", params={"q": "money"}).json()
    assert s["own"] == [] and s["library"][0]["name"] == "Money Plant"
    assert shop.get("/api/products/suggest", params={"q": "गुलाब"}).json()["library"][0]["name"] == "Rose"
    lib_id = s["library"][0]["id"]
    p = shop.post("/api/products", {"name": "Money Plant", "library_id": lib_id, "selling_price": 250}).json()
    assert p["category"] == "Indoor Plants"  # picked from the library's default category
    s = shop.get("/api/products/suggest", params={"q": "money"}).json()
    assert [x["name"] for x in s["own"]] == ["Money Plant"]
    assert "Money Plant" not in [x["name"] for x in s["library"]]  # already yours; "Jade Plant" (money tree) may stay


def test_first_shop_photo_becomes_shared_picture(client):
    a = Shop(client, phone="9811122334")
    b = Shop(client, phone="9811155667")
    lib_id = a.get("/api/products/suggest", params={"q": "tulsi"}).json()["library"][0]["id"]
    photo = a.post("/api/upload-base64", {"image_base64": photo_b64()}).json()["path"]
    a.post("/api/products", {"name": "Tulsi", "library_id": lib_id, "photo_path": photo, "selling_price": 60})
    mine = a.get("/api/products/suggest", params={"q": "tulsi"}).json()
    assert mine["own"][0]["image_source"] == "own"
    # Shop B sees the shared picture only after an app admin has checked it.
    entry = b.get("/api/products/suggest", params={"q": "tulsi"}).json()["library"][0]
    assert entry["image_status"] == "none" and entry["image_path"] is None
    pb = b.post("/api/products", {"name": "Tulsi", "library_id": lib_id, "selling_price": 70}).json()
    assert pb["image_source"] is None
    admin = Shop(client, phone="9000000001")
    live = admin.post(f"/api/admin/library/{lib_id}/approve").json()
    assert live["image_status"] == "live" and live["image_path"]
    pb = b.get(f"/api/products/{pb['id']}").json()
    assert pb["image_source"] == "library" and pb["image_path"] == live["image_path"]
    assert client.get(f"/api/files/{live['image_path']}").status_code == 200


def test_new_product_starts_a_library_entry(client):
    a = Shop(client, phone="9811122334")
    b = Shop(client, phone="9811155667")
    a.product("Ceramic Pot 10 inch", 150, 4, category="Pots")
    assert b.get("/api/products/suggest", params={"q": "ceramic"}).json()["library"][0]["name"] == "Ceramic Pot 10 inch"


def test_zero_stock_products_stay_listed(client):
    shop = Shop(client)
    p = shop.product("Ficus Bonsai", 899, 0)
    listed = shop.get("/api/products").json()
    assert listed[0]["id"] == p["id"] and listed[0]["out_of_stock"] is True
    assert [x["id"] for x in shop.get("/api/products", params={"low": True}).json()] == [p["id"]]
    r = shop.post(f"/api/products/{p['id']}/stock", {"change": 6, "reason": "Supplier"})
    assert r.json()["stock"] == 6
    assert shop.post(f"/api/products/{p['id']}/stock", {"change": -10}).status_code == 400  # never below 0


def test_categories_gst_rules(client):
    shop = Shop(client)
    pots = shop.cat["Pots"]
    assert client.patch(f"/api/categories/{pots}", headers=shop.h, json={"gst_percent": 7}).status_code == 400
    assert client.patch(f"/api/categories/{pots}", headers=shop.h, json={"gst_percent": 12}).json()["gst_percent"] == 12
    assert client.patch(f"/api/categories/{pots}", headers=shop.h, json={"gst_percent": 40}).json()["gst_percent"] == 40
    shop.product("Clay Pot", 120, 3, category="Pots")
    assert client.delete(f"/api/categories/{pots}", headers=shop.h).status_code == 400  # still used
    cats = {c["name"]: c for c in shop.get("/api/categories").json()}
    assert cats["Pots"]["product_count"] == 1


def test_admin_library_needs_admin(client):
    shop = Shop(client)
    assert shop.get("/api/admin/library").status_code == 403
    admin = Shop(client, phone="9000000001", name="Admin")
    entries = admin.get("/api/admin/library", params={"status": "none"}).json()
    assert len(entries) == 10
    eid = entries[0]["id"]
    r = admin.post(f"/api/admin/library/{eid}/photo", {"image_base64": photo_b64()})
    assert r.json()["image_status"] == "live"
    assert client.delete(f"/api/admin/library/{eid}/photo", headers=admin.h).json()["image_status"] == "none"
