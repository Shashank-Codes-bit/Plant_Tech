"""Photo uploads (checked, shrunk, stored per shop) and serving them.

Photo URLs are public but unguessable (random ids), so <img> tags work without a login header.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

import ai_client
import auth
import storage_client
from common import new_id, now_iso
from db import get_db

router = APIRouter(prefix="/api", tags=["files"])
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ImagePayload(BaseModel):
    image_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 64)


async def _store(normalize, raw, business_id: str) -> dict:
    try:
        jpeg = await run_in_threadpool(normalize, raw)
    except ai_client.BadImage as e:
        raise HTTPException(400, str(e))
    path = f"{storage_client.APP_NAME}/shops/{business_id}/{new_id()}.jpg"
    await run_in_threadpool(storage_client.put_object, path, jpeg, "image/jpeg")
    await get_db().uploads.insert_one({"path": path, "business_id": business_id, "created_at": now_iso()})
    return {"path": path}


@router.post("/upload-base64")
async def upload_base64(body: ImagePayload, user: dict = Depends(auth.current_user)):
    return await _store(ai_client.normalize_photo_b64, body.image_base64, user["business_id"])


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(auth.current_user)):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Photo too large (max 8 MB)")
    return await _store(ai_client.normalize_photo, data, user["business_id"])


@router.get("/files/{path:path}")
async def get_file(path: str):
    if not await get_db().uploads.find_one({"path": path}):
        raise HTTPException(404, "File not found")
    try:
        content, ctype = await run_in_threadpool(storage_client.get_object, path)
    except Exception:
        raise HTTPException(404, "File not found")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=31536000"})
