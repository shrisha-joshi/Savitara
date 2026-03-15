"""Consistency checker between payment records and booking states (A26)."""

from __future__ import annotations

import asyncio
import os

from motor.motor_asyncio import AsyncIOMotorClient


async def main() -> int:
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "savitara")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    try:
        mismatches = []
        cursor = db.bookings.find({"payment_status": "completed"}, {"_id": 1, "razorpay_payment_id": 1, "status": 1})
        async for booking in cursor:
            if not booking.get("razorpay_payment_id"):
                mismatches.append(str(booking["_id"]))
                continue
            payment = await db.payments.find_one({"razorpay_payment_id": booking["razorpay_payment_id"]})
            if not payment:
                mismatches.append(str(booking["_id"]))
        if mismatches:
            print("Consistency mismatches:", mismatches)
            return 1
        print("Payment-booking consistency check passed")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
