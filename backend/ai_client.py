"""Claude-powered plant identification and purchase-invoice OCR.

Both first decide what the photo shows, so a laptop is never offered as a product and a plant photo
is never read as a bill; the routes turn that verdict into a clear message for the user.
"""
import os
import io
import base64
import logging
from typing import List, Literal

import anthropic
from PIL import Image, ImageOps
from pydantic import BaseModel

logger = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
EFFORT_PLANT = os.environ.get("CLAUDE_EFFORT_PLANT", "low")
EFFORT_INVOICE = os.environ.get("CLAUDE_EFFORT_INVOICE", "medium")
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_IMAGE_EDGE = 1568  # longest edge Claude uses without further downscaling

_client = None


class AIUnavailable(Exception):
    """Claude could not be reached or is rate limited; safe to retry."""


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()  # reads ANTHROPIC_API_KEY
    return _client


SYSTEM_PLANT = (
    "You are an expert botanist and plant nursery assistant in India. You identify plants and the "
    "products a plant nursery sells from photos taken at a nursery counter, and you say so plainly when "
    "a photo shows something else."
)
SYSTEM_INVOICE = (
    "You are an OCR and data extraction assistant for a plant nursery in India. You extract supplier "
    "purchase invoice details from photos of bills. Bills may be printed or handwritten and may mix "
    "English and Hindi. You say so plainly when a photo is not a bill."
)
NURSERY_GOODS = (
    "pots, planters, grow bags, hanging baskets, trays, soil, potting mix, compost, cocopeat, manure, "
    "fertiliser, pesticide, seeds, bulbs, pebbles, garden decor, plant stands, garden tools, watering cans "
    "and sprayers"
)


class PlantId(BaseModel):
    kind: Literal["plant", "nursery_product", "bill", "other"]
    reason: str
    plant_name: str
    scientific_name: str
    confidence: int
    alternatives: List[str]
    matched_catalog_name: str
    suggested_category: str


class InvoiceItem(BaseModel):
    name: str
    quantity: float
    purchase_price: float


class BillPage(BaseModel):
    page: int
    is_bill: bool
    supplier: str
    supplier_gstin: str
    invoice_number: str


class InvoiceScan(BaseModel):
    is_bill: bool
    reason: str
    pages: List[BillPage]
    same_supplier: bool
    same_bill: bool
    supplier: str
    supplier_phone: str
    supplier_address: str
    supplier_gstin: str
    invoice_number: str
    date: str
    total: float
    items: List[InvoiceItem]


class BadImage(Exception):
    """The uploaded payload is not a readable image."""


def normalize_photo(data: bytes) -> bytes:
    """Check the bytes are a real image; fix EXIF rotation, downscale, re-encode as JPEG."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as e:
        raise BadImage("This photo could not be read. Please take it again.") from e
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def decode_b64(image_base64: str) -> bytes:
    """Base64 (a data: URL prefix is allowed) to bytes."""
    raw = image_base64.strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw)
    except Exception as e:
        raise BadImage("This photo could not be read. Please take it again.") from e


def normalize_photo_b64(image_base64: str) -> bytes:
    """Like normalize_photo, for base64 input."""
    return normalize_photo(decode_b64(image_base64))


def square_thumbnail(jpeg: bytes, size: int = 800) -> bytes:
    """Centre-crop to a square and shrink, for the shared picture library."""
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img.thumbnail((size, size))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def fit_thumbnail(jpeg: bytes, size: int = 160) -> bytes:
    """Shrink to fit inside size x size, keeping the shape (shop logos are often wide)."""
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    img.thumbnail((size, size))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _image_block(data: bytes) -> dict:
    jpeg = base64.standard_b64encode(normalize_photo(data)).decode("ascii")
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": jpeg}}


async def _ask(system: str, prompt: str, images: list[bytes], schema, effort: str, max_tokens: int):
    """Send photos (pages of one bill are labelled) + prompt; the parsed schema object, or None on refusal."""
    content: list[dict] = []
    for i, data in enumerate(images, 1):
        if len(images) > 1:
            content.append({"type": "text", "text": f"Page {i} of {len(images)}"})
        content.append(_image_block(data))
    content.append({"type": "text", "text": prompt})
    try:
        resp = await _get_client().beta.messages.parse(
            model=MODEL_NAME,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": content}],
            output_format=schema,
            output_config={"effort": effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except anthropic.RateLimitError as e:
        logger.warning("Claude rate limited: %s", e)
        raise AIUnavailable("Photo recognition is busy. Please try again in a moment.") from e
    except anthropic.APIStatusError as e:
        logger.error("Claude API error %s: %s", e.status_code, e)
        if e.status_code >= 500:
            raise AIUnavailable("Photo recognition is unavailable right now. Please try again.") from e
        raise
    except anthropic.APIConnectionError as e:
        logger.error("Claude connection error: %s", e)
        raise AIUnavailable("Could not reach the photo recognition service. Please check your internet connection.") from e
    except ValueError as e:
        # Output did not validate against the schema (e.g. refusal text or truncation).
        logger.warning("Claude output not parseable: %s", e)
        return None

    u = resp.usage
    logger.info("Claude %s stop=%s in=%s out=%s", resp.model, resp.stop_reason,
                u.input_tokens, u.output_tokens)
    if resp.stop_reason == "refusal":
        logger.warning("Claude declined: %s", resp.stop_details)
        return None
    return resp.parsed_output


async def identify_plant(image: bytes, catalog: list[str], categories: list[str] | None = None) -> dict:
    """What the photo shows; for a plant or nursery product, its name, stock match and category.

    kind is "plant", "nursery_product", "bill", "other", or "unknown" when Claude gave no usable answer.
    """
    catalog_text = ", ".join(catalog[:120]) if catalog else "none"
    categories = categories or []
    category_text = ", ".join(categories) if categories else "none"
    prompt = (
        "First decide what this photo mainly shows:\n"
        "- kind: 'plant' for a living plant, sapling, cutting, seedling or bulb (potted or not); "
        f"'nursery_product' for something a plant nursery sells: {NURSERY_GOODS}; "
        "'bill' for a bill, invoice, receipt, challan or any other printed or handwritten document; "
        "'other' for anything else (people, animals, electronics, screens, food, furniture, vehicles, rooms).\n"
        "- reason: a few words explaining the kind\n"
        "If kind is 'bill' or 'other', leave every text field below empty, confidence 0 and alternatives empty.\n"
        "Otherwise identify the plant or product.\n"
        f"The nursery currently stocks these products: {catalog_text}.\n"
        f"Its product categories are: {category_text}.\n"
        "- plant_name: common commercial name as used in Indian nurseries (for a product, a short name "
        "such as 'Terracotta Pot 8 inch')\n"
        "- scientific_name: botanical name, or empty string\n"
        "- confidence: integer 0-100\n"
        "- alternatives: up to 3 alternative common names\n"
        "- matched_catalog_name: the single closest product name from the stocked list, "
        "copied exactly, or empty string if none is a good match\n"
        "- suggested_category: the best fitting category from the category list, copied exactly, "
        "or empty string"
    )
    data = await _ask(SYSTEM_PLANT, prompt, [image], PlantId, EFFORT_PLANT, 2000)
    if data is None:
        return {"kind": "unknown", "reason": "no usable answer", "plant_name": "", "scientific_name": "",
                "confidence": 0, "confidence_label": "Low", "alternatives": [], "matched_catalog_name": "",
                "suggested_category": ""}
    category_by_lower = {c.lower(): c for c in categories}
    conf = max(0, min(100, data.confidence))
    label = "High" if conf >= 80 else ("Medium" if conf >= 50 else "Low")
    return {
        "kind": data.kind,
        "reason": data.reason,
        "plant_name": data.plant_name.strip(),
        "scientific_name": data.scientific_name.strip(),
        "confidence": conf,
        "confidence_label": label,
        "alternatives": [a.strip() for a in data.alternatives[:3] if a.strip()],
        "matched_catalog_name": data.matched_catalog_name.strip(),
        "suggested_category": category_by_lower.get(data.suggested_category.strip().lower(), ""),
    }


async def scan_invoice(images: list[bytes], shop_name: str = "") -> dict:
    """Read a supplier bill from one or more photos of its pages.

    is_bill is False when the photos are not a bill (or Claude gave no usable answer); per page, what
    each page shows, so the route can refuse pages of different suppliers or different bills.
    """
    n = len(images)
    buyer = f"The buyer is the nursery {shop_name!r}; never report it as the supplier.\n" if shop_name.strip() else ""
    prompt = (
        f"These {n} photo(s) should be the page(s) of one supplier bill, invoice, cash memo or delivery challan.\n"
        "- is_bill: true only if they show such a document; false for plants, products, people, screens or anything else\n"
        "- reason: a few words explaining is_bill\n"
        "- pages: for each photo in order, page (1-based), is_bill, and the supplier name, supplier GSTIN and "
        "invoice number printed on that page (empty strings when that page does not show them, e.g. a continuation page)\n"
        "- same_supplier: false if the pages clearly come from different suppliers\n"
        "- same_bill: false if the pages clearly come from different bills (different invoice numbers or dates)\n"
        "If is_bill is false, leave every field below empty or 0 and items empty.\n"
        "Otherwise extract the purchase invoice details:\n"
        f"{buyer}"
        "- supplier (the seller's business name), supplier_phone, supplier_address, supplier_gstin, "
        "invoice_number, date (as printed): empty string if missing\n"
        "- total: grand total as a number, 0 if missing\n"
        "- items: every line item exactly once across all pages (skip subtotal, carried-forward and tax lines); "
        "purchase_price is the per-unit cost (divide the line amount by quantity if only the amount is printed)"
    )
    data = await _ask(SYSTEM_INVOICE, prompt, images, InvoiceScan, EFFORT_INVOICE, 16000 if n > 1 else 8000)
    if data is None:
        data = InvoiceScan(is_bill=False, reason="no usable answer", pages=[], same_supplier=True, same_bill=True,
                           supplier="", supplier_phone="", supplier_address="", supplier_gstin="", invoice_number="",
                           date="", total=0, items=[])
    return {
        "is_bill": data.is_bill,
        "reason": data.reason,
        "pages": [pg.model_dump() for pg in data.pages],
        "same_supplier": data.same_supplier,
        "same_bill": data.same_bill,
        "supplier": data.supplier.strip(),
        "supplier_phone": data.supplier_phone.strip(),
        "supplier_address": data.supplier_address.strip(),
        "supplier_gstin": data.supplier_gstin.strip(),
        "invoice_number": data.invoice_number.strip(),
        "date": data.date.strip(),
        "total": data.total,
        "items": [
            {"name": it.name.strip(), "quantity": it.quantity, "purchase_price": it.purchase_price}
            for it in data.items if it.name.strip()
        ],
    }
