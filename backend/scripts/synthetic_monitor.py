"""Synthetic monitoring for critical flows (A20)."""

from __future__ import annotations

import asyncio
from typing import Dict

import httpx


CRITICAL_ENDPOINTS = [
    ("health", "/health"),
    ("api_root", "/api"),
    ("auth_ping", "/api/v1/auth/check-email"),
]


async def probe(base_url: str) -> Dict[str, str]:
    result = {}
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        for name, path in CRITICAL_ENDPOINTS:
            try:
                if name == "auth_ping":
                    resp = await client.post(path, json={"email": "synthetic@example.com", "password": ""})
                else:
                    resp = await client.get(path)
                result[name] = f"{resp.status_code}"
            except Exception as exc:  # noqa: BLE001
                result[name] = f"error:{type(exc).__name__}"
    return result


async def main() -> int:
    checks = await probe("http://localhost:8000")
    failed = {k: v for k, v in checks.items() if v.startswith("error") or v.startswith("5")}
    print("Synthetic checks:", checks)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
