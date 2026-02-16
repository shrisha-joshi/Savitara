"""
Wallet API Endpoints
In-app wallet for credits, transactions, and payments
"""
from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
from pydantic import BaseModel, Field

from app.schemas.requests import StandardResponse
from app.core.security import get_current_user, get_current_acharya
from app.core.exceptions import InsufficientCreditsError, InvalidInputError
from app.db.connection import get_db
from app.services.wallet_service import WalletService, TransactionType

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/wallet", tags=["Wallet"])


# Request models
class AddMoneyRequest(BaseModel):
    """Request to add money to wallet"""

    amount: float = Field(..., gt=0, description="Amount to add")
    payment_id: str = Field(..., description="Payment reference ID from Razorpay")


class PayFromWalletRequest(BaseModel):
    """Request to pay from wallet"""

    amount: float = Field(..., gt=0, description="Amount to pay")
    booking_id: Optional[str] = Field(None, description="Booking reference ID")
    description: str = Field(..., description="Payment description")


class WithdrawalRequest(BaseModel):
    """Request to withdraw money"""

    amount: float = Field(..., gt=0, description="Amount to withdraw")
    account_holder: str = Field(..., description="Bank account holder name")
    account_number: str = Field(..., description="Bank account number")
    ifsc_code: str = Field(..., description="Bank IFSC code")
    bank_name: str = Field(..., description="Bank name")


@router.get(
    "/balance",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Wallet Balance",
    description="Get current wallet balance including main and bonus balance",
)
async def get_wallet_balance(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get wallet balance"""
    try:
        wallet_service = WalletService(db)
        balance = await wallet_service.get_balance(current_user["id"])

        return {
            "success": True,
            "message": "Wallet balance retrieved successfully",
            "data": balance,
        }
    except Exception as e:
        logger.error(f"Error fetching wallet balance: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/summary",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Wallet Summary",
    description="Get complete wallet summary with statistics",
)
async def get_wallet_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get wallet summary"""
    try:
        wallet_service = WalletService(db)
        summary = await wallet_service.get_wallet_summary(current_user["id"])

        return {
            "success": True,
            "message": "Wallet summary retrieved successfully",
            "data": summary,
        }
    except Exception as e:
        logger.error(f"Error fetching wallet summary: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.post(
    "/add-money",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Add Money to Wallet",
    description="Add money to wallet after successful payment",
)
async def add_money_to_wallet(
    request: AddMoneyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add money to wallet"""
    try:
        wallet_service = WalletService(db)
        result = await wallet_service.add_money(
            user_id=current_user["id"],
            amount=request.amount,
            payment_id=request.payment_id,
            description="Wallet recharge",
        )

        return {"success": True, "message": "Money added successfully", "data": result}
    except InvalidInputError as e:
        return {"success": False, "message": e.message, "data": None}
    except Exception as e:
        logger.error(f"Error adding money to wallet: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.post(
    "/pay",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Pay from Wallet",
    description="Pay for booking or service using wallet balance",
)
async def pay_from_wallet(
    request: PayFromWalletRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Pay from wallet"""
    try:
        wallet_service = WalletService(db)
        result = await wallet_service.deduct_money(
            user_id=current_user["id"],
            amount=request.amount,
            description=request.description,
            reference_id=request.booking_id,
            use_bonus_first=True,
        )

        return {"success": True, "message": "Payment successful", "data": result}
    except InsufficientCreditsError as e:
        return {
            "success": False,
            "message": f"Insufficient balance. Required: ₹{e.required}, Available: ₹{e.available}",
            "data": {"required": e.required, "available": e.available},
        }
    except Exception as e:
        logger.error(f"Error processing wallet payment: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.post(
    "/withdraw",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Request Withdrawal",
    description="Request withdrawal from wallet to bank account (Acharya only)",
)
async def request_withdrawal(
    request: WithdrawalRequest,
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Request withdrawal"""
    try:
        wallet_service = WalletService(db)
        result = await wallet_service.request_withdrawal(
            user_id=current_user["id"],
            amount=request.amount,
            bank_account={
                "account_holder": request.account_holder,
                "account_number": request.account_number,
                "ifsc_code": request.ifsc_code,
                "bank_name": request.bank_name,
            },
        )

        return {
            "success": True,
            "message": "Withdrawal request submitted successfully",
            "data": result,
        }
    except InsufficientCreditsError as e:
        return {
            "success": False,
            "message": f"Insufficient balance. Required: ₹{e.required}, Available: ₹{e.available}",
            "data": {"required": e.required, "available": e.available},
        }
    except Exception as e:
        logger.error(f"Error processing withdrawal request: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/transactions",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Transaction History",
    description="Get wallet transaction history with optional filters",
)
async def get_transaction_history(
    transaction_type: Optional[str] = Query(
        None,
        description="Filter by type: credit, debit, refund, bonus, referral, cashback, withdrawal, earning",
    ),
    limit: int = Query(20, ge=1, le=100, description="Number of transactions"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get transaction history"""
    try:
        wallet_service = WalletService(db)
        history = await wallet_service.get_transaction_history(
            user_id=current_user["id"],
            transaction_type=transaction_type,
            limit=limit,
            offset=offset,
        )

        return {
            "success": True,
            "message": "Transaction history retrieved successfully",
            "data": history,
        }
    except Exception as e:
        logger.error(f"Error fetching transaction history: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.get(
    "/earnings",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Earnings History",
    description="Get earnings history for Acharya",
)
async def get_earnings_history(
    limit: int = Query(20, ge=1, le=100, description="Number of transactions"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_acharya),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get earnings history for Acharya"""
    try:
        wallet_service = WalletService(db)
        history = await wallet_service.get_transaction_history(
            user_id=current_user["id"],
            transaction_type=TransactionType.EARNING.value,
            limit=limit,
            offset=offset,
        )

        # Get total earnings
        summary = await wallet_service.get_wallet_summary(current_user["id"])

        return {
            "success": True,
            "message": "Earnings history retrieved successfully",
            "data": {
                "total_earned": summary["statistics"]["total_earned"],
                "total_withdrawn": summary["statistics"]["total_withdrawn"],
                "current_balance": summary["balance"],
                "transactions": history["transactions"],
                "pagination": {
                    "total": history["total"],
                    "limit": history["limit"],
                    "offset": history["offset"],
                    "has_more": history["has_more"],
                },
            },
        }
    except Exception as e:
        logger.error(f"Error fetching earnings history: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}


@router.post(
    "/apply-referral",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Apply Referral Code",
    description="Apply a referral code to get bonus credits",
)
async def apply_referral_code(
    referral_code: str = Query(..., description="Referral code to apply"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Apply referral code"""
    try:
        # Find referrer by code
        referrer = await db.users.find_one({"referral_code": referral_code.upper()})

        if not referrer:
            return {"success": False, "message": "Invalid referral code", "data": None}

        if str(referrer["_id"]) == current_user["id"]:
            return {
                "success": False,
                "message": "Cannot use your own referral code",
                "data": None,
            }

        # Check if user already used a referral
        user = await db.users.find_one({"_id": current_user["id"]})
        if user.get("referred_by"):
            return {
                "success": False,
                "message": "You have already used a referral code",
                "data": None,
            }

        wallet_service = WalletService(db)

        # Add bonus to referred user
        await wallet_service.add_bonus(
            user_id=current_user["id"],
            amount=25.0,
            reason="Referral signup bonus",
            expiry_days=90,
        )

        # Add bonus to referrer
        await wallet_service.add_referral_bonus(
            referrer_id=str(referrer["_id"]),
            referred_id=current_user["id"],
            bonus_amount=50.0,
        )

        # Mark user as referred
        await db.users.update_one(
            {"_id": current_user["id"]}, {"$set": {"referred_by": str(referrer["_id"])}}
        )

        return {
            "success": True,
            "message": "Referral code applied! ₹25 bonus credited to your wallet.",
            "data": {
                "bonus_received": 25.0,
                "referrer": referrer.get("name", "Friend"),
            },
        }
    except Exception as e:
        logger.error(f"Error applying referral code: {e}", exc_info=True)
        return {"success": False, "message": str(e), "data": None}
