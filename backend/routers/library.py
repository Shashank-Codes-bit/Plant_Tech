"""Shared product picture library, used by every shop.

Each entry is one product (mostly plants) with a name, Hindi name and default category.
A product without a shared picture gets the first clear photo a shop takes of it
(status "new" until an app admin checks it). Admins can add, replace or remove pictures.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

import ai_client
import auth
import storage_client
from common import name_key, new_id, now_iso
from db import get_db

router = APIRouter(prefix="/api", tags=["library"])

STARTER = [
    ("Money Plant", "मनी प्लांट", "Epipremnum aureum", "Indoor Plants", ["pothos", "devil's ivy"]),
    ("Snake Plant", "स्नेक प्लांट", "Dracaena trifasciata", "Indoor Plants", ["sansevieria", "mother-in-law's tongue"]),
    ("Areca Palm", "सुपारी पाम", "Dypsis lutescens", "Indoor Plants", ["butterfly palm"]),
    ("Peace Lily", "पीस लिली", "Spathiphyllum wallisii", "Indoor Plants", ["spathiphyllum"]),
    ("Jade Plant", "जेड प्लांट", "Crassula ovata", "Succulents", ["crassula", "money tree"]),
    ("Aloe Vera", "एलोवेरा", "Aloe vera", "Succulents", ["aloe", "ghritkumari", "gwarpatha"]),
    ("Tulsi", "तुलसी", "Ocimum tenuiflorum", "Herbs", ["holy basil", "tulasi"]),
    ("Rose", "गुलाब", "Rosa", "Flowering Plants", ["gulab", "rose plant"]),
    ("Hibiscus", "गुड़हल", "Hibiscus rosa-sinensis", "Flowering Plants", ["gudhal", "china rose", "jaswand"]),
    ("Spider Plant", "स्पाइडर प्लांट", "Chlorophytum comosum", "Indoor Plants", ["chlorophytum"]),
]


async def seed_library(db):
    """Add the starter entries that aren't there yet (safe to run on every start)."""
    for name, hi, botanical, category, aliases in STARTER:
        if not await db.library.find_one({"name_key": name_key(name)}):
            await db.library.insert_one({
                "id": new_id(), "name": name, "name_key": name_key(name), "name_hi": hi, "botanical": botanical,
                "default_category": category, "aliases": aliases, "image_path": None, "image_status": "none",
                "image_source_business_id": None, "source": "starter", "removed": False,
                "created_at": now_iso(), "updated_at": now_iso()})


def view(entry: dict) -> dict:
    return {k: entry.get(k) for k in ("id", "name", "name_hi", "botanical", "default_category", "image_path",
                                      "image_status", "source")}


async def search(db, q: str, limit: int = 5) -> list[dict]:
    key = name_key(q)
    if len(key) < 2:
        return []
    found = []
    async for e in db.library.find({"removed": False}, {"_id": 0}):
        names = [e["name_key"], name_key(e.get("name_hi", "")), *[name_key(a) for a in e.get("aliases", [])]]
        if any(key in n for n in names if n):
            found.append(e)
    found.sort(key=lambda e: (not e["name_key"].startswith(key), e["name"]))
    return [view(e) for e in found[:limit]]


async def entry_for_new_product(db, name: str, category: str | None, business_id: str) -> str | None:
    """Find the shared entry for a product name, or start one so the next shop can reuse it."""
    key = name_key(name)
    if len(key) < 3:
        return None
    existing = await db.library.find_one({"name_key": key}, {"_id": 0})
    if existing:
        return existing["id"]
    entry = {"id": new_id(), "name": name.strip(), "name_key": key, "name_hi": "", "botanical": "",
             "default_category": category or "", "aliases": [], "image_path": None, "image_status": "none",
             "image_source_business_id": None, "source": "shop", "source_business_id": business_id,
             "removed": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.library.insert_one(entry)
    return entry["id"]


async def _store_library_picture(db, entry_id: str, jpeg: bytes) -> str:
    path = f"{storage_client.APP_NAME}/library/{entry_id}-{new_id()[:8]}.jpg"
    await run_in_threadpool(storage_client.put_object, path, jpeg, "image/jpeg")
    await db.uploads.insert_one({"path": path, "business_id": None, "created_at": now_iso()})
    return path


async def contribute_photo(db, library_id: str | None, photo_path: str | None, business_id: str):
    """A shop's product photo becomes the shared picture if the entry has none yet."""
    if not library_id or not photo_path:
        return
    entry = await db.library.find_one({"id": library_id, "removed": False}, {"_id": 0})
    if not entry or entry.get("image_status") != "none":
        return
    try:
        jpeg, _ = await run_in_threadpool(storage_client.get_object, photo_path)
        square = await run_in_threadpool(ai_client.square_thumbnail, jpeg)
    except Exception:  # a missing or unreadable photo just means no contribution
        return
    path = await _store_library_picture(db, library_id, square)
    await db.library.update_one({"id": library_id, "image_status": "none"}, {"$set": {
        "image_path": path, "image_status": "new", "image_source_business_id": business_id,
        "updated_at": now_iso()}})


# ---- admin -------------------------------------------------------------------

class LibraryPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    name_hi: str | None = Field(None, max_length=80)
    botanical: str | None = Field(None, max_length=120)
    default_category: str | None = Field(None, max_length=60)


class PhotoIn(BaseModel):
    image_base64: str


@router.get("/admin/library")
async def admin_list(status: str = "all", admin: dict = Depends(auth.require("admin"))):
    q: dict = {"removed": False}
    if status in ("none", "new", "live"):
        q["image_status"] = status
    entries = await get_db().library.find(q, {"_id": 0}).sort("name", 1).to_list(2000)
    return [{**view(e), "image_source_business_id": e.get("image_source_business_id")} for e in entries]


@router.patch("/admin/library/{entry_id}")
async def admin_update(entry_id: str, body: LibraryPatch, admin: dict = Depends(auth.require("admin"))):
    update = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if "name" in update:
        update["name_key"] = name_key(update["name"])
    update["updated_at"] = now_iso()
    res = await get_db().library.update_one({"id": entry_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return view(await get_db().library.find_one({"id": entry_id}, {"_id": 0}))


@router.post("/admin/library/{entry_id}/photo")
async def admin_set_photo(entry_id: str, body: PhotoIn, admin: dict = Depends(auth.require("admin"))):
    db = get_db()
    if not await db.library.find_one({"id": entry_id}):
        raise HTTPException(404, "Not found")
    try:
        jpeg = await run_in_threadpool(ai_client.normalize_photo_b64, body.image_base64)
        square = await run_in_threadpool(ai_client.square_thumbnail, jpeg)
    except ai_client.BadImage as e:
        raise HTTPException(400, str(e))
    path = await _store_library_picture(db, entry_id, square)
    await db.library.update_one({"id": entry_id}, {"$set": {
        "image_path": path, "image_status": "live", "image_source_business_id": None, "updated_at": now_iso()}})
    return view(await db.library.find_one({"id": entry_id}, {"_id": 0}))


@router.post("/admin/library/{entry_id}/approve")
async def admin_approve(entry_id: str, admin: dict = Depends(auth.require("admin"))):
    await get_db().library.update_one({"id": entry_id, "image_status": "new"},
                                      {"$set": {"image_status": "live", "updated_at": now_iso()}})
    return view(await get_db().library.find_one({"id": entry_id}, {"_id": 0}))


@router.delete("/admin/library/{entry_id}/photo")
async def admin_remove_photo(entry_id: str, admin: dict = Depends(auth.require("admin"))):
    """Take the picture down; the next shop photo can fill it again."""
    await get_db().library.update_one({"id": entry_id}, {"$set": {
        "image_path": None, "image_status": "none", "image_source_business_id": None, "updated_at": now_iso()}})
    return view(await get_db().library.find_one({"id": entry_id}, {"_id": 0}))


@router.delete("/admin/library/{entry_id}")
async def admin_remove_entry(entry_id: str, admin: dict = Depends(auth.require("admin"))):
    await get_db().library.update_one({"id": entry_id}, {"$set": {"removed": True, "updated_at": now_iso()}})
    return {"ok": True}
