"""Seed sample nursery data on first run."""
import uuid
from datetime import datetime, timezone

DEFAULT_CATEGORIES = [
    "Indoor Plants", "Outdoor Plants", "Flowering Plants", "Succulents",
    "Cacti", "Trees", "Shrubs", "Herbs", "Pots", "Soil",
    "Fertilizers", "Gardening Accessories",
]

# name, botanical, category, cost, price, stock, min_stock
SAMPLE_PRODUCTS = [
    ("Money Plant", "Epipremnum aureum", "Indoor Plants", 120, 250, 14, 5),
    ("Snake Plant", "Dracaena trifasciata", "Indoor Plants", 200, 450, 2, 5),
    ("Areca Palm", "Dypsis lutescens", "Indoor Plants", 300, 599, 3, 5),
    ("Peace Lily", "Spathiphyllum wallisii", "Flowering Plants", 180, 399, 9, 4),
    ("Jade Plant", "Crassula ovata", "Succulents", 90, 199, 20, 6),
    ("Aloe Vera", "Aloe barbadensis", "Succulents", 70, 149, 25, 6),
    ("Rubber Plant", "Ficus elastica", "Indoor Plants", 250, 499, 11, 5),
    ("Spider Plant", "Chlorophytum comosum", "Indoor Plants", 80, 179, 18, 5),
    ("Ficus Bonsai", "Ficus benjamina", "Trees", 400, 899, 6, 3),
    ("Bougainvillea", "Bougainvillea glabra", "Flowering Plants", 150, 349, 12, 4),
    ("Hibiscus", "Hibiscus rosa-sinensis", "Flowering Plants", 120, 279, 15, 4),
    ("Rose Plant", "Rosa indica", "Flowering Plants", 100, 229, 22, 5),
    ("Golden Barrel Cactus", "Echinocactus grusonii", "Cacti", 130, 299, 8, 3),
    ("Echeveria Succulent", "Echeveria elegans", "Succulents", 60, 149, 30, 8),
    ("Ceramic Pot 10\"", "", "Pots", 90, 150, 4, 5),
    ("Plastic Pot 8\"", "", "Pots", 25, 60, 50, 10),
    ("Potting Soil 5kg", "", "Soil", 80, 149, 40, 10),
    ("Organic Fertilizer 1kg", "", "Fertilizers", 90, 180, 35, 8),
]


async def seed_if_empty(db):
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        now = datetime.now(timezone.utc).isoformat()
        await db.categories.insert_many([
            {"id": str(uuid.uuid4()), "name": c, "created_at": now} for c in DEFAULT_CATEGORIES
        ])

    prod_count = await db.products.count_documents({})
    if prod_count == 0:
        now = datetime.now(timezone.utc).isoformat()
        docs = []
        for i, (name, bot, cat, cost, price, stock, mins) in enumerate(SAMPLE_PRODUCTS, start=1):
            docs.append({
                "id": str(uuid.uuid4()),
                "sku": f"NP-{i:04d}",
                "name": name,
                "botanical_name": bot,
                "category": cat,
                "photo_path": None,
                "cost_price": float(cost),
                "selling_price": float(price),
                "stock": float(stock),
                "min_stock": float(mins),
                "supplier": "Green Garden Suppliers",
                "notes": "",
                "deleted_at": None,
                "created_at": now,
            })
        await db.products.insert_many(docs)
