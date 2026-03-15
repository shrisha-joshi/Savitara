"""Zero-downtime migration framework runner (A18 baseline)."""

from __future__ import annotations

import asyncio
import importlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, List

from motor.motor_asyncio import AsyncIOMotorClient


@dataclass
class MigrationSpec:
    name: str
    module: str


MIGRATIONS: List[MigrationSpec] = [
    MigrationSpec(name="2026_03_15_fix_query_defaults", module="backend.scripts.migrations.fix_query_defaults"),
]


async def run_migrations(mongodb_url: str, db_name: str) -> None:
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    try:
        applied = db.schema_migrations
        for migration in MIGRATIONS:
            exists = await applied.find_one({"name": migration.name})
            if exists:
                print(f"SKIP {migration.name}")
                continue

            module = importlib.import_module(migration.module)
            up: Callable = getattr(module, "run", None) or getattr(module, "main", None)
            if up is None:
                raise RuntimeError(f"Migration module {migration.module} has no run/main")

            result = up()
            if asyncio.iscoroutine(result):
                await result

            await applied.insert_one(
                {
                    "name": migration.name,
                    "applied_at": datetime.now(timezone.utc),
                    "status": "applied",
                }
            )
            print(f"APPLIED {migration.name}")
    finally:
        client.close()


if __name__ == "__main__":
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        raise SystemExit("Missing backend/.env")

    cfg = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip()

    asyncio.run(run_migrations(cfg["MONGODB_URL"], cfg.get("MONGODB_DB_NAME", "savitara")))
