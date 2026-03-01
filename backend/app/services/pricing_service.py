"""
Dynamic Pricing Service
"""
from datetime import datetime, timezone
from typing import Dict, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class PricingMultiplier(float, Enum):
    """Pricing multipliers for different scenarios"""

    WEEKEND = 1.5  # Dynamic Pricing: 1.5x on weekends
    URGENT_BOOKING = 1.5  # < 24 hours notice
    PEAK_HOURS = 1.2  # 5 PM - 10 PM
    OFF_PEAK_DISCOUNT = 0.85  # 15% off weekday mornings (Strategy Report §6.7)
    FESTIVAL = 1.3  # Special occasions
    PLATFORM_FEE = 0.10  # 10%
    GST = 0.18  # 18% GST


class PricingService:
    """
    Dynamic pricing service for bookings
    Factors:
    - Weekend pricing
    - Peak hours
    - Urgent bookings (< 24 hours)
    - Special occasions/festivals
    - Samagri inclusion
    - Platform fees and taxes
    """

    PEAK_HOURS = [(17, 22)]  # 5 PM - 10 PM
    OFF_PEAK_HOURS = [(6, 10)]  # 6 AM - 10 AM weekday mornings (Strategy Report §6.7)

    # Festival dates are NOT hardcoded here — they follow the Hindu lunar calendar
    # and change every year.  PricingService._is_festival_day() delegates to
    # PanchangaService which uses MAJOR_FESTIVALS (the single source of truth).
    # To add/edit festival dates, update panchanga_service.py::MAJOR_FESTIVALS.

    @classmethod
    def _is_festival_day(cls, booking_datetime: datetime) -> Optional[str]:
        """Return festival name if booking_datetime falls on a known festival, else None.

        Delegates to PanchangaService so there is a single source of truth for
        Hindu festival dates.  Silently returns None on any error.
        """
        try:
            from app.services.panchanga_service import PanchangaService  # lazy import avoids circular deps
            svc = PanchangaService()
            festivals = svc.get_festivals_for_date(booking_datetime.date())
            if festivals:
                return festivals[0]["name"]
        except Exception as exc:  # noqa: BLE001
            logger.debug("PanchangaService festival lookup failed: %s", exc)
        return None

    @classmethod
    def calculate_price(
        cls,
        base_price: float,
        booking_datetime: datetime,
        has_samagri: bool = False,
        duration_hours: int = 2,
    ) -> Dict[str, float]:
        """
        Calculate dynamic pricing with breakdown

        Returns:
            Dict with price breakdown and total
        """
        breakdown = {
            "base_price": base_price * duration_hours,
            "surcharges": {},
            "fees": {},
            "total": 0.0,
        }

        subtotal = breakdown["base_price"]

        # Weekend pricing (Saturday/Sunday)
        if booking_datetime.weekday() >= 5:
            weekend_surcharge = subtotal * (PricingMultiplier.WEEKEND.value - 1)
            breakdown["surcharges"]["weekend"] = round(weekend_surcharge, 2)
            subtotal += weekend_surcharge

        # Peak hours (5 PM - 10 PM)
        hour = booking_datetime.hour
        if any(start <= hour < end for start, end in cls.PEAK_HOURS):
            peak_surcharge = subtotal * (PricingMultiplier.PEAK_HOURS.value - 1)
            breakdown["surcharges"]["peak_hours"] = round(peak_surcharge, 2)
            subtotal += peak_surcharge

        # Off-peak discount — weekday mornings 6-10 AM (Strategy Report §6.7)
        is_weekday = booking_datetime.weekday() < 5
        if is_weekday and any(
            start <= hour < end for start, end in cls.OFF_PEAK_HOURS
        ):
            off_peak_discount = subtotal * (1 - PricingMultiplier.OFF_PEAK_DISCOUNT.value)
            breakdown["surcharges"]["off_peak_discount"] = round(-off_peak_discount, 2)
            subtotal -= off_peak_discount

        # Urgent booking (< 24 hours notice)
        # Use timezone-aware now() so comparison works whether booking_datetime is
        # naive or aware (SonarQube S6971 / Python datetime best-practice).
        now_utc = datetime.now(timezone.utc)
        bdt_aware = (
            booking_datetime
            if booking_datetime.tzinfo is not None
            else booking_datetime.replace(tzinfo=timezone.utc)
        )
        hours_until = (bdt_aware - now_utc).total_seconds() / 3600
        if 0 < hours_until < 24:
            urgent_surcharge = subtotal * (PricingMultiplier.URGENT_BOOKING.value - 1)
            breakdown["surcharges"]["urgent_booking"] = round(urgent_surcharge, 2)
            subtotal += urgent_surcharge

        # Festival/Special occasion — delegated to PanchangaService (single source of truth)
        festival_name = cls._is_festival_day(booking_datetime)
        if festival_name:
            festival_surcharge = subtotal * (PricingMultiplier.FESTIVAL.value - 1)
            breakdown["surcharges"]["festival"] = round(festival_surcharge, 2)
            breakdown["surcharges"]["festival_name"] = festival_name
            subtotal += festival_surcharge

        # Samagri cost
        if has_samagri:
            samagri_cost = 200 * duration_hours  # ₹200 per hour
            breakdown["fees"]["samagri"] = samagri_cost
            subtotal += samagri_cost

        # Platform fee (10% of subtotal before tax)
        platform_fee = subtotal * PricingMultiplier.PLATFORM_FEE.value
        breakdown["fees"]["platform_fee"] = round(platform_fee, 2)

        # GST (18%)
        taxes = subtotal * PricingMultiplier.GST.value
        breakdown["fees"]["gst"] = round(taxes, 2)

        # Calculate total
        total = subtotal + platform_fee + taxes
        breakdown["total"] = round(total, 2)
        breakdown["subtotal"] = round(subtotal, 2)

        return breakdown

    @classmethod
    def estimate_acharya_earnings(cls, total_amount: float) -> Dict[str, float]:
        """
        Calculate how much acharya will earn after platform fees

        Args:
            total_amount: Total booking amount including all fees

        Returns:
            Breakdown of earnings
        """
        # Remove GST first
        amount_without_gst = total_amount / (1 + PricingMultiplier.GST.value)

        # Remove platform fee
        amount_without_platform_fee = amount_without_gst / (
            1 + PricingMultiplier.PLATFORM_FEE.value
        )

        platform_fee = amount_without_gst - amount_without_platform_fee
        gst = total_amount - amount_without_gst

        return {
            "total_booking_amount": round(total_amount, 2),
            "platform_fee": round(platform_fee, 2),
            "gst": round(gst, 2),
            "acharya_earnings": round(amount_without_platform_fee, 2),
        }

    @classmethod
    def get_price_estimate(
        cls,
        base_hourly_rate: float,
        booking_datetime: datetime,
        duration_hours: int = 2,
        has_samagri: bool = False,
    ) -> Dict[str, any]:
        """
        Get price estimate for display to user before booking

        Returns detailed breakdown for transparency
        """
        pricing = cls.calculate_price(
            base_price=base_hourly_rate,
            booking_datetime=booking_datetime,
            has_samagri=has_samagri,
            duration_hours=duration_hours,
        )

        return {
            "estimate": pricing,
            "duration_hours": duration_hours,
            "hourly_rate": base_hourly_rate,
            "booking_datetime": booking_datetime.isoformat(),
            "currency": "INR",
        }
