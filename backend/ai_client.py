"""Claude-powered plant identification and purchase-invoice OCR."""
import os
import io
import base64
import logging
from typing import List

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


class PlantId(BaseModel):
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


class InvoiceScan(BaseModel):
    supplier: str
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
        raise BadImage("Could not read the photo, please retake it") from e
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def normalize_photo_b64(image_base64: str) -> bytes:
    """Like normalize_photo, for base64 input (a data: URL prefix is allowed)."""
    raw = image_base64.strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw)
    except Exception as e:
        raise BadImage("Could not read the photo, please retake it") from e
    return normalize_photo(data)


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


def _prepare_image(image_base64: str) -> str:
    return base64.standard_b64encode(normalize_photo_b64(image_base64)).decode("ascii")


async def _ask(system: str, prompt: str, image_base64: str, schema, effort: str, max_tokens: int):
    """Send one photo + prompt to Claude; return the parsed schema object, or None on refusal."""
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                     "data": _prepare_image(image_base64)}},
        {"type": "text", "text": prompt},
    ]
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
        raise AIUnavailable("AI is busy, please try again in a moment") from e
    except anthropic.APIStatusError as e:
        logger.error("Claude API error %s: %s", e.status_code, e)
        if e.status_code >= 500:
            raise AIUnavailable("AI service error, please try again") from e
        raise
    except anthropic.APIConnectionError as e:
        logger.error("Claude connection error: %s", e)
        raise AIUnavailable("Could not reach AI service, check internet") from e
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


async def identify_plant(image_base64: str, catalog: list[str], categories: list[str] | None = None) -> dict:
    """Identify a plant from a photo, match it to the inventory catalog and suggest a category."""
    catalog_text = ", ".join(catalog[:120]) if catalog else "none"
    categories = categories or []
    category_text = ", ".join(categories) if categories else "none"
    system = (
        "You are an expert botanist and plant nursery assistant in India. "
        "You identify plants and nursery products (pots, soil, fertilizers, tools) from photos "
        "taken at a nursery counter."
    )
    prompt = (
        "Identify the plant or nursery product in this photo.\n"
        f"The nursery currently stocks these products: {catalog_text}.\n"
        f"Its product categories are: {category_text}.\n"
        "- plant_name: common commercial name as used in Indian nurseries\n"
        "- scientific_name: botanical name, or empty string\n"
        "- confidence: integer 0-100\n"
        "- alternatives: up to 3 alternative common names\n"
        "- matched_catalog_name: the single closest product name from the stocked list, "
        "copied exactly, or empty string if none is a good match\n"
        "- suggested_category: the best fitting category from the category list, copied exactly, "
        "or empty string"
    )
    data = await _ask(system, prompt, image_base64, PlantId, EFFORT_PLANT, 2000)
    if data is None:
        data = PlantId(plant_name="Unknown Plant", scientific_name="", confidence=0,
                       alternatives=[], matched_catalog_name="", suggested_category="")
    category_by_lower = {c.lower(): c for c in categories}

    conf = max(0, min(100, data.confidence))
    label = "High" if conf >= 80 else ("Medium" if conf >= 50 else "Low")
    return {
        "plant_name": data.plant_name or "Unknown Plant",
        "scientific_name": data.scientific_name,
        "confidence": conf,
        "confidence_label": label,
        "alternatives": data.alternatives[:3],
        "matched_catalog_name": data.matched_catalog_name,
        "suggested_category": category_by_lower.get(data.suggested_category.strip().lower(), ""),
    }


async def scan_invoice(image_base64: str) -> dict:
    """Extract structured purchase-invoice data from a photo."""
    system = (
        "You are an OCR and data extraction assistant for a plant nursery in India. "
        "You extract supplier purchase invoice details from a photo. Bills may be printed "
        "or handwritten and may mix English and Hindi."
    )
    prompt = (
        "Extract the purchase invoice details from this photo.\n"
        "- supplier, invoice_number, date (as printed): empty string if missing\n"
        "- total: grand total as a number, 0 if missing\n"
        "- items: one entry per line item; purchase_price is the per-unit cost "
        "(divide the line amount by quantity if only the amount is printed)"
    )
    data = await _ask(system, prompt, image_base64, InvoiceScan, EFFORT_INVOICE, 8000)
    if data is None:
        data = InvoiceScan(supplier="", invoice_number="", date="", total=0, items=[])

    return {
        "supplier": data.supplier,
        "invoice_number": data.invoice_number,
        "date": data.date,
        "total": data.total,
        "items": [
            {"name": it.name.strip(), "quantity": it.quantity, "purchase_price": it.purchase_price}
            for it in data.items
        ],
    }
