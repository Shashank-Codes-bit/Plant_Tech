"""NurseryPOS API. Routes live in routers/; this file wires them up.

Every shop's data carries a business_id and every route filters by the logged-in user's shop.
Public (no login): /health, /api/auth/*, photo files, and /i/{token} customer bills.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

import storage_client  # noqa: E402
from db import get_db  # noqa: E402
from errors import AppError, app_error_handler  # noqa: E402
from routers import ai, auth, business, carts, customers, files, library, products, purchases, sales, staff, suppliers  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INDEXES = {
    "users": [("id", True), ("phone", False), ("google_sub", False), ("business_id", False)],
    "businesses": [("id", True)],
    "categories": [("id", True), ("business_id", False)],
    "products": [("id", True), ("business_id", False)],
    "customers": [("id", True), ("business_id", False), ("phone", False)],
    "invoices": [("id", True), ("business_id", False), ("date_key", False), ("public_token", False)],
    "stock_history": [("product_id", False)],
    "library": [("id", True), ("name_key", False)],
    "uploads": [("path", False)],
    "ai_usage": [("business_id", False)],
    "carts": [([("business_id", 1), ("customer_id", 1)], True)],  # one saved order per customer
    "suppliers": [("id", True), ("business_id", False)],
    "purchases": [("id", False), ("business_id", False), ("supplier_id", False)],
}


async def ensure_indexes(db):
    for coll, specs in INDEXES.items():
        for field, unique in specs:
            try:
                await db[coll].create_index(field, unique=unique)
            except Exception as e:  # never block start-up on an index
                logger.warning("index %s.%s: %s", coll, field, e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await db.drafts.drop()  # replaced by per-customer carts (one-time clean-up; nothing if already gone)
    await ensure_indexes(db)
    await library.seed_library(db)
    await suppliers.backfill(db)
    try:
        await run_in_threadpool(storage_client.init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error("Storage init failed: %s", e)
    if len(os.environ.get("JWT_SECRET", "")) < 32:
        logger.error("JWT_SECRET is missing or shorter than 32 characters - logins will fail")
    yield


app = FastAPI(title="NurseryPOS API", lifespan=lifespan)
for module in (auth, staff, business, library, products, customers, carts, sales, purchases, suppliers, ai, files):
    app.include_router(module.router)
app.include_router(sales.public_router)
app.add_exception_handler(AppError, app_error_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/api/")
async def root():
    return {"message": "NurseryPOS API"}
