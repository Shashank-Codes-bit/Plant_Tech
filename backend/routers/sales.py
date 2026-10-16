"""Orders (bills): create with stock deduction and tax-inclusive GST, list, share link, today, reports.

Workers see only the orders they made; owners (and workers with the reports permission) see all.
"""
import base64
import os
import re
import secrets
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

import ai_client
import auth
import invoice_html
import storage_client
from common import IST, date_key, money, new_id, normalize_in_phone, now_ist, now_iso
from db import get_db
from routers import drafts
from routers.products import context, record_stock

router = APIRouter(prefix="/api", tags=["sales"])
public_router = APIRouter(tags=["public"])


class LineIn(BaseModel):
    product_id: str | None = None  # None = "bill without stock" (a loose item)
    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)


class InvoiceIn(BaseModel):
    items: list[LineIn] = Field(min_length=1)
    customer_id: str | None = None  # a saved customer; or give the phone (+ name for a new one)
    customer_name: str = Field("", max_length=80)
    customer_phone: str = Field("", max_length=20)
    discount: float = Field(0, ge=0)
    payment_method: Literal["Cash", "UPI", "Card"] = "Cash"


def price_lines(lines: list[dict], discount: float) -> dict:
    """Prices include GST. Spread any discount over the lines, then split out each line's tax:
    tax = amount * rate / (100 + rate). Returns the totals and a per-rate GST breakup."""
    subtotal = sum(l["price"] * l["quantity"] for l in lines)
    discount = min(discount, subtotal)
    factor = (subtotal - discount) / subtotal if subtotal else 1
    breakup: dict[float, dict] = {}
    for l in lines:
        l["amount"] = money(l["price"] * l["quantity"])
        net = l["price"] * l["quantity"] * factor
        rate = l.get("gst_percent", 0)
        tax = net * rate / (100 + rate) if rate else 0
        l["net"], l["tax"] = money(net), money(tax)
        if rate:
            b = breakup.setdefault(rate, {"rate": rate, "taxable": 0.0, "tax": 0.0})
            b["taxable"] += net - tax
            b["tax"] += tax
    gst = [{"rate": b["rate"], "taxable": money(b["taxable"]), "tax": money(b["tax"])}
           for b in sorted(breakup.values(), key=lambda b: b["rate"])]
    return {"subtotal": money(subtotal), "discount": money(discount), "grand_total": money(subtotal - discount),
            "gst_breakup": gst, "gst_total": money(sum(b["tax"] for b in gst))}


def _sees_all(user: dict) -> bool:
    return auth.can(user, "owner") or auth.can(user, "reports")


def _scope(user: dict) -> dict:
    q = {"business_id": user["business_id"]}
    if not _sees_all(user):
        q["created_by.id"] = user["id"]
    return q


def _summary(inv: dict) -> dict:
    return {k: inv.get(k) for k in ("id", "invoice_number", "customer_name", "customer_phone", "grand_total",
                                    "payment_method", "created_at", "created_by")} | {
        "items_count": sum(i["quantity"] for i in inv.get("items", []))}


async def _next_number(db, business_id: str) -> str:
    doc = await db.counters.find_one_and_update({"_id": f"invoice:{business_id}"}, {"$inc": {"seq": 1}},
                                                upsert=True, return_document=ReturnDocument.AFTER)
    return f"INV-{doc['seq']:04d}"


@router.post("/invoices")
async def create_invoice(body: InvoiceIn, user: dict = Depends(auth.require("sell"))):
    db = get_db()
    bid = user["business_id"]
    cats, gst_registered = await context(db, bid)
    ids = list({l.product_id for l in body.items if l.product_id})
    products = {p["id"]: p for p in await db.products.find(
        {"business_id": bid, "id": {"$in": ids}, "deleted_at": None}, {"_id": 0}).to_list(len(ids) or 1)}
    if missing := [i for i in ids if i not in products]:
        raise HTTPException(400, f"{len(missing)} item(s) in this order are no longer in your products")

    # Every bill has a customer (name + phone): a saved one, or a new one made from the phone and name.
    customer, new_customer = None, None
    if body.customer_id:
        customer = await db.customers.find_one({"id": body.customer_id, "business_id": bid}, {"_id": 0})
        if not customer:
            raise HTTPException(400, "Customer not found")
    else:
        phone = normalize_in_phone(body.customer_phone)
        if not phone:
            raise HTTPException(400, "Choose the customer for this order")
        customer = await db.customers.find_one({"business_id": bid, "phone": phone}, {"_id": 0})
        if not customer:
            if not body.customer_name.strip():
                raise HTTPException(400, "Enter the customer's name")
            new_customer = {"id": new_id(), "business_id": bid, "name": body.customer_name.strip(), "phone": phone,
                            "email": "", "address": "", "notes": "", "total_purchases": 0.0, "purchase_count": 0,
                            "created_at": now_iso()}

    # Take the stock first; give it back if any product doesn't have enough.
    taken: list[tuple[str, float]] = []
    wanted: dict[str, float] = {}
    for l in body.items:
        if l.product_id:
            wanted[l.product_id] = wanted.get(l.product_id, 0) + l.quantity
    for pid, qty in wanted.items():
        updated = await db.products.find_one_and_update(
            {"id": pid, "business_id": bid, "stock": {"$gte": qty}}, {"$inc": {"stock": -qty}},
            projection={"_id": 0}, return_document=ReturnDocument.AFTER)
        if updated is None:
            for back_id, back_qty in taken:
                await db.products.update_one({"id": back_id}, {"$inc": {"stock": back_qty}})
            p = products[pid]
            have = (await db.products.find_one({"id": pid}, {"stock": 1})) or {}
            raise HTTPException(400, f"Only {have.get('stock', 0):g} {p['name']} left in stock")
        taken.append((pid, qty))
        await record_stock(db, user, updated, -qty, updated["stock"], "sale")

    lines = []
    for l in body.items:
        p = products.get(l.product_id) if l.product_id else None
        cat = cats.get(p.get("category_id")) if p else None
        lines.append({"product_id": l.product_id, "name": l.name.strip(), "quantity": l.quantity, "price": l.price,
                      "gst_percent": (cat or {}).get("gst_percent", 0) if gst_registered else 0,
                      "cost_price": (p or {}).get("cost_price", 0)})
    totals = price_lines(lines, body.discount)

    if new_customer:
        await db.customers.insert_one(new_customer)
        new_customer.pop("_id", None)
        customer = new_customer
    customer_id, customer_name, phone = customer["id"], customer["name"], customer.get("phone", "")

    invoice = {
        "id": new_id(), "business_id": bid, "invoice_number": await _next_number(db, bid), "items": lines,
        **totals, "payment_method": body.payment_method, "status": "Paid",
        "customer_id": customer_id, "customer_name": customer_name, "customer_phone": phone or "",
        "created_by": {"id": user["id"], "name": user.get("name", "")},
        "public_token": secrets.token_urlsafe(16), "date_key": date_key(), "created_at": now_iso(),
    }
    await db.invoices.insert_one(invoice)
    await drafts.clear(db, user["id"])  # the order is billed: its draft is done
    if customer_id:
        await db.customers.update_one({"id": customer_id},
                                      {"$inc": {"total_purchases": invoice["grand_total"], "purchase_count": 1},
                                       "$set": {"last_purchase_at": invoice["created_at"]}})
    invoice.pop("_id", None)
    return invoice


DATE = r"\d{4}-\d{2}-\d{2}"


def _filters(user: dict, day: str, date_from: str, date_to: str, method: str, made_by: str, search: str) -> dict:
    """Orders filter shared by the list and its totals. Workers only ever see their own bills."""
    q = _scope(user)
    if day:
        q["date_key"] = day
    elif date_from or date_to:
        q["date_key"] = {k: v for k, v in (("$gte", date_from), ("$lte", date_to)) if v}
    if method:
        q["payment_method"] = method
    if made_by and _sees_all(user):
        q["created_by.id"] = made_by
    if search.strip():
        text = re.escape(search.strip())
        digits = re.sub(r"\D", "", search)
        ors = [{f: {"$regex": text, "$options": "i"}} for f in ("invoice_number", "customer_name")]
        if len(digits) >= 3:
            ors.append({"customer_phone": {"$regex": digits[-10:]}})
        q["$or"] = ors
    return q


def date_q():  # a fresh Query per parameter: FastAPI must not share one between parameters
    return Query("", pattern=f"^({DATE})?$")


def method_q():
    return Query("", pattern="^(Cash|UPI|Card)?$")


@router.get("/invoices")
async def list_invoices(day: str = date_q(), date_from: str = date_q(), date_to: str = date_q(),
                        method: str = method_q(), made_by: str = "", search: str = Query("", max_length=60),
                        before: str = "", limit: int = Query(50, ge=1, le=200),
                        user: dict = Depends(auth.require("sell"))):
    """Newest first. For the next page pass `before` = created_at of the last bill you got."""
    q = _filters(user, day, date_from, date_to, method, made_by, search)
    if before:
        q["created_at"] = {"$lt": before}
    invs = await get_db().invoices.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [_summary(i) for i in invs]


@router.get("/invoices/summary")
async def invoices_summary(day: str = date_q(), date_from: str = date_q(), date_to: str = date_q(),
                           method: str = method_q(), made_by: str = "", search: str = Query("", max_length=60),
                           user: dict = Depends(auth.require("sell"))):
    """Totals for the same filters as the list: all of them, not just the loaded page, and per day."""
    q = _filters(user, day, date_from, date_to, method, made_by, search)
    invs = await get_db().invoices.find(q, {"_id": 0, "grand_total": 1, "payment_method": 1, "date_key": 1}).to_list(200000)
    by_method = {"Cash": 0.0, "UPI": 0.0, "Card": 0.0}
    by_day: dict[str, dict] = {}
    for i in invs:
        by_method[i.get("payment_method", "Cash")] = by_method.get(i.get("payment_method", "Cash"), 0) + i["grand_total"]
        d = by_day.setdefault(i["date_key"], {"orders": 0, "sales": 0.0})
        d["orders"] += 1
        d["sales"] += i["grand_total"]
    return {"orders": len(invs), "sales": money(sum(i["grand_total"] for i in invs)),
            "by_method": {k: money(v) for k, v in by_method.items()},
            "by_day": {k: {"orders": v["orders"], "sales": money(v["sales"])} for k, v in by_day.items()}}


async def _get_invoice(user: dict, invoice_id: str) -> dict:
    inv = await get_db().invoices.find_one({**_scope(user), "id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Bill not found")
    return inv


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(auth.require("sell"))):
    return await _get_invoice(user, invoice_id)


@router.get("/invoices/{invoice_id}/share")
async def share_invoice(invoice_id: str, request: Request, user: dict = Depends(auth.require("sell"))):
    """Link to the customer's bill page (sent on WhatsApp). Needs no login; the token can't be guessed."""
    inv = await _get_invoice(user, invoice_id)
    token = inv.get("public_token")
    if not token:
        token = secrets.token_urlsafe(16)
        await get_db().invoices.update_one({"id": invoice_id}, {"$set": {"public_token": token}})
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/") or str(request.base_url).rstrip("/")
    return {"token": token, "url": f"{base}/i/{token}"}


_logo_cache: dict[str, str] = {}


async def _logo_src(biz: dict) -> str | None:
    """The shop's logo as a small inline image, so it shows in the bill page and in saved PDFs (even offline)."""
    path = biz.get("logo_path")
    if not path:
        return None
    if path not in _logo_cache:
        try:
            data, _ = await run_in_threadpool(storage_client.get_object, path)
            small = await run_in_threadpool(ai_client.fit_thumbnail, data)
        except Exception:
            return None
        if len(_logo_cache) > 500:
            _logo_cache.clear()
        _logo_cache[path] = "data:image/jpeg;base64," + base64.b64encode(small).decode()
    return _logo_cache[path]


@router.get("/invoices/{invoice_id}/html", response_class=HTMLResponse)
async def invoice_page_for_print(invoice_id: str, user: dict = Depends(auth.require("sell"))):
    inv = await _get_invoice(user, invoice_id)
    biz = await get_db().businesses.find_one({"id": user["business_id"]}, {"_id": 0}) or {}
    return HTMLResponse(invoice_html.render(inv, biz, public=False, logo_src=await _logo_src(biz)))


@public_router.get("/i/{token}", response_class=HTMLResponse, include_in_schema=False)
async def public_bill(token: str):
    db = get_db()
    inv = await db.invoices.find_one({"public_token": token}, {"_id": 0}) if len(token) >= 16 else None
    if not inv:
        return HTMLResponse("<h1>Bill not found</h1>", status_code=404, headers={"X-Robots-Tag": "noindex"})
    biz = await db.businesses.find_one({"id": inv["business_id"]}, {"_id": 0}) or {}
    return HTMLResponse(invoice_html.render(inv, biz, logo_src=await _logo_src(biz)), headers={"X-Robots-Tag": "noindex"})


@router.get("/dashboard/today")
async def today(user: dict = Depends(auth.require("sell"))):
    """Home screen: today's sales and orders. Workers see only their own."""
    invs = await get_db().invoices.find({**_scope(user), "date_key": date_key()},
                                        {"_id": 0}).sort("created_at", -1).to_list(5000)
    by_method = {"Cash": 0.0, "UPI": 0.0, "Card": 0.0}
    for i in invs:
        by_method[i.get("payment_method", "Cash")] = by_method.get(i.get("payment_method", "Cash"), 0) + i["grand_total"]
    return {"scope": "shop" if _sees_all(user) else "mine", "date": date_key(),
            "sales": money(sum(i["grand_total"] for i in invs)), "orders": len(invs),
            "by_method": {k: money(v) for k, v in by_method.items()}, "recent": [_summary(i) for i in invs[:20]]}


def _report_buckets(range_: str, anchor: date) -> tuple[list[str], list[str], callable]:
    """(day keys to load, bucket labels, invoice -> bucket index) for the day, the Monday-Sunday week,
    or the calendar month that contains `anchor`."""
    if range_ == "day":
        labels = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"]

        def idx(inv):
            hour = datetime.fromisoformat(inv["created_at"]).astimezone(IST).hour
            return min(max((hour - 8) // 2, 0), len(labels) - 1)
        return [anchor.isoformat()], labels, idx
    if range_ == "week":
        monday = anchor - timedelta(days=anchor.weekday())
        days = [monday + timedelta(days=d) for d in range(7)]
        keys = [d.isoformat() for d in days]
        return keys, [f"{d.strftime('%a')} {d.day}" for d in days], lambda inv: keys.index(inv["date_key"])
    first = anchor.replace(day=1)
    last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    keys = [(first + timedelta(days=d)).isoformat() for d in range(last.day)]
    labels = [f"{s}–{min(s + 6, last.day)}" for s in range(1, last.day + 1, 7)]
    return keys, labels, lambda inv: (int(inv["date_key"][-2:]) - 1) // 7


@router.get("/reports/sales")
async def sales_report(range: Literal["day", "today", "week", "month"] = "week",  # noqa: A002
                       on: str = Query("", alias="date", pattern=f"^({DATE})?$"),
                       user: dict = Depends(auth.require("reports"))):
    """Sales for a day, a week (Monday to Sunday) or a month; `date` picks which one (default: today)."""
    anchor = datetime.strptime(on, "%Y-%m-%d").date() if on else now_ist().date()
    range = "day" if range == "today" else range  # noqa: A001
    keys, labels, idx = _report_buckets(range, anchor)
    invs = await get_db().invoices.find({"business_id": user["business_id"], "date_key": {"$in": keys}},
                                        {"_id": 0}).to_list(50000)
    buckets = [0.0] * len(labels)
    by_method = {"Cash": 0.0, "UPI": 0.0, "Card": 0.0}
    sold: dict[str, float] = {}
    profit = 0.0
    for inv in invs:
        buckets[idx(inv)] += inv["grand_total"]
        by_method[inv.get("payment_method", "Cash")] += inv["grand_total"]
        for it in inv["items"]:
            sold[it["name"]] = sold.get(it["name"], 0) + it["quantity"]
            if it.get("cost_price"):  # profit only counts items with a known cost
                profit += (it.get("net", it["price"] * it["quantity"]) - it.get("tax", 0)) - it["cost_price"] * it["quantity"]
    top = sorted(sold.items(), key=lambda kv: -kv[1])[:5]
    return {"range": range, "start": keys[0], "end": keys[-1],
            "sales": money(sum(i["grand_total"] for i in invs)), "orders": len(invs),
            "profit": money(profit), "buckets": [{"label": l, "sales": money(v)} for l, v in zip(labels, buckets)],
            "by_method": {k: money(v) for k, v in by_method.items()},
            "top": [{"name": n, "quantity": q} for n, q in top]}
