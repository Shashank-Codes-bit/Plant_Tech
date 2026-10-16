"""MongoDB handle shared by all routes. Tests replace `state.db` with an in-memory database."""
import os
from types import SimpleNamespace

from motor.motor_asyncio import AsyncIOMotorClient

state = SimpleNamespace(client=None, db=None)


def get_db():
    if state.db is None:
        state.client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        state.db = state.client[os.environ["DB_NAME"]]
    return state.db
