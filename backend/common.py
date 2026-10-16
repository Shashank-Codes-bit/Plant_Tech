"""Small shared helpers: ids, India time, Indian mobile numbers, money."""
import re
import uuid
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_ist() -> datetime:
    return datetime.now(IST)


def date_key(dt: datetime | None = None) -> str:
    """Calendar day in India, e.g. '2026-10-16' (what "today" means for a nursery)."""
    return (dt or now_ist()).astimezone(IST).strftime("%Y-%m-%d")


def normalize_in_phone(raw: str | None) -> str | None:
    """'98111 22334', '+91-98111-22334' or '098111…' -> '+919811122334'. None if not an Indian mobile."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        return None
    return "+91" + digits


def money(x: float) -> float:
    return round(float(x) + 1e-9, 2)


def name_key(name: str) -> str:
    """Case/spacing-insensitive key for matching product names ('Money  plant' == 'money plant')."""
    return re.sub(r"[^a-z0-9ऀ-ॿ]+", " ", (name or "").lower()).strip()
