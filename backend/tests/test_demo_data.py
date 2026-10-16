"""Demo shop data: seeded once, topped up by ticks, never touching the shop's own data."""
import asyncio
from datetime import datetime, timedelta

import db as db_module
import demo_data
from common import IST
from conftest import Shop

NOW = datetime(2026, 10, 16, 15, 5, tzinfo=IST)  # a Friday afternoon


def run(coro):
    return asyncio.run(coro)


def test_seed_then_ticks(client):
    shop = Shop(client)
    own = shop.product("Kopi Plant", 850, 18)
    db = db_module.state.db

    r = run(demo_data.seed(db, "9811122334", now=NOW))
    assert r["seeded"] and r["products"] == 40 and r["customers"] == 18 and r["orders"] > 250

    products = shop.get("/api/products").json()
    by_name = {p["name"]: p for p in products}
    assert len(products) == 41 and by_name["Kopi Plant"]["stock"] == 18  # own product untouched
    assert by_name["Fiddle Leaf Fig"]["out_of_stock"] and by_name["ZZ Plant"]["low_stock"]
    assert all(p["stock"] >= 0 for p in products)
    assert {c["name"] for c in shop.get("/api/categories").json()} >= {"Garden Tools", "Herbs", "Pots"}

    today = shop.get("/api/invoices/summary", params={"day": NOW.date().isoformat()}).json()
    assert today["orders"] > 0 and today["sales"] > 0
    invs = run(db.invoices.find({"demo": True}, {"_id": 0, "created_at": 1, "date_key": 1}).to_list(5000))
    assert all(datetime.fromisoformat(i["created_at"]) <= NOW for i in invs)  # nothing from the future
    assert min(i["date_key"] for i in invs) >= (NOW - timedelta(days=30)).date().isoformat()
    month = shop.get("/api/reports/sales", params={"range": "month", "date": NOW.date().isoformat()}).json()
    assert month["orders"] > 100 and month["profit"] > 0 and month["top"]
    assert len(shop.get("/api/customers").json()) == 18

    # Same moment again: nothing new. Later the same day: more orders. Seeding twice: refused.
    assert run(demo_data.tick(db, "9811122334", now=NOW))["orders"] == 0
    later = run(demo_data.tick(db, "9811122334", now=NOW + timedelta(hours=3)))
    assert later["orders"] > 0 and later["restocked"] is False
    assert run(demo_data.tick(db, "9811122334", now=NOW + timedelta(hours=3)))["orders"] == 0
    assert run(demo_data.seed(db, "9811122334", now=NOW))["seeded"] is False

    # Next morning: restock once, and the shop's own data is still there.
    nxt = run(demo_data.tick(db, "9811122334", now=NOW + timedelta(days=1, hours=-5)))
    assert nxt["restocked"] is True
    assert shop.get(f"/api/products/{own['id']}").json()["stock"] == 18

    business_id = shop.get("/api/auth/me").json()["business"]["id"]
    run(demo_data.remove_demo(db, business_id))
    assert [p["name"] for p in shop.get("/api/products").json()] == ["Kopi Plant"]
