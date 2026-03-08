"""
Panchanga API Endpoints
Hindu calendar information - Tithi, Nakshatra, Muhurat, Festivals
"""
from fastapi import APIRouter, Depends, Query, status
from typing import Annotated, Dict, Any
import logging
from datetime import date, datetime

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
    user_lat: float = _DEFAULT_LAT
    user_lon: float = _DEFAULT_LON
    user_type: str = "lunar"

    if current_user:
        loc = current_user.get("location") or {}
        if req_lat is None and loc.get("latitude"):
            user_lat = float(loc["latitude"])
        if req_lon is None and loc.get("longitude"):
            user_lon = float(loc["longitude"])
        stored_type = current_user.get("panchanga_type")
        if req_type is None and stored_type in ("lunar", "solar"):
            user_type = stored_type
        elif req_type in ("lunar", "solar"):
            user_type = req_type
    else:
        if req_lat is not None:
            user_lat = req_lat
        if req_lon is not None:
            user_lon = req_lon
        if req_type in ("lunar", "solar"):
            user_type = req_type

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
    latitude: Annotated[float, Query(description="Location latitude")] = 28.6139,
    longitude: Annotated[float, Query(description="Location longitude")] = 77.2090,
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
