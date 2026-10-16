from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response, Request
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import logging
import uuid
import base64
import hmac
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import ai_client
import storage_client
from seed import seed_if_empty

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

APP_API_KEY = os.environ.get("APP_API_KEY", "")
MAX_IMAGE_BYTES = 8 * 1024 * 1024

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today_key():
    return datetime.now(IST).strftime("%Y-%m-%d")


def date_key_from_iso(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(IST).strftime("%Y-%m-%d")
    except Exception:
        return today_key()


# ============================ Models ============================
class Business(BaseModel):
    business_name: str
    owner_name: str = ""
    phone: str = ""
    address: str = ""
    currency: str = "₹"
    tax_enabled: bool = False
    tax_percent: float = 0.0


class CategoryCreate(BaseModel):
    name: str


class ProductIn(BaseModel):
    name: str
    botanical_name: str = ""
    category: str = ""
    photo_path: Optional[str] = None
    cost_price: float = 0.0
    selling_price: float = 0.0
    stock: float = 0.0
    min_stock: float = 5.0
    supplier: str = ""
    sku: str = ""
    notes: str = ""


class StockAdjust(BaseModel):
    change: float
    reason: str = "Correction"


class CartItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    quantity: float
    price: float


class InvoiceIn(BaseModel):
    items: List[CartItem]
    customer_id: Optional[str] = None
    customer_name: str = "Walk-in Customer"
    customer_phone: str = ""
    discount: float = 0.0
    tax_percent: float = 0.0
    payment_method: str = "Cash"


class CustomerIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    notes: str = ""


class PurchaseItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    quantity: float
    purchase_price: float
    selling_price: Optional[float] = None
    category: str = ""


class PurchaseIn(BaseModel):
    supplier: str = ""
    invoice_number: str = ""
    date: str = ""
    items: List[PurchaseItem]
    image_path: Optional[str] = None
    total: float = 0.0


class ImagePayload(BaseModel):
    image_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 64)


# ============================ Helpers ============================
async def next_invoice_number() -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": "invoice"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"INV-{doc['seq']:04d}"


async def record_stock_history(product_id, product_name, change, new_stock, htype, reason=""):
    await db.stock_history.insert_one({
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "product_name": product_name,
        "change": change,
        "new_stock": new_stock,
        "type": htype,
        "reason": reason,
        "created_at": now_iso(),
    })


# ============================ Business ============================
@api_router.get("/business")
async def get_business():
    doc = await db.business.find_one({"_id": "singleton"}, {"_id": 0})
    return doc


@api_router.post("/business")
async def save_business(body: Business):
    data = body.dict()
    data["updated_at"] = now_iso()
    await db.business.update_one({"_id": "singleton"}, {"$set": data}, upsert=True)
    return data


# ============================ Categories ============================
@api_router.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api_router.post("/categories")
async def create_category(body: CategoryCreate):
    existing = await db.categories.find_one({"name": body.name})
    if existing:
        raise HTTPException(400, "Category already exists")
    doc = {"id": str(uuid.uuid4()), "name": body.name, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


# ============================ Products ============================
@api_router.get("/products")
async def list_products(search: str = "", category: str = "", low_stock: bool = False):
    q = {"deleted_at": None}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"botanical_name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
        ]
    if category:
        q["category"] = category
    products = await db.products.find(q, {"_id": 0}).sort("name", 1).to_list(1000)
    if low_stock:
        products = [p for p in products if p["stock"] <= p["min_stock"]]
    return products


@api_router.post("/products")
async def create_product(body: ProductIn):
    count = await db.products.count_documents({})
    sku = body.sku or f"NP-{count + 1:04d}"
    doc = {
        "id": str(uuid.uuid4()),
        "sku": sku,
        "name": body.name,
        "botanical_name": body.botanical_name,
        "category": body.category,
        "photo_path": body.photo_path,
        "cost_price": body.cost_price,
        "selling_price": body.selling_price,
        "stock": body.stock,
        "min_stock": body.min_stock,
        "supplier": body.supplier,
        "notes": body.notes,
        "deleted_at": None,
        "created_at": now_iso(),
    }
    await db.products.insert_one(doc)
    if body.stock > 0:
        await record_stock_history(doc["id"], doc["name"], body.stock, body.stock, "initial", "Initial stock")
    doc.pop("_id", None)
    return doc


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    return doc


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn):
    update = body.dict(exclude_unset=True)
    update.pop("stock", None)  # stock changes go through adjust/sale/purchase
    res = await db.products.update_one({"id": product_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@api_router.post("/products/{product_id}/adjust-stock")
async def adjust_stock(product_id: str, body: StockAdjust):
    doc = await db.products.find_one_and_update(
        {"id": product_id},
        {"$inc": {"stock": body.change}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(404, "Product not found")
    await record_stock_history(product_id, doc["name"], body.change, doc["stock"], "adjustment", body.reason)
    doc.pop("_id", None)
    return doc


@api_router.get("/products/{product_id}/history")
async def product_history(product_id: str):
    stock = await db.stock_history.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    sales = await db.invoices.find(
        {"items.product_id": product_id}, {"_id": 0, "invoice_number": 1, "created_at": 1, "items": 1}
    ).sort("created_at", -1).to_list(200)
    sale_rows = []
    for inv in sales:
        for it in inv["items"]:
            if it.get("product_id") == product_id:
                sale_rows.append({
                    "invoice_number": inv["invoice_number"],
                    "quantity": it["quantity"],
                    "price": it["price"],
                    "created_at": inv["created_at"],
                })
    return {"stock_history": stock, "sales_history": sale_rows}


# ============================ Customers ============================
@api_router.get("/customers")
async def list_customers(search: str = ""):
    q = {}
    if search:
        q = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]}
    return await db.customers.find(q, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.post("/customers")
async def create_customer(body: CustomerIn):
    doc = body.dict()
    doc.update({
        "id": str(uuid.uuid4()),
        "total_purchases": 0.0,
        "purchase_count": 0,
        "created_at": now_iso(),
    })
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    doc = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Customer not found")
    invoices = await db.invoices.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    doc["invoices"] = invoices
    return doc


# ============================ Invoices / Sales ============================
@api_router.post("/invoices")
async def create_invoice(body: InvoiceIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")

    # Transactional stock decrement with rollback on failure
    decremented = []
    for it in body.items:
        if not it.product_id:
            continue
        updated = await db.products.find_one_and_update(
            {"id": it.product_id, "stock": {"$gte": it.quantity}},
            {"$inc": {"stock": -it.quantity}},
            return_document=ReturnDocument.AFTER,
        )
        if updated is None:
            # rollback
            for pid, qty in decremented:
                await db.products.update_one({"id": pid}, {"$inc": {"stock": qty}})
            prod = await db.products.find_one({"id": it.product_id})
            avail = prod["stock"] if prod else 0
            raise HTTPException(400, f"Not enough stock for {it.name}. Available: {avail}")
        decremented.append((it.product_id, it.quantity))
        await record_stock_history(it.product_id, it.name, -it.quantity, updated["stock"], "sale", "")

    subtotal = sum(it.price * it.quantity for it in body.items)
    tax_amount = round((subtotal - body.discount) * body.tax_percent / 100, 2) if body.tax_percent else 0.0
    grand_total = round(subtotal - body.discount + tax_amount, 2)
    items_count = sum(it.quantity for it in body.items)

    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": await next_invoice_number(),
        "items": [it.dict() for it in body.items],
        "customer_id": body.customer_id,
        "customer_name": body.customer_name or "Walk-in Customer",
        "customer_phone": body.customer_phone,
        "subtotal": round(subtotal, 2),
        "discount": body.discount,
        "tax_percent": body.tax_percent,
        "tax_amount": tax_amount,
        "grand_total": grand_total,
        "items_count": items_count,
        "payment_method": body.payment_method,
        "status": "Paid",
        "date_key": today_key(),
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(invoice)

    if body.customer_id:
        await db.customers.update_one(
            {"id": body.customer_id},
            {"$inc": {"total_purchases": grand_total, "purchase_count": 1}},
        )
    invoice.pop("_id", None)
    return invoice


@api_router.get("/invoices")
async def list_invoices(search: str = ""):
    q = {}
    if search:
        q = {"$or": [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
        ]}
    return await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return doc


# ============================ Purchases ============================
@api_router.post("/purchases")
async def create_purchase(body: PurchaseIn):
    if not body.items:
        raise HTTPException(400, "No items to add")
    added = []
    for it in body.items:
        pid = it.product_id
        if pid:
            updated = await db.products.find_one_and_update(
                {"id": pid},
                {"$inc": {"stock": it.quantity},
                 "$set": {"cost_price": it.purchase_price, "supplier": body.supplier or ""}},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                await record_stock_history(pid, updated["name"], it.quantity, updated["stock"], "purchase",
                                           f"Invoice {body.invoice_number}")
                added.append(pid)
        else:
            # create new product
            count = await db.products.count_documents({})
            new = {
                "id": str(uuid.uuid4()),
                "sku": f"NP-{count + 1:04d}",
                "name": it.name,
                "botanical_name": "",
                "category": it.category or "",
                "photo_path": None,
                "cost_price": it.purchase_price,
                "selling_price": it.selling_price or round(it.purchase_price * 1.6, 2),
                "stock": it.quantity,
                "min_stock": 5.0,
                "supplier": body.supplier or "",
                "notes": "",
                "deleted_at": None,
                "created_at": now_iso(),
            }
            await db.products.insert_one(new)
            await record_stock_history(new["id"], new["name"], it.quantity, it.quantity, "purchase",
                                       f"Invoice {body.invoice_number}")
            added.append(new["id"])

    purchase = {
        "id": str(uuid.uuid4()),
        "supplier": body.supplier,
        "invoice_number": body.invoice_number,
        "date": body.date,
        "items": [it.dict() for it in body.items],
        "image_path": body.image_path,
        "total": body.total,
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(purchase)
    purchase.pop("_id", None)
    return purchase


@api_router.get("/purchases")
async def list_purchases():
    return await db.purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ============================ Dashboard ============================
@api_router.get("/dashboard/summary")
async def dashboard_summary():
    tk = today_key()
    todays = await db.invoices.find({"date_key": tk}, {"_id": 0}).to_list(2000)
    sales = sum(i["grand_total"] for i in todays)
    bills = len(todays)
    items_sold = sum(i.get("items_count", 0) for i in todays)
    cash = sum(i["grand_total"] for i in todays if i.get("payment_method") == "Cash")

    products = await db.products.find({"deleted_at": None}, {"_id": 0}).to_list(2000)
    low_stock = [p for p in products if p["stock"] <= p["min_stock"]]
    low_stock.sort(key=lambda p: p["stock"])
    return {
        "today": {
            "sales": round(sales, 2),
            "bills": bills,
            "items_sold": items_sold,
            "cash_collected": round(cash, 2),
        },
        "low_stock": low_stock[:20],
        "low_stock_count": len(low_stock),
        "total_products": len(products),
    }


# ============================ AI ============================
async def _run_ai(coro):
    try:
        return await coro
    except ai_client.BadImage as e:
        raise HTTPException(400, str(e))
    except ai_client.AIUnavailable as e:
        raise HTTPException(503, str(e))


@api_router.post("/ai/identify-plant")
async def ai_identify(body: ImagePayload):
    products = await db.products.find({"deleted_at": None}, {"_id": 0}).to_list(2000)
    catalog = [p["name"] for p in products]
    result = await _run_ai(ai_client.identify_plant(body.image_base64, catalog))

    matched = None
    name = result.get("matched_catalog_name", "")
    if name:
        matched = next((p for p in products if p["name"].lower() == name.lower()), None)
    if not matched:
        # fuzzy: match on plant_name substring
        pn = result.get("plant_name", "").lower()
        if pn:
            matched = next((p for p in products if pn in p["name"].lower() or p["name"].lower() in pn), None)
    result["matched_product"] = matched
    return result


@api_router.post("/ai/scan-invoice")
async def ai_scan_invoice(body: ImagePayload):
    result = await _run_ai(ai_client.scan_invoice(body.image_base64))
    # try to match each item to an existing product
    products = await db.products.find({"deleted_at": None}, {"_id": 0}).to_list(2000)
    for it in result["items"]:
        nm = it["name"].lower()
        match = next((p for p in products if nm and (nm in p["name"].lower() or p["name"].lower() in nm)), None)
        it["product_id"] = match["id"] if match else None
        it["matched_name"] = match["name"] if match else None
    return result


# ============================ Upload / Files ============================
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Photo too large (max 8 MB)")
    ext = (file.filename or "img.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{storage_client.APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or "image/jpeg"
    await run_in_threadpool(storage_client.put_object, path, data, content_type)
    await db.uploads.insert_one({"path": path, "created_at": now_iso()})
    return {"path": path}


@api_router.post("/upload-base64")
async def upload_base64(body: ImagePayload):
    raw = body.image_base64
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    data = base64.b64decode(raw)
    path = f"{storage_client.APP_NAME}/uploads/{uuid.uuid4()}.jpg"
    await run_in_threadpool(storage_client.put_object, path, data, "image/jpeg")
    await db.uploads.insert_one({"path": path, "created_at": now_iso()})
    return {"path": path}


@api_router.get("/files/{path:path}")
async def get_file(path: str):
    doc = await db.uploads.find_one({"path": path})
    if not doc:
        raise HTTPException(404, "File not found")
    try:
        content, ctype = await run_in_threadpool(storage_client.get_object, path)
    except Exception as e:
        logger.warning("File fetch failed for %s: %s", path, e)
        raise HTTPException(404, "File not found")
    return Response(content=content, media_type=ctype)


@api_router.get("/")
async def root():
    return {"message": "NurseryPOS API"}


app.include_router(api_router)


@app.middleware("http")
async def require_app_key(request: Request, call_next):
    """Shared-secret check so a public URL can't be used to read data or spend AI credits."""
    path = request.url.path
    exempt = (
        not APP_API_KEY
        or request.method == "OPTIONS"
        or not path.startswith("/api")
        or (request.method == "GET" and path.startswith("/api/files/"))
    )
    if not exempt:
        given = request.headers.get("x-app-key", "")
        if not hmac.compare_digest(given, APP_API_KEY):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await seed_if_empty(db)
        logger.info("Seed check complete")
    except Exception as e:
        logger.error("Seed failed: %s", e)
    try:
        await run_in_threadpool(storage_client.init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error("Storage init failed: %s", e)
    if not APP_API_KEY:
        logger.warning("APP_API_KEY is not set - API is open to anyone with the URL")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
