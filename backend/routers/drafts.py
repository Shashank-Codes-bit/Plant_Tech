"""The order someone is building but hasn't billed yet: one per person, kept on the server so it survives
closing the app or changing phones. Making the bill removes it."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import auth
from common import now_iso
from db import get_db

router = APIRouter(prefix="/api/orders/draft", tags=["orders"])


class DraftLine(BaseModel):
    product_id: str = Field(min_length=1, max_length=64)  # "loose-…" = billed without stock
    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0, le=100000)
    price: float = Field(ge=0)
    gst_percent: float = 0
    image_path: str | None = Field(None, max_length=300)
    stock: float | None = None


class DraftIn(BaseModel):
    customer_id: str | None = None
    items: list[DraftLine] = Field(default_factory=list, max_length=200)
    discount: float = Field(0, ge=0)


async def _customer(db, business_id: str, customer_id: str | None) -> dict | None:
    if not customer_id:
        return None
    c = await db.customers.find_one({"id": customer_id, "business_id": business_id},
                                    {"_id": 0, "id": 1, "name": 1, "phone": 1, "purchase_count": 1})
    return c


async def clear(db, user_id: str):
    await db.drafts.delete_many({"user_id": user_id})


@router.get("")
async def get_draft(user: dict = Depends(auth.require("sell"))):
    db = get_db()
    d = await db.drafts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not d:
        return None
    return {"customer": await _customer(db, user["business_id"], d.get("customer_id")), "items": d.get("items", []),
            "discount": d.get("discount", 0), "updated_at": d.get("updated_at")}


@router.put("")
async def save_draft(body: DraftIn, user: dict = Depends(auth.require("sell"))):
    db = get_db()
    customer = await _customer(db, user["business_id"], body.customer_id)
    if body.customer_id and not customer:
        raise HTTPException(400, "Customer not found")
    doc = {"user_id": user["id"], "business_id": user["business_id"], "customer_id": body.customer_id,
           "items": [i.model_dump() for i in body.items], "discount": body.discount, "updated_at": now_iso()}
    await db.drafts.replace_one({"user_id": user["id"]}, doc, upsert=True)
    return {"customer": customer, "items": doc["items"], "discount": body.discount, "updated_at": doc["updated_at"]}


@router.delete("")
async def discard_draft(user: dict = Depends(auth.require("sell"))):
    await clear(get_db(), user["id"])
    return {"ok": True}
