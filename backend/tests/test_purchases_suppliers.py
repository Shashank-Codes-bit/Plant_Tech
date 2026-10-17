"""Supplier bills: stock, new products priced at the shop's profit %."""
from conftest import Shop


def _bill(shop, items, **extra):
    return shop.post("/api/purchases", {"supplier": "Green Farms", "invoice_number": "GF-1", "items": items, **extra})


def test_profit_percent_default_and_used_for_new_products(client):
    shop = Shop(client)
    assert client.get("/api/auth/me", headers=shop.h).json()["business"]["profit_percent"] == 60
    assert _bill(shop, [{"name": "Areca Palm", "quantity": 2, "purchase_price": 100}]).status_code == 200
    by_name = {p["name"]: p for p in shop.get("/api/products").json()}
    assert by_name["Areca Palm"]["selling_price"] == 160  # cost + 60%

    assert client.put("/api/business", headers=shop.h, json={"profit_percent": 40}).status_code == 200
    assert client.get("/api/auth/me", headers=shop.h).json()["business"]["profit_percent"] == 40
    _bill(shop, [{"name": "Jade Plant", "quantity": 1, "purchase_price": 100}])
    assert {p["name"]: p for p in shop.get("/api/products").json()}["Jade Plant"]["selling_price"] == 140
    assert client.put("/api/business", headers=shop.h, json={"profit_percent": -5}).status_code == 422
