"""
Panchanga API Endpoints
Hindu calendar information - Tithi, Nakshatra, Muhurat, Festivals
"""
from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
from datetime import date, datetime

from app.schemas.requests import StandardResponse
from app.core.security import get_current_user
from app.db.connection import get_db
from app.services.panchanga_service import panchanga_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/panchanga", tags=["Panchanga"])


@router.get(
    "/today",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Today's Panchanga",
    description="Get complete Panchanga for today including Tithi, Nakshatra, Muhurat, and festivals"
)
async def get_today_panchanga(
    latitude: float = Query(28.6139, description="Location latitude (default: Delhi)"),
    longitude: float = Query(77.2090, description="Location longitude (default: Delhi)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get today's Panchanga information"""
    try:
        today = date.today()
        panchanga = panchanga_service.get_daily_panchanga(today, latitude, longitude)
        
        return {
            "success": True,
            "message": "Today's Panchanga retrieved successfully",
            "data": panchanga
        }
    except Exception as e:
        logger.error(f"Error fetching today's panchanga: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/date/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Panchanga for Date",
    description="Get complete Panchanga for a specific date"
)
async def get_panchanga_for_date(
    date_str: str,
    latitude: float = Query(28.6139, description="Location latitude"),
    longitude: float = Query(77.2090, description="Location longitude"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Panchanga for a specific date"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        panchanga = panchanga_service.get_daily_panchanga(target_date, latitude, longitude)
        
        return {
            "success": True,
            "message": f"Panchanga for {date_str} retrieved successfully",
            "data": panchanga
        }
    except ValueError as e:
        return {
            "success": False,
            "message": "Invalid date format. Use YYYY-MM-DD",
            "data": None
        }
    except Exception as e:
        logger.error(f"Error fetching panchanga for {date_str}: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/muhurat/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Muhurat Timings",
    description="Get auspicious muhurat timings for a specific date"
)
async def get_muhurat_timings(
    date_str: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get muhurat timings for a date"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        muhurats = panchanga_service.get_auspicious_muhurat(target_date)
        rahu_kalam = panchanga_service.calculate_rahu_kalam(target_date)
        
        return {
            "success": True,
            "message": "Muhurat timings retrieved successfully",
            "data": {
                "date": date_str,
                "auspicious_muhurats": muhurats,
                "rahu_kalam": rahu_kalam
            }
        }
    except Exception as e:
        logger.error(f"Error fetching muhurat for {date_str}: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/festivals/upcoming",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Upcoming Festivals",
    description="Get list of upcoming Hindu festivals"
)
async def get_upcoming_festivals(
    count: int = Query(10, ge=1, le=50, description="Number of festivals to return"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get upcoming festivals"""
    try:
        festivals = panchanga_service.get_upcoming_festivals(count)
        
        return {
            "success": True,
            "message": "Upcoming festivals retrieved successfully",
            "data": {
                "festivals": festivals,
                "count": len(festivals)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching upcoming festivals: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/ekadashi/{year}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Ekadashi Dates",
    description="Get all Ekadashi dates for a specific year"
)
async def get_ekadashi_dates(
    year: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Ekadashi dates for a year"""
    try:
        ekadashis = panchanga_service.get_ekadashi_dates(year)
        
        return {
            "success": True,
            "message": f"Ekadashi dates for {year} retrieved successfully",
            "data": {
                "year": year,
                "ekadashis": ekadashis,
                "count": len(ekadashis)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching ekadashi dates for {year}: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/check-auspicious",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Auspicious Date",
    description="Check if a date is auspicious for a specific activity"
)
async def check_auspicious_date(
    date_str: str = Query(..., description="Date in YYYY-MM-DD format"),
    activity: str = Query(..., description="Activity: marriage, travel, grihapravesh, business, purchase"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Check if date is auspicious for activity"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        result = panchanga_service.is_auspicious_for(target_date, activity)
        
        return {
            "success": True,
            "message": "Auspiciousness check completed",
            "data": result
        }
    except ValueError:
        return {
            "success": False,
            "message": "Invalid date format. Use YYYY-MM-DD",
            "data": None
        }
    except Exception as e:
        logger.error(f"Error checking auspiciousness: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/tithi/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Tithi",
    description="Get Tithi (lunar day) information for a specific date"
)
async def get_tithi(
    date_str: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Tithi for a date"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        tithi = panchanga_service.calculate_tithi(target_date)
        
        return {
            "success": True,
            "message": "Tithi retrieved successfully",
            "data": {
                "date": date_str,
                "tithi": tithi
            }
        }
    except Exception as e:
        logger.error(f"Error fetching tithi: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }


@router.get(
    "/nakshatra/{date_str}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Nakshatra",
    description="Get Nakshatra (lunar mansion) information for a specific date"
)
async def get_nakshatra(
    date_str: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get Nakshatra for a date"""
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        nakshatra = panchanga_service.calculate_nakshatra(target_date)
        
        return {
            "success": True,
            "message": "Nakshatra retrieved successfully",
            "data": {
                "date": date_str,
                "nakshatra": nakshatra
            }
        }
    except Exception as e:
        logger.error(f"Error fetching nakshatra: {e}", exc_info=True)
        return {
            "success": False,
            "message": str(e),
            "data": None
        }
