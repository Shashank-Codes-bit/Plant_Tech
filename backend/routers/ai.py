"""AI: identify a plant from a photo, read a supplier bill. Limited per shop per day.

Photos that are not what the screen expects are refused with a clear message (and a `code` the app
uses to offer the right next step): a laptop in Add items, a bill in Add items, a plant on Supplier bill.
"""
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import ai_client
import auth
from common import date_key
from db import get_db
from errors import AppError
from routers.products import views
from search import best_product

router = APIRouter(prefix="/api/ai", tags=["ai"])
logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ImagePayload(BaseModel):
    image_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 64)


async def use_quota(db, business_id: str, n: int = 1):
    limit = int(os.environ.get("AI_DAILY_LIMIT", "300"))
    doc = await db.ai_usage.find_one_and_update({"business_id": business_id, "date": date_key()},
                                                {"$inc": {"count": n}}, upsert=True,
                                                return_document=ReturnDocument.AFTER)
    if doc["count"] > limit:
        raise HTTPException(429, "The daily photo scan limit has been reached. Please search by name, or try again tomorrow.")


async def _run(db, business_id: str, n: int, call):
    """Run an AI call; when Claude was never reached (unreadable photo, outage) the scans are given back."""
    try:
        return await call()
    except (ai_client.BadImage, ai_client.AIUnavailable) as e:
        await db.ai_usage.update_one({"business_id": business_id, "date": date_key()}, {"$inc": {"count": -n}})
        raise HTTPException(400 if isinstance(e, ai_client.BadImage) else 503, str(e))


@router.post("/identify-plant")
async def identify(body: ImagePayload, user: dict = Depends(auth.require("sell", "stock"))):
    db = get_db()
    bid = user["business_id"]
    await use_quota(db, bid)
    products = await db.products.find({"business_id": bid, "deleted_at": None}, {"_id": 0}).to_list(5000)
    cats = await db.categories.find({"business_id": bid}, {"_id": 0}).to_list(500)
    result = await _run(db, bid, 1, lambda: ai_client.identify_plant(
        ai_client.decode_b64(body.image_base64), [p["name"] for p in products], [c["name"] for c in cats]))
    kind = result.pop("kind")
    logger.info("identify: kind=%s reason=%s", kind, result.pop("reason"))
    if kind == "bill":
        raise AppError(422, "This looks like a supplier bill. To add stock from a bill, use Supplier bill.",
                       "looks_like_bill")
    if kind == "other":
        raise AppError(422, "This photo does not appear to show a plant or nursery product. "
                            "Please photograph the item clearly, or search by name.", "not_nursery_item")
    if kind == "unknown" or not result["plant_name"]:
        raise AppError(422, "This item could not be identified. Please retake the photo in good light, "
                            "or search by name.", "not_identified")
    names = [result["matched_catalog_name"], result["plant_name"], result["scientific_name"], *result["alternatives"]]
    matched, similar = best_product(products, names)
    result["matched_product"] = (await views(db, user, [matched]))[0] if matched else None
    result["similar_products"] = await views(db, user, similar) if not matched else []
    cat = next((c for c in cats if c["name"] == result.get("suggested_category")), None)
    result["suggested_category_id"] = cat["id"] if cat else None
    return result


@router.post("/scan-invoice")
async def scan_invoice(body: ImagePayload, user: dict = Depends(auth.require("stock"))):
    db = get_db()
    bid = user["business_id"]
    await use_quota(db, bid)
    result = await _run(db, bid, 1, lambda: ai_client.scan_invoice([ai_client.decode_b64(body.image_base64)]))
    logger.info("scan-invoice: is_bill=%s reason=%s", result["is_bill"], result["reason"])
    if not result.pop("is_bill"):
        raise AppError(422, "This photo does not appear to be a supplier bill. Please photograph the bill "
                            "clearly, or enter the items manually.", "not_a_bill")
    result.pop("reason")
    products = await db.products.find({"business_id": bid, "deleted_at": None}, {"_id": 0}).to_list(5000)
    for it in result["items"]:
        match, _ = best_product(products, [it["name"]])
        it["product_id"] = match["id"] if match else None
        it["matched_name"] = match["name"] if match else None
    return result
