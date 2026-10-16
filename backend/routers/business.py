"""The shop (setup wizard and settings) and its categories, each with a GST %.

Prices are typed tax-inclusive. GST only applies when the shop is GST registered; then each
category's GST % decides how much of a line's price is tax.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import auth
from common import name_key, new_id, now_iso
from db import get_db

router = APIRouter(prefix="/api", tags=["business"])

# Suggestions shown in setup; the owner confirms real rates with their accountant.
SUGGESTED_CATEGORIES = [
    ("Indoor Plants", 0), ("Outdoor Plants", 0), ("Flowering Plants", 0), ("Succulents", 0), ("Cacti", 0),
    ("Trees", 0), ("Shrubs", 0), ("Herbs", 0), ("Seeds", 0), ("Pots", 18), ("Soil", 5), ("Fertilizers", 5),
    ("Garden Tools", 5),
]
# Rates since GST 2.0 (22 Sep 2025) plus the older 12% / 28% for anything still billed at them.
GST_SLABS = (0, 0.25, 3, 5, 12, 18, 28, 40)


class BusinessIn(BaseModel):
    name: str | None = Field(None, max_length=120)
    address: str | None = Field(None, max_length=300)
    phone: str | None = Field(None, max_length=20)
    gst_registered: bool | None = None
    gstin: str | None = Field(None, max_length=15)
    upi_id: str | None = Field(None, max_length=80)
    logo_path: str | None = None
    footer_note: str | None = Field(None, max_length=200)
    onboarding_done: bool | None = None


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    gst_percent: float = 0


class CategoryPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    gst_percent: float | None = None


class CategoriesBulk(BaseModel):
    items: list[CategoryIn]


def _check_gst(value: float | None):
    if value is not None and value not in GST_SLABS:
        raise HTTPException(400, "GST must be one of " + ", ".join(f"{s:g}%" for s in GST_SLABS))


@router.get("/business")
async def get_business(user: dict = Depends(auth.current_user)):
    return await get_db().businesses.find_one({"id": user["business_id"]}, {"_id": 0})


@router.put("/business")
async def update_business(body: BusinessIn, owner: dict = Depends(auth.require("owner"))):
    db = get_db()
    update = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump(exclude_none=True).items()}
    if "gstin" in update:
        update["gstin"] = update["gstin"].upper()
    if update.get("onboarding_done") and not (update.get("name") or (await get_business(owner)).get("name")):
        raise HTTPException(400, "Enter the shop name first")
    update["updated_at"] = now_iso()
    await db.businesses.update_one({"id": owner["business_id"]}, {"$set": update})
    return await db.businesses.find_one({"id": owner["business_id"]}, {"_id": 0})


@router.get("/categories/suggestions")
async def category_suggestions(user: dict = Depends(auth.current_user)):
    return [{"name": n, "gst_percent": g} for n, g in SUGGESTED_CATEGORIES]


@router.get("/categories")
async def list_categories(user: dict = Depends(auth.current_user)):
    db = get_db()
    cats = await db.categories.find({"business_id": user["business_id"]}, {"_id": 0}).sort("name", 1).to_list(500)
    for c in cats:
        c["product_count"] = await db.products.count_documents(
            {"business_id": user["business_id"], "category_id": c["id"], "deleted_at": None})
    return cats


async def _create_category(db, business_id: str, name: str, gst: float) -> dict:
    existing = await db.categories.find_one({"business_id": business_id, "name_key": name_key(name)}, {"_id": 0})
    if existing:
        return existing
    doc = {"id": new_id(), "business_id": business_id, "name": name.strip(), "name_key": name_key(name),
           "gst_percent": gst, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/categories")
async def create_category(body: CategoryIn, user: dict = Depends(auth.require("owner", "stock"))):
    _check_gst(body.gst_percent)
    gst = body.gst_percent if auth.can(user, "owner") else 0  # only the owner sets tax
    return await _create_category(get_db(), user["business_id"], body.name, gst)


@router.post("/categories/bulk")
async def create_categories(body: CategoriesBulk, owner: dict = Depends(auth.require("owner"))):
    """Setup wizard: add the chosen categories at once (existing names are kept as they are)."""
    for item in body.items:
        _check_gst(item.gst_percent)
    db = get_db()
    return [await _create_category(db, owner["business_id"], i.name, i.gst_percent) for i in body.items]


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryPatch, owner: dict = Depends(auth.require("owner"))):
    _check_gst(body.gst_percent)
    db = get_db()
    cat = await db.categories.find_one({"id": cat_id, "business_id": owner["business_id"]}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    update: dict = {}
    if body.name is not None:
        clash = await db.categories.find_one({"business_id": owner["business_id"], "name_key": name_key(body.name),
                                             "id": {"$ne": cat_id}})
        if clash:
            raise HTTPException(409, "You already have a category with this name")
        update.update({"name": body.name.strip(), "name_key": name_key(body.name)})
    if body.gst_percent is not None:
        update["gst_percent"] = body.gst_percent
    if update:
        await db.categories.update_one({"id": cat_id}, {"$set": update})
    return {**cat, **update}


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, owner: dict = Depends(auth.require("owner"))):
    db = get_db()
    used = await db.products.count_documents({"business_id": owner["business_id"], "category_id": cat_id,
                                              "deleted_at": None})
    if used:
        raise HTTPException(400, f"{used} products use this category. Move them first.")
    await db.categories.delete_one({"id": cat_id, "business_id": owner["business_id"]})
    return {"ok": True}
