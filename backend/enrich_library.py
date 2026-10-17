"""Look up the Hindi and other common names of shared catalogue entries that shops created, so search finds
them in any language (new entries get this automatically). Entries already looked up are skipped.

On the VM: docker compose exec web python enrich_library.py --limit 50
"""
import argparse
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from db import get_db  # noqa: E402
from routers import library  # noqa: E402


async def run(limit: int) -> int:
    db = get_db()
    todo = await db.library.find({"removed": False, "source": "shop", "enriched_at": None},
                                 {"_id": 0, "id": 1, "name": 1}).to_list(limit)
    for e in todo:
        await library.enrich(db, e["id"])
        print("looked up:", e["name"], flush=True)
    return len(todo)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=50, help="how many entries at most (one small AI call each)")
    print("done:", asyncio.run(run(ap.parse_args().limit)), "entries", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
