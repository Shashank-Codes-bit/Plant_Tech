"""Supplier bills: add the items to stock (new items become new products, priced at cost plus the shop's profit %)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import auth
from common import new_id, now_iso
from db import get_db
from errors import AppError
from routers import library
from routers.business import DEFAULT_PROFIT_PERCENT
from routers.products import record_stock

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


class PurchaseItem(BaseModel):
    product_id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0)
    purchase_price: float = Field(0, ge=0)
    selling_price: float | None = Field(None, ge=0)
    category_id: str | None = None


class PurchaseIn(BaseModel):
    supplier: str = Field("", max_length=120)
    invoice_number: str = Field("", max_length=60)
    date: str = Field("", max_length=40)
    items: list[PurchaseItem] = Field(min_length=1)
    image_path: str | None = None
    total: float = 0


@router.post("")
async def create_purchase(body: PurchaseIn, user: dict = Depends(auth.require("stock"))):
    db = get_db()
    bid = user["business_id"]
    owner = auth.can(user, "owner")
    shop = await db.businesses.find_one({"id": bid}, {"_id": 0, "profit_percent": 1}) or {}
    markup = 1 + shop.get("profit_percent", DEFAULT_PROFIT_PERCENT) / 100
    for it in body.items:
        if it.product_id:
            update: dict = {"$inc": {"stock": it.quantity}}
            if owner:
                update["$set"] = {"cost_price": it.purchase_price, "supplier": body.supplier}
            p = await db.products.find_one_and_update({"id": it.product_id, "business_id": bid, "deleted_at": None},
                                                      update, projection={"_id": 0},
                                                      return_document=ReturnDocument.AFTER)
            if not p:
                raise AppError(400, "{{name}} is no longer in your products.", "product_missing", name=it.name)
            await record_stock(db, user, p, it.quantity, p["stock"], "purchase", f"Supplier bill {body.invoice_number}")
        else:
            count = await db.products.count_documents({"business_id": bid})
            p = {"id": new_id(), "business_id": bid, "sku": f"NP-{count + 1:04d}", "name": it.name.strip(),
                 "botanical_name": "", "category_id": it.category_id,
                 "library_id": await library.entry_for_new_product(db, it.name, None, bid), "photo_path": None,
                 "selling_price": it.selling_price if it.selling_price is not None else round(it.purchase_price * markup),
                 "cost_price": it.purchase_price if owner else 0, "stock": it.quantity, "min_stock": 5,
                 "supplier": body.supplier, "notes": "", "deleted_at": None, "created_at": now_iso(),
                 "created_by": user["id"]}
            await db.products.insert_one(p)
            await record_stock(db, user, p, it.quantity, it.quantity, "purchase", f"Supplier bill {body.invoice_number}")
    doc = {"id": new_id(), "business_id": bid, **body.model_dump(), "created_by": user["id"], "created_at": now_iso()}
    await db.purchases.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_purchases(user: dict = Depends(auth.require("stock"))):
    return await get_db().purchases.find({"business_id": user["business_id"]}, {"_id": 0}
                                         ).sort("created_at", -1).to_list(500)
