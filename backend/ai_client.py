"""Gemini-powered plant identification and purchase-invoice OCR."""
import os
import json
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"


def _extract_json(text: str) -> dict:
    """Pull a JSON object out of a model response that may be fenced."""
    if not text:
        return {}
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # remove ```json ... ``` fences
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(cleaned[start:end + 1])
    except Exception as e:
        logger.warning("Failed to parse AI JSON: %s", e)
        return {}


async def identify_plant(image_base64: str, catalog: list[str]) -> dict:
    """Identify a plant from a photo and try to match to the inventory catalog."""
    catalog_text = ", ".join(catalog[:120]) if catalog else "none"
    system = (
        "You are an expert botanist and plant nursery assistant. "
        "You identify plants and nursery products from photos. "
        "You always respond with ONLY a compact JSON object, no prose, no markdown fences."
    )
    prompt = (
        "Identify the plant or nursery product in this photo.\n"
        f"The nursery currently stocks these products: {catalog_text}.\n"
        "Return JSON with EXACTLY these keys:\n"
        "{\n"
        '  "plant_name": string (common commercial name),\n'
        '  "scientific_name": string (botanical name or empty string),\n'
        '  "confidence": integer 0-100,\n'
        '  "alternatives": array of up to 3 alternative common names,\n'
        '  "matched_catalog_name": the single closest product name from the stocked list, or empty string if none is a good match\n'
        "}"
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"identify-{uuid.uuid4()}",
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=image_base64)])
    resp = await chat.send_message(msg)
    data = _extract_json(resp if isinstance(resp, str) else str(resp))

    conf = data.get("confidence", 0)
    try:
        conf = int(conf)
    except Exception:
        conf = 0
    label = "High" if conf >= 80 else ("Medium" if conf >= 50 else "Low")
    return {
        "plant_name": data.get("plant_name", "Unknown Plant"),
        "scientific_name": data.get("scientific_name", ""),
        "confidence": conf,
        "confidence_label": label,
        "alternatives": data.get("alternatives", []) or [],
        "matched_catalog_name": data.get("matched_catalog_name", "") or "",
    }


async def scan_invoice(image_base64: str) -> dict:
    """Extract structured purchase-invoice data from a photo."""
    system = (
        "You are an OCR and data extraction assistant for a plant nursery. "
        "You extract supplier purchase invoice details from a photo. "
        "You always respond with ONLY a compact JSON object, no prose, no markdown fences."
    )
    prompt = (
        "Extract the purchase invoice details from this photo.\n"
        "Return JSON with EXACTLY these keys:\n"
        "{\n"
        '  "supplier": string,\n'
        '  "invoice_number": string,\n'
        '  "date": string (as printed, or empty),\n'
        '  "total": number,\n'
        '  "items": [ { "name": string, "quantity": number, "purchase_price": number } ]\n'
        "}\n"
        "purchase_price is the per-unit cost. If a field is missing use empty string or 0."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"invoice-{uuid.uuid4()}",
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=image_base64)])
    resp = await chat.send_message(msg)
    data = _extract_json(resp if isinstance(resp, str) else str(resp))

    items = []
    for it in data.get("items", []) or []:
        try:
            qty = float(it.get("quantity", 0) or 0)
        except Exception:
            qty = 0
        try:
            price = float(it.get("purchase_price", 0) or 0)
        except Exception:
            price = 0
        items.append({
            "name": str(it.get("name", "")).strip(),
            "quantity": qty,
            "purchase_price": price,
        })
    try:
        total = float(data.get("total", 0) or 0)
    except Exception:
        total = 0
    return {
        "supplier": data.get("supplier", "") or "",
        "invoice_number": data.get("invoice_number", "") or "",
        "date": data.get("date", "") or "",
        "total": total,
        "items": items,
    }
