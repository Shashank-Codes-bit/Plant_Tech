"""Bills: tax-inclusive GST, stock, customers, reports, and the customer's bill link."""
import invoice_html
from conftest import Shop, photo_b64


def _order(shop, items, **extra):
    extra.setdefault("customer_phone", "9811100099")  # every bill needs a customer
    extra.setdefault("customer_name", "Test Customer")
    return shop.post("/api/invoices", {"items": items, **extra})


def test_gst_is_inside_the_price(client):
    shop = Shop(client, gst=True)
    plant = shop.product("Money Plant", 250, 10)
    pot = shop.product("Ceramic Pot", 150, 5, category="Pots")
    inv = _order(shop, [{"product_id": plant["id"], "name": "Money Plant", "quantity": 2, "price": 250},
                        {"product_id": pot["id"], "name": "Ceramic Pot", "quantity": 1, "price": 150}],
                 payment_method="UPI").json()
    assert inv["grand_total"] == 650  # prices already include GST
    assert inv["gst_breakup"] == [{"rate": 18, "taxable": 127.12, "tax": 22.88}]
    assert inv["gst_total"] == 22.88
    assert shop.get(f"/api/products/{plant['id']}").json()["stock"] == 8


def test_discount_is_spread_before_tax(client):
    shop = Shop(client, gst=True)
    pot = shop.product("Pot", 118, 5, category="Pots")
    inv = _order(shop, [{"product_id": pot["id"], "name": "Pot", "quantity": 1, "price": 118}], discount=18).json()
    assert inv["grand_total"] == 100 and inv["gst_breakup"][0]["tax"] == 15.25


def test_no_gst_when_not_registered(client):
    shop = Shop(client, gst=False)
    pot = shop.product("Pot", 150, 5, category="Pots")
    inv = _order(shop, [{"product_id": pot["id"], "name": "Pot", "quantity": 1, "price": 150}]).json()
    assert inv["gst_total"] == 0 and inv["gst_breakup"] == []


def test_not_enough_stock_changes_nothing(client):
    shop = Shop(client)
    a = shop.product("Money Plant", 250, 5)
    b = shop.product("Snake Plant", 450, 1)
    r = _order(shop, [{"product_id": a["id"], "name": "Money Plant", "quantity": 2, "price": 250},
                      {"product_id": b["id"], "name": "Snake Plant", "quantity": 3, "price": 450}])
    assert r.status_code == 400 and "Only 1 Snake Plant left" in r.json()["detail"]
    assert shop.get(f"/api/products/{a['id']}").json()["stock"] == 5  # rolled back


def test_loose_item_and_customer_by_phone(client):
    shop = Shop(client)
    inv = _order(shop, [{"product_id": None, "name": "Hibiscus", "quantity": 1, "price": 280}],
                 customer_phone="98111 22334", customer_name="Anita").json()
    assert inv["customer_phone"] == "+919811122334" and inv["customer_name"] == "Anita"
    _order(shop, [{"product_id": None, "name": "Rose", "quantity": 1, "price": 100}], customer_phone="9811122334")
    found = shop.get("/api/customers/lookup", params={"phone": "+91 98111 22334"}).json()
    assert found == {"found": True, "name": "Anita", "purchase_count": 2}
    assert shop.get("/api/customers").json()[0]["total_purchases"] == 380


def test_share_link_and_public_bill(client):
    shop = Shop(client, gst=True)
    pot = shop.product("Pot <b>big</b>", 150, 2, category="Pots")
    inv = _order(shop, [{"product_id": pot["id"], "name": "Pot <b>big</b>", "quantity": 1, "price": 150}],
                 customer_name="<script>x</script>").json()
    link = shop.get(f"/api/invoices/{inv['id']}/share").json()
    assert link["url"] == f"https://pos.test/i/{link['token']}"
    page = client.get(f"/i/{link['token']}")
    assert page.status_code == 200 and "₹150" in page.text and "Includes GST 18%" in page.text
    assert "<script>x" not in page.text and "&lt;script&gt;" in page.text  # escaped
    assert page.headers["x-robots-tag"] == "noindex"
    assert client.get("/i/not-a-real-token-123456").status_code == 404


def test_shop_logo_on_bill_and_in_login(client):
    shop = Shop(client)
    logo = shop.post("/api/upload-base64", {"image_base64": photo_b64(size=(900, 300))}).json()["path"]
    assert client.put("/api/business", headers=shop.h, json={"logo_path": logo}).status_code == 200
    assert shop.get("/api/auth/me").json()["business"]["logo_path"] == logo
    inv = _order(shop, [{"product_id": None, "name": "Seeds", "quantity": 1, "price": 20}]).json()
    token = shop.get(f"/api/invoices/{inv['id']}/share").json()["token"]
    for page in (client.get(f"/i/{token}").text, shop.get(f"/api/invoices/{inv['id']}/html").text):
        assert '<img class="logo" src="data:image/jpeg;base64,' in page


def test_search_with_special_characters(client):
    shop = Shop(client)
    _order(shop, [{"product_id": None, "name": "Seeds", "quantity": 1, "price": 20}],
           customer_phone="9811100000", customer_name="A (Regular) + Co")
    for q in ("+91", "(", "*", "A (Regular", "[x"):
        assert shop.get("/api/customers", params={"search": q}).status_code == 200
        assert shop.get("/api/invoices", params={"search": q}).status_code == 200
    assert len(shop.get("/api/customers", params={"search": "+9198111"}).json()) == 1


def test_reports(client):
    shop = Shop(client)
    p = shop.product("Money Plant", 250, 10, cost_price=100)
    _order(shop, [{"product_id": p["id"], "name": "Money Plant", "quantity": 3, "price": 250}], payment_method="Cash")
    for rng in ("today", "day", "week", "month"):
        rep = shop.get("/api/reports/sales", params={"range": rng}).json()
        assert rep["sales"] == 750 and rep["orders"] == 1
        assert sum(b["sales"] for b in rep["buckets"]) == 750
    assert rep["profit"] == 450 and rep["by_method"]["Cash"] == 750
    assert rep["top"] == [{"name": "Money Plant", "quantity": 3}]
    # A chosen period: a week is Monday to Sunday, a month is the calendar month.
    week = shop.get("/api/reports/sales", params={"range": "week", "date": "2026-10-14"}).json()
    assert (week["start"], week["end"]) == ("2026-10-12", "2026-10-18") and len(week["buckets"]) == 7
    feb = shop.get("/api/reports/sales", params={"range": "month", "date": "2028-02-10"}).json()
    assert (feb["start"], feb["end"], feb["orders"]) == ("2028-02-01", "2028-02-29", 0)
    assert [b["label"] for b in feb["buckets"]] == ["1–7", "8–14", "15–21", "22–28", "29–29"]
    assert shop.get("/api/reports/sales", params={"range": "day", "date": "16-10-2026"}).status_code == 422


def test_order_history_filters_and_pages(client):
    shop = Shop(client)
    _, wh = shop.worker()
    line = [{"product_id": None, "name": "Seeds", "quantity": 1, "price": 10}]
    for i, m in enumerate(["Cash", "UPI", "Cash", "Card", "Cash"]):
        _order(shop, line, payment_method=m, customer_phone=f"98111000{i:02d}", customer_name=f"Cust {i}")
    client.post("/api/invoices", headers=wh, json={"items": line, "payment_method": "UPI", "customer_phone": "9811100088",
                                                    "customer_name": "Worker's Customer"})

    page1 = shop.get("/api/invoices", params={"limit": 4}).json()
    page2 = shop.get("/api/invoices", params={"limit": 4, "before": page1[-1]["created_at"]}).json()
    assert len(page1) == 4 and len(page2) == 2 and not {o["id"] for o in page1} & {o["id"] for o in page2}
    assert [o["payment_method"] for o in shop.get("/api/invoices", params={"method": "Cash"}).json()] == ["Cash"] * 3
    assert len(shop.get("/api/invoices", params={"search": "9811100003"}).json()) == 1
    assert len(shop.get("/api/invoices", params={"search": "cust 1"}).json()) == 1

    total = shop.get("/api/invoices/summary").json()
    assert total["orders"] == 6 and total["sales"] == 60 and total["by_method"] == {"Cash": 30, "UPI": 20, "Card": 10}
    today = next(iter(total["by_day"]))
    assert total["by_day"][today] == {"orders": 6, "sales": 60}
    assert shop.get("/api/invoices/summary", params={"date_from": "2020-01-01", "date_to": "2020-12-31"}).json()["orders"] == 0

    owner_id = shop.get("/api/auth/me").json()["id"]
    assert shop.get("/api/invoices/summary", params={"made_by": owner_id}).json()["orders"] == 5
    # A worker only ever sees their own bills, whatever filter they send.
    mine = client.get("/api/invoices/summary", headers=wh, params={"made_by": owner_id}).json()
    assert mine["orders"] == 1
    assert client.get("/api/invoices", headers=wh, params={"method": "Bitcoin"}).status_code == 422


def test_money_formatting():
    assert invoice_html.inr(1234567.5) == "₹12,34,567.50"
    assert invoice_html.inr(650) == "₹650"
    assert invoice_html.amount_in_words(1380) == "Rupees One Thousand Three Hundred Eighty Only"
    assert invoice_html.amount_in_words(250000.25) == "Rupees Two Lakh Fifty Thousand and Twenty Five Paise Only"


def test_every_bill_needs_a_customer(client):
    shop = Shop(client)
    pot = shop.product("Clay Pot", 100, 5)
    line = [{"product_id": pot["id"], "name": "Clay Pot", "quantity": 1, "price": 100}]
    r = shop.post("/api/invoices", {"items": line})
    assert r.status_code == 400 and "customer" in r.json()["detail"].lower()
    assert shop.post("/api/invoices", {"items": line, "customer_phone": "9811100077"}).status_code == 400  # new: needs a name
    assert shop.get(f"/api/products/{pot['id']}").json()["stock"] == 5  # nothing taken from stock
    c = shop.post("/api/customers", {"name": "Meena", "phone": "98111 00066"}).json()
    inv = shop.post("/api/invoices", {"items": line, "customer_id": c["id"]}).json()
    assert (inv["customer_name"], inv["customer_phone"]) == ("Meena", "+919811100066")
    assert shop.post("/api/invoices", {"items": line, "customer_id": "nope"}).status_code == 400


def test_customer_needs_name_and_phone_and_can_be_found(client):
    shop = Shop(client)
    assert shop.post("/api/customers", {"name": "No Phone"}).status_code == 422
    assert shop.post("/api/customers", {"name": "Bad", "phone": "12345"}).status_code == 400
    shop.post("/api/customers", {"name": "Anita Sharma", "phone": "9811122334"})
    shop.post("/api/customers", {"name": "Rajesh", "phone": "9811155667"})
    assert [c["name"] for c in shop.get("/api/customers/find", params={"q": "anita"}).json()] == ["Anita Sharma"]
    assert [c["name"] for c in shop.get("/api/customers/find", params={"q": "55667"}).json()] == ["Rajesh"]
    assert len(shop.get("/api/customers/find").json()) == 2
    # a worker who can bill but not see the customer list can still pick and add customers
    _, wh = shop.worker(customers=False)
    assert client.get("/api/customers", headers=wh).status_code == 403
    assert client.get("/api/customers/find", headers=wh, params={"q": "raj"}).status_code == 200
    assert client.post("/api/customers", headers=wh, json={"name": "Walk", "phone": "9811100011"}).status_code == 200


def test_one_draft_order_per_person_until_billed(client):
    shop = Shop(client)
    pot = shop.product("Clay Pot", 100, 5)
    c = shop.post("/api/customers", {"name": "Anita", "phone": "9811122334"}).json()
    assert shop.get("/api/orders/draft").json() is None
    item = {"product_id": pot["id"], "name": "Clay Pot", "quantity": 2, "price": 100}
    r = client.put("/api/orders/draft", headers=shop.h, json={"customer_id": c["id"], "items": [item]})
    assert r.status_code == 200
    d = shop.get("/api/orders/draft").json()
    assert d["customer"]["name"] == "Anita" and d["items"][0]["quantity"] == 2
    client.put("/api/orders/draft", headers=shop.h, json={"customer_id": c["id"], "items": [{**item, "quantity": 3}]})
    assert shop.get("/api/orders/draft").json()["items"][0]["quantity"] == 3  # still one draft, replaced
    assert client.put("/api/orders/draft", headers=shop.h, json={"customer_id": "other-shop"}).status_code == 400
    # a worker has their own draft
    _, wh = shop.worker()
    assert client.get("/api/orders/draft", headers=wh).json() is None
    # billing removes it
    shop.post("/api/invoices", {"items": [item], "customer_id": c["id"]})
    assert shop.get("/api/orders/draft").json() is None
    client.put("/api/orders/draft", headers=shop.h, json={"customer_id": c["id"]})
    assert client.delete("/api/orders/draft", headers=shop.h).status_code == 200
    assert shop.get("/api/orders/draft").json() is None
