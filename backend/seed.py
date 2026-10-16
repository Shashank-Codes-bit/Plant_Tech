"""Starter categories for a new nursery (no demo products: every shop starts empty)."""
import uuid
from datetime import datetime, timezone

DEFAULT_CATEGORIES = [
    "Indoor Plants", "Outdoor Plants", "Flowering Plants", "Succulents",
    "Cacti", "Trees", "Shrubs", "Herbs", "Pots", "Soil",
    "Fertilizers", "Gardening Accessories",
]


async def seed_if_empty(db):
    if await db.categories.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await db.categories.insert_many([
            {"id": str(uuid.uuid4()), "name": c, "created_at": now} for c in DEFAULT_CATEGORIES
        ])
