"""AI: identify a plant from a photo, read a supplier bill. Limited per shop per day."""
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import ai_client
import auth
from common import date_key, name_key
from db import get_db
from routers.products import views

router = APIRouter(prefix="/api/ai", tags=["ai"])
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ImagePayload(BaseModel):
    image_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 64)


async def use_quota(db, business_id: str):
    limit = int(os.environ.get("AI_DAILY_LIMIT", "300"))
    doc = await db.ai_usage.find_one_and_update({"business_id": business_id, "date": date_key()},
                                                {"$inc": {"count": 1}}, upsert=True,
                                                return_document=ReturnDocument.AFTER)
    if doc["count"] > limit:
        raise HTTPException(429, "Today's AI scan limit is reached. Search by name, or try again tomorrow.")


async def _run(coro):
    try:
        return await coro
    except ai_client.BadImage as e:
        raise HTTPException(400, str(e))
    except ai_client.AIUnavailable as e:
        raise HTTPException(503, str(e))


@router.post("/identify-plant")
async def identify(body: ImagePayload, user: dict = Depends(auth.require("sell", "stock"))):
    db = get_db()
    await use_quota(db, user["business_id"])
    products = await db.products.find({"business_id": user["business_id"], "deleted_at": None},
                                      {"_id": 0}).to_list(5000)
    cats = await db.categories.find({"business_id": user["business_id"]}, {"_id": 0}).to_list(500)
    result = await _run(ai_client.identify_plant(body.image_base64, [p["name"] for p in products],
                                                 [c["name"] for c in cats]))
    matched = None
    if result.get("matched_catalog_name"):
        key = name_key(result["matched_catalog_name"])
        matched = next((p for p in products if name_key(p["name"]) == key), None)
    if not matched and result.get("plant_name") not in ("", "Unknown Plant"):
        pn = name_key(result["plant_name"])
        matched = next((p for p in products if pn and (pn in name_key(p["name"]) or name_key(p["name"]) in pn)), None)
    result["matched_product"] = (await views(db, user, [matched]))[0] if matched else None
    cat = next((c for c in cats if c["name"] == result.get("suggested_category")), None)
    result["suggested_category_id"] = cat["id"] if cat else None
    return result


@router.post("/scan-invoice")
async def scan_invoice(body: ImagePayload, user: dict = Depends(auth.require("stock"))):
    db = get_db()
    await use_quota(db, user["business_id"])
    result = await _run(ai_client.scan_invoice(body.image_base64))
    products = await db.products.find({"business_id": user["business_id"], "deleted_at": None},
                                      {"_id": 0}).to_list(5000)
    for it in result["items"]:
        nm = name_key(it["name"])
        match = next((p for p in products if nm and (nm in name_key(p["name"]) or name_key(p["name"]) in nm)), None)
        it["product_id"] = match["id"] if match else None
        it["matched_name"] = match["name"] if match else None
    return result
