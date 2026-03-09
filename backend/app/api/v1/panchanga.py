"""
Panchanga API Endpoints
Hindu calendar information - Tithi, Nakshatra, Muhurat, Festivals
"""
import calendar as cal_module
from fastapi import APIRouter, Depends, Query, status
from typing import Annotated, Dict, Any, List
import logging
from datetime import date, datetime, timedelta

from app.schemas.requests import StandardResponse
from app.core.security import get_current_user
from app.services.panchanga_service import panchanga_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/panchanga", tags=["Panchanga"])

_DEFAULT_LAT = 28.6139  # Delhi
_DEFAULT_LON = 77.2090


def _effective_params(
    current_user: Dict[str, Any] | None,
    req_lat: float | None = None,
    req_lon: float | None = None,
    req_type: str | None = None,
) -> tuple[float, float, str]:
    """
    Merge request-level params with the authenticated user's stored profile values.
    ``None`` means "caller did not provide a value" — use the user's stored profile
    value if available, or fall back to the Delhi defaults.
    """
    # Start with sensible defaults
    user_lat = _DEFAULT_LAT
    user_lon = _DEFAULT_LON
    user_type = "lunar"

    # Location resolution: prefer an explicit request value, then user's stored profile, then defaults
    if req_lat is not None:
        user_lat = float(req_lat)
    elif current_user:
        loc = current_user.get("location") or {}
        if loc.get("latitude"):
            user_lat = float(loc["latitude"])

    if req_lon is not None:
        user_lon = float(req_lon)
    elif current_user:
        loc = current_user.get("location") or {}
        if loc.get("longitude"):
            user_lon = float(loc["longitude"])

    # Panchanga type: explicit request overrides, otherwise user's stored preference if valid
    if req_type in ("lunar", "solar"):
        user_type = req_type
    elif current_user:
        stored_type = current_user.get("panchanga_type")
        if stored_type in ("lunar", "solar"):
            user_type = stored_type

    return user_lat, user_lon, user_type


@router.get(
    "/today",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Today's Panchanga",
    description="Get complete Panchanga for today including Tithi, Nakshatra, Muhurat, and festivals",
)
async def get_today_panchanga(
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(
        description="Location longitude (default: user profile or Delhi)"
    )] = None,
    panchanga_type: Annotated[str | None, Query(
        description="Panchanga system: 'lunar' (Chandramana) or 'solar' (Souramana); defaults to user profile"
    )] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Get today's Panchanga information"""
    try:
        # Use authenticated user's stored location/type as smarter defaults
        eff_lat, eff_lon, eff_type = _effective_params(
            current_user, latitude, longitude, panchanga_type
        )
        today = date.today()
        panchanga = panchanga_service.get_daily_panchanga(
            today, eff_lat, eff_lon, eff_type
        )

        return {
            "success": True,
            "message": "Today's Panchanga retrieved successfully",
            "data": panchanga,
        }
    except Exception as e:
        logger.error(f"Error fetching today's panchanga: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/date/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Panchanga for Date",
    description="Get complete Panchanga for a specific date",
)
async def get_panchanga_for_date(
    date_str: str,
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(description="Location longitude (default: user profile or Delhi)")] = None,
    panchanga_type: Annotated[str | None, Query(
        description="Panchanga system: 'lunar' or 'solar'; defaults to user profile"
    )] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Get Panchanga for a specific date"""
    try:
        eff_lat, eff_lon, eff_type = _effective_params(
            current_user, latitude, longitude, panchanga_type
        )
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        panchanga = panchanga_service.get_daily_panchanga(
            target_date, eff_lat, eff_lon, eff_type
        )

        return {
            "success": True,
            "message": f"Panchanga for {date_str} retrieved successfully",
            "data": panchanga,
        }
    except ValueError:
        return {
            "success": False,
            "message": "Invalid date format. Use YYYY-MM-DD",
            "data": None,
        }
    except Exception as e:
        logger.error(f"Error fetching panchanga for {date_str}: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/muhurat/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Muhurat Timings",
    description="Get auspicious muhurat timings for a specific date",
)
async def get_muhurat_timings(
    date_str: str,
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(description="Location longitude (default: user profile or Delhi)")] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Get muhurat timings for a date"""
    try:
        eff_lat, eff_lon, _ = _effective_params(current_user, latitude, longitude)
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        muhurats = panchanga_service.get_auspicious_muhurat(target_date, eff_lat, eff_lon)
        rahu_kalam = panchanga_service.calculate_rahu_kalam(target_date, eff_lat, eff_lon)

        return {
            "success": True,
            "message": "Muhurat timings retrieved successfully",
            "data": {
                "date": date_str,
                "auspicious_muhurats": muhurats,
                "rahu_kalam": rahu_kalam,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching muhurat for {date_str}: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/festivals/upcoming",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Upcoming Festivals",
    description="Get list of upcoming Hindu festivals",
)
async def get_upcoming_festivals(
    count: Annotated[int, Query(ge=1, le=50, description="Number of festivals to return")] = 10,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Get upcoming festivals"""
    try:
        festivals = panchanga_service.get_upcoming_festivals(count)

        return {
            "success": True,
            "message": "Upcoming festivals retrieved successfully",
            "data": {"festivals": festivals, "count": len(festivals)},
        }
    except Exception as e:
        logger.error(f"Error fetching upcoming festivals: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/ekadashi/{year}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Ekadashi Dates",
    description="Get all Ekadashi dates for a specific year",
)
async def get_ekadashi_dates(
    year: int, current_user: Annotated[Dict[str, Any], Depends(get_current_user)]
):
    """Get Ekadashi dates for a year"""
    try:
        ekadashis = panchanga_service.get_ekadashi_dates(year)

        return {
            "success": True,
            "message": f"Ekadashi dates for {year} retrieved successfully",
            "data": {"year": year, "ekadashis": ekadashis, "count": len(ekadashis)},
        }
    except Exception as e:
        logger.error(f"Error fetching ekadashi dates for {year}: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/check-auspicious",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Auspicious Date",
    description="Check if a date is auspicious for a specific activity",
)
async def check_auspicious_date(
    date_str: Annotated[str, Query(..., description="Date in YYYY-MM-DD format")],
    activity: Annotated[str, Query(
        ..., description="Activity: marriage, travel, grihapravesh, business, purchase"
    )],
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(description="Location longitude (default: user profile or Delhi)")] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Check if date is auspicious for activity"""
    try:
        eff_lat, eff_lon, _ = _effective_params(current_user, latitude, longitude)
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        result = panchanga_service.is_auspicious_for(target_date, activity, eff_lat, eff_lon)

        return {
            "success": True,
            "message": "Auspiciousness check completed",
            "data": result,
        }
    except ValueError:
        return {
            "success": False,
            "message": "Invalid date format. Use YYYY-MM-DD",
            "data": None,
        }
    except Exception as e:
        logger.error(f"Error checking auspiciousness: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/tithi/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Tithi",
    description="Get Tithi (lunar day) information for a specific date",
)
async def get_tithi(
    date_str: str,
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(description="Location longitude (default: user profile or Delhi)")] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Get Tithi for a date"""
    try:
        eff_lat, eff_lon, _ = _effective_params(current_user, latitude, longitude)
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        tithi = panchanga_service.calculate_tithi(target_date, eff_lat, eff_lon)

        return {
            "success": True,
            "message": "Tithi retrieved successfully",
            "data": {"date": date_str, "tithi": tithi},
        }
    except Exception as e:
        logger.error(f"Error fetching tithi: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/nakshatra/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Nakshatra",
    description="Get Nakshatra (lunar mansion) information for a specific date",
)
async def get_nakshatra(
    date_str: str, current_user: Annotated[Dict[str, Any], Depends(get_current_user)]
):
    """Get Nakshatra for a date"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        nakshatra = panchanga_service.calculate_nakshatra(target_date)

        return {
            "success": True,
            "message": "Nakshatra retrieved successfully",
            "data": {"date": date_str, "nakshatra": nakshatra},
        }
    except Exception as e:
        logger.error(f"Error fetching nakshatra: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/month/{year}/{month}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Monthly Panchanga",
    description="Get Tithi, Nakshatra, festivals and key info for every day in a month — useful for calendar views",
)
async def get_monthly_panchanga(
    year: int,
    month: int,
    latitude: Annotated[float | None, Query(description="Location latitude (default: user profile or Delhi)")] = None,
    longitude: Annotated[float | None, Query(description="Location longitude (default: user profile or Delhi)")] = None,
    panchanga_type: Annotated[str | None, Query(
        description="'lunar' (Chandramana) or 'solar' (Souramana)"
    )] = None,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Return a lightweight Panchanga summary for every day in the requested month."""
    try:
        if not (1 <= month <= 12):
            return {"success": False, "message": "Month must be 1–12", "data": None}
        if not (1000 <= year <= 9999):
            return {"success": False, "message": "Invalid year", "data": None}

        eff_lat, eff_lon, eff_type = _effective_params(
            current_user, latitude, longitude, panchanga_type
        )
        days_in_month = cal_module.monthrange(year, month)[1]
        results: List[Dict[str, Any]] = []
        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            pan = panchanga_service.get_daily_panchanga(d, eff_lat, eff_lon, eff_type)
            # Return a lightweight summary (full data would be too large for 31 days)
            results.append({
                "date": d.isoformat(),
                "day_of_week": pan["day_of_week"],
                "day_of_week_sa": pan.get("day_of_week_sa", ""),
                "tithi": {
                    "number": pan["tithi"]["number"],
                    "name": pan["tithi"]["name"],
                    "name_sa": pan["tithi"]["name_sa"],
                    "paksha": pan["tithi"]["paksha"],
                    "end_time": pan.get("tithi_end_time"),
                },
                "nakshatra": {
                    "number": pan["nakshatra"]["number"],
                    "name": pan["nakshatra"]["name"],
                    "name_sa": pan["nakshatra"]["name_sa"],
                    "end_time": pan.get("nakshatra_end_time"),
                },
                "yoga": {"name": pan["yoga"]["name"], "name_sa": pan["yoga"]["name_sa"]},
                "sunrise": pan["sunrise"],
                "sunset": pan["sunset"],
                "month_name": pan.get("month_name", ""),
                "panchanga_type": pan.get("panchanga_type", eff_type),
                "festivals": pan.get("festivals", []),
                "is_ekadashi": pan["tithi"].get("is_ekadashi", False),
                "is_full_moon": pan["tithi"].get("is_full_moon", False),
                "is_new_moon": pan["tithi"].get("is_new_moon", False),
                "rahu_kalam": pan.get("rahu_kalam", {}),
            })

        return {
            "success": True,
            "message": f"Monthly Panchanga for {year}-{month:02d} retrieved successfully",
            "data": {
                "year": year,
                "month": month,
                "days": results,
                "count": len(results),
                "panchanga_type": eff_type,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching monthly panchanga for {year}-{month}: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/yearly-summary/{year}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Yearly Panchanga Summary",
    description="Get key Panchanga info (Samvatsara, festivals, Ekadashi dates) for a year",
)
async def get_yearly_summary(
    year: int,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Return Samvatsara, Ekadashi dates, and all festivals for a year."""
    try:
        if not (1000 <= year <= 9999):
            return {"success": False, "message": "Invalid year", "data": None}
        # Compute era info for mid-year reference
        mid_year = date(year, 7, 1)
        pan_mid = panchanga_service.get_daily_panchanga(mid_year)
        ekadashis = panchanga_service.get_ekadashi_dates(year)
        upcoming = panchanga_service.get_upcoming_festivals(50)
        year_festivals = [f for f in upcoming if f["date"].startswith(str(year))]
        return {
            "success": True,
            "message": f"Yearly summary for {year} retrieved successfully",
            "data": {
                "year": year,
                "samvatsara": pan_mid.get("samvatsara"),
                "vikrama_samvat": pan_mid.get("vikrama_samvat"),
                "shaka_samvat": pan_mid.get("shaka_samvat"),
                "kali_yuga": pan_mid.get("kali_yuga"),
                "ekadashi_dates": ekadashis,
                "festivals": year_festivals,
            },
        }
    except Exception as e:
        logger.error(f"Error fetching yearly summary for {year}: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}

