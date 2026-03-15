"""Data retention and archival lifecycle executor (A29)."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient


RETENTION_RULES = {
    "analytics_events": 90,
    "notifications": 180,
    "outbox_events": 30,
}


async def main() -> int:
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "savitara")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    try:
        now = datetime.now(timezone.utc)
        for collection, days in RETENTION_RULES.items():
            cutoff = now - timedelta(days=days)
            archive_collection = db[f"{collection}_archive"]
            source = db[collection]

            docs = await source.find({"created_at": {"$lt": cutoff}}).to_list(length=500)
            if docs:
                await archive_collection.insert_many(docs)
                ids = [doc["_id"] for doc in docs if "_id" in doc]
                if ids:
                    await source.delete_many({"_id": {"$in": ids}})
                print(f"Archived {len(docs)} docs from {collection}")
            else:
                print(f"No archival candidates for {collection}")

        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
