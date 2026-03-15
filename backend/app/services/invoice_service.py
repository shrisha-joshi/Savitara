"""GST invoice and fee-breakdown service for bookings."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings


class InvoiceService:
    """Builds transparent booking fee breakdown and GST invoice documents."""

    PLATFORM_FEE_RATE = Decimal("0.10")
    GST_RATE = Decimal("0.18")

    @staticmethod
    def _q(value: Any) -> Decimal:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def _safe_subtotal_from_booking(cls, booking: Dict[str, Any]) -> Decimal:
        platform_fee = cls._q(booking.get("platform_fee"))
        discount = cls._q(booking.get("discount"))
        total_amount = cls._q(booking.get("total_amount"))

        if platform_fee > 0:
            subtotal = (platform_fee / cls.PLATFORM_FEE_RATE).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            divisor = Decimal("1.00") + cls.PLATFORM_FEE_RATE + cls.GST_RATE
            subtotal = ((total_amount + discount) / divisor).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        return max(subtotal, Decimal("0.00"))

    @classmethod
    def build_fee_breakdown(cls, booking: Dict[str, Any]) -> Dict[str, Any]:
        """Return transparent fee breakdown derived from persisted booking values."""
        base_price = cls._q(booking.get("base_price"))
        samagri_fee = cls._q(booking.get("samagri_price"))
        discount = cls._q(booking.get("discount"))
        platform_fee = cls._q(booking.get("platform_fee"))
        subtotal = cls._safe_subtotal_from_booking(booking)
        gst = (subtotal * cls.GST_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total = cls._q(booking.get("total_amount"))

        return {
            "currency": "INR",
            "base_price": float(base_price),
            "samagri_fee": float(samagri_fee),
            "subtotal_before_fees": float(subtotal),
            "platform_fee": float(platform_fee),
            "gst": {
                "rate": float(cls.GST_RATE),
                "amount": float(gst),
            },
            "discount": float(discount),
            "total_amount": float(total),
        }

    @classmethod
    def _split_gst(cls, gst_amount: Decimal, place_of_supply: str) -> Dict[str, float]:
        """Split GST into CGST/SGST for intra-state else IGST."""
        normalized = (place_of_supply or "").strip().lower()
        home_state = (settings.BUSINESS_GST_HOME_STATE or "").strip().lower()

        if home_state and normalized and normalized == home_state:
            half = (gst_amount / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return {"cgst": float(half), "sgst": float(half), "igst": 0.0}

        return {"cgst": 0.0, "sgst": 0.0, "igst": float(gst_amount)}

    @staticmethod
    def _new_invoice_number(now: datetime) -> str:
        stamp = now.strftime("%Y%m%d")
        suffix = ObjectId().__str__()[-6:].upper()
        return f"SAV-INV-{stamp}-{suffix}"

    @classmethod
    async def get_or_create_gst_invoice(
        cls,
        db: AsyncIOMotorDatabase,
        *,
        booking: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Get existing invoice for booking or generate a new one idempotently."""
        booking_id = booking.get("_id")
        existing = await db.invoices.find_one({"booking_id": booking_id})
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        breakdown = cls.build_fee_breakdown(booking)
        gst_amount = cls._q(breakdown["gst"]["amount"])

        place_of_supply = (
            (booking.get("location") or {}).get("state")
            or settings.BUSINESS_GST_HOME_STATE
            or "Unknown"
        )
        gst_split = cls._split_gst(gst_amount, str(place_of_supply))

        invoice_doc = {
            "invoice_number": cls._new_invoice_number(now),
            "invoice_type": "gst_tax_invoice",
            "booking_id": booking_id,
            "booking_reference": str(booking_id),
            "issued_at": now,
            "currency": "INR",
            "seller": {
                "name": settings.BUSINESS_LEGAL_NAME,
                "gstin": settings.BUSINESS_GSTIN,
                "address": settings.BUSINESS_ADDRESS,
                "state": settings.BUSINESS_GST_HOME_STATE,
            },
            "buyer": {
                "grihasta_id": str(booking.get("grihasta_id")),
                "place_of_supply": str(place_of_supply),
            },
            "line_items": [
                {
                    "description": booking.get("service_name") or "Spiritual consultation service",
                    "sac_code": settings.BUSINESS_SERVICE_SAC_CODE,
                    "taxable_value": breakdown["subtotal_before_fees"],
                    "platform_fee": breakdown["platform_fee"],
                    "discount": breakdown["discount"],
                }
            ],
            "tax": {
                "gst_rate": breakdown["gst"]["rate"],
                "gst_amount": breakdown["gst"]["amount"],
                **gst_split,
            },
            "totals": {
                "subtotal_before_fees": breakdown["subtotal_before_fees"],
                "platform_fee": breakdown["platform_fee"],
                "discount": breakdown["discount"],
                "grand_total": breakdown["total_amount"],
            },
            "created_at": now,
            "updated_at": now,
        }

        await db.invoices.insert_one(invoice_doc)
        return invoice_doc
