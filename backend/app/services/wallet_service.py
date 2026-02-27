"""
Wallet Service for Savitara
In-app wallet for credits, transactions, and payments
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.exceptions import InsufficientCreditsError, InvalidInputError, PaymentFailedError
from app.core.constants import (
    MIN_WITHDRAWAL_AMOUNT, MAX_WITHDRAWAL_AMOUNT,
    MIN_RECHARGE_AMOUNT, MAX_RECHARGE_AMOUNT,
    PLATFORM_COMMISSION_PERCENT,
)
from app.utils.decorators import handle_service_errors

logger = logging.getLogger(__name__)


class TransactionType(str, Enum):
    """Wallet transaction types"""

    CREDIT = "credit"  # Money added to wallet
    DEBIT = "debit"  # Money spent from wallet
    REFUND = "refund"  # Refund to wallet
    BONUS = "bonus"  # Bonus/promotional credits
    REFERRAL = "referral"  # Referral bonus
    CASHBACK = "cashback"  # Cashback reward
    WITHDRAWAL = "withdrawal"  # Withdraw to bank
    TRANSFER = "transfer"  # Transfer between users
    EARNING = "earning"  # Acharya earnings


class TransactionStatus(str, Enum):
    """Transaction status"""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WalletService:
    """Wallet management service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize wallet service"""
        self.db = db
        self.wallets = db.wallets
        self.transactions = db.wallet_transactions

    @handle_service_errors("get_or_create_wallet")
    async def get_or_create_wallet(self, user_id: str) -> Dict[str, Any]:
        """
        Get user's wallet or create if doesn't exist

        Args:
            user_id: User ID

        Returns:
            Wallet document
        """
        wallet = await self.wallets.find_one({"user_id": user_id})

        if not wallet:
            wallet = {
                "user_id": user_id,
                "balance": 0.0,
                "bonus_balance": 0.0,
                "currency": "INR",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "total_credited": 0.0,
                "total_debited": 0.0,
                "total_earned": 0.0,
                "total_withdrawn": 0.0,
            }
            result = await self.wallets.insert_one(wallet)
            wallet["_id"] = result.inserted_id
            logger.info(f"Created wallet for user {user_id}")

        return wallet

    @handle_service_errors("get_balance")
    async def get_balance(self, user_id: str) -> Dict[str, Any]:
        """
        Get wallet balance

        Args:
            user_id: User ID

        Returns:
            Balance information
        """
        wallet = await self.get_or_create_wallet(user_id)

        return {
            "balance": wallet["balance"],
            "bonus_balance": wallet["bonus_balance"],
            "total_balance": wallet["balance"] + wallet["bonus_balance"],
            "currency": wallet["currency"],
            "is_active": wallet["is_active"],
        }

    async def add_money(
        self,
        user_id: str,
        amount: float,
        payment_id: str,
        description: str = "Wallet recharge",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add money to wallet

        Args:
            user_id: User ID
            amount: Amount to add
            payment_id: Payment reference ID
            description: Transaction description
            metadata: Additional metadata

        Returns:
            Transaction details
        """
        if amount <= 0:
            raise InvalidInputError(
                message="Amount must be greater than 0", field="amount"
            )

        # C12 fix: Verify payment with Razorpay before crediting wallet
        try:
            from app.services.payment_service import PaymentService
            payment_service = PaymentService()
            payment_details = payment_service.fetch_payment(payment_id)
            if not payment_details.get("captured"):
                raise InvalidInputError(
                    message="Payment has not been captured", field="payment_id"
                )
            if abs(payment_details["amount"] - amount) > 0.01:
                raise InvalidInputError(
                    message="Payment amount mismatch", field="amount"
                )
        except (InvalidInputError, PaymentFailedError):
            raise
        except Exception as e:
            logger.error(f"Payment verification failed for {payment_id}: {e}")
            raise InvalidInputError(
                message="Unable to verify payment", field="payment_id"
            )

        # Check for duplicate payment_id to prevent double-credit
        existing_txn = await self.transactions.find_one({"payment_id": payment_id})
        if existing_txn:
            raise InvalidInputError(
                message="Payment already processed", field="payment_id"
            )

        wallet = await self.get_or_create_wallet(user_id)

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.CREDIT.value,
            "amount": amount,
            "balance_before": wallet["balance"],
            "balance_after": wallet["balance"] + amount,
            "payment_id": payment_id,
            "description": description,
            "status": TransactionStatus.COMPLETED.value,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        # Update wallet balance
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {"balance": amount, "total_credited": amount},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Added {amount} to wallet for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "amount_added": amount,
            "new_balance": transaction["balance_after"],
            "message": "Money added successfully",
        }

    async def deduct_money(
        self,
        user_id: str,
        amount: float,
        description: str,
        reference_id: Optional[str] = None,
        use_bonus_first: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Deduct money from wallet

        Args:
            user_id: User ID
            amount: Amount to deduct
            description: Transaction description
            reference_id: Reference (e.g., booking ID)
            use_bonus_first: Use bonus balance first
            metadata: Additional metadata

        Returns:
            Transaction details
        """
        if amount <= 0:
            raise InvalidInputError(
                message="Amount must be greater than 0", field="amount"
            )

        wallet = await self.get_or_create_wallet(user_id)
        total_balance = wallet["balance"] + wallet["bonus_balance"]

        if total_balance < amount:
            raise InsufficientCreditsError(required=amount, available=total_balance)

        # Calculate deduction from bonus and main balance
        bonus_deduction = 0.0
        main_deduction = 0.0

        if use_bonus_first and wallet["bonus_balance"] > 0:
            bonus_deduction = min(wallet["bonus_balance"], amount)
            main_deduction = amount - bonus_deduction
        else:
            main_deduction = amount

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.DEBIT.value,
            "amount": amount,
            "bonus_amount_used": bonus_deduction,
            "main_amount_used": main_deduction,
            "balance_before": wallet["balance"],
            "balance_after": wallet["balance"] - main_deduction,
            "reference_id": reference_id,
            "description": description,
            "status": TransactionStatus.COMPLETED.value,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        # Update wallet
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {
                    "balance": -main_deduction,
                    "bonus_balance": -bonus_deduction,
                    "total_debited": amount,
                },
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Deducted {amount} from wallet for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "amount_deducted": amount,
            "bonus_used": bonus_deduction,
            "main_balance_used": main_deduction,
            "new_balance": transaction["balance_after"],
            "message": "Payment successful",
        }

    async def add_bonus(
        self,
        user_id: str,
        amount: float,
        reason: str,
        expiry_days: int = 90,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add bonus credits to wallet

        Args:
            user_id: User ID
            amount: Bonus amount
            reason: Reason for bonus
            expiry_days: Days until bonus expires
            metadata: Additional metadata

        Returns:
            Transaction details
        """
        wallet = await self.get_or_create_wallet(user_id)

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.BONUS.value,
            "amount": amount,
            "balance_before": wallet["bonus_balance"],
            "balance_after": wallet["bonus_balance"] + amount,
            "description": reason,
            "status": TransactionStatus.COMPLETED.value,
            "expiry_date": datetime.now(timezone.utc) + timedelta(days=expiry_days)
            if expiry_days
            else None,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        # Update wallet
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {"bonus_balance": amount},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Added bonus {amount} to wallet for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "bonus_added": amount,
            "new_bonus_balance": transaction["balance_after"],
            "message": "Bonus credited successfully",
        }

    async def process_refund(
        self,
        user_id: str,
        amount: float,
        booking_id: str,
        reason: str,
        refund_to_source: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process refund to wallet

        Args:
            user_id: User ID
            amount: Refund amount
            booking_id: Original booking ID
            reason: Refund reason
            refund_to_source: If True, refund to original payment source
            metadata: Additional metadata

        Returns:
            Refund details
        """
        wallet = await self.get_or_create_wallet(user_id)

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.REFUND.value,
            "amount": amount,
            "balance_before": wallet["balance"],
            "balance_after": wallet["balance"] + amount,
            "reference_id": booking_id,
            "description": f"Refund: {reason}",
            "status": TransactionStatus.COMPLETED.value,
            "refund_to_source": refund_to_source,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        if not refund_to_source:
            # Add to wallet
            await self.wallets.update_one(
                {"_id": wallet["_id"]},
                {
                    "$inc": {"balance": amount},
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                },
            )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Processed refund of {amount} for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "amount_refunded": amount,
            "refunded_to": "wallet" if not refund_to_source else "source",
            "new_balance": transaction["balance_after"]
            if not refund_to_source
            else wallet["balance"],
            "message": "Refund processed successfully",
        }

    async def add_referral_bonus(
        self,
        referrer_id: str,
        referred_id: str,
        bonus_amount: float = 50.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add referral bonus to referrer's wallet

        Args:
            referrer_id: ID of user who referred
            referred_id: ID of referred user
            bonus_amount: Bonus amount
            metadata: Additional metadata

        Returns:
            Bonus details
        """
        return await self.add_bonus(
            user_id=referrer_id,
            amount=bonus_amount,
            reason=f"Referral bonus for referring user {referred_id}",
            expiry_days=180,
            metadata={
                "type": "referral",
                "referred_user_id": referred_id,
                **(metadata or {}),
            },
        )

    async def add_cashback(
        self,
        user_id: str,
        booking_id: str,
        booking_amount: float,
        cashback_percentage: float = 5.0,
        max_cashback: float = 100.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add cashback to wallet

        Args:
            user_id: User ID
            booking_id: Booking ID
            booking_amount: Original booking amount
            cashback_percentage: Cashback percentage
            max_cashback: Maximum cashback amount
            metadata: Additional metadata

        Returns:
            Cashback details
        """
        cashback = min(booking_amount * (cashback_percentage / 100), max_cashback)

        wallet = await self.get_or_create_wallet(user_id)

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.CASHBACK.value,
            "amount": cashback,
            "balance_before": wallet["bonus_balance"],
            "balance_after": wallet["bonus_balance"] + cashback,
            "reference_id": booking_id,
            "description": f"Cashback {cashback_percentage}% on booking {booking_id}",
            "status": TransactionStatus.COMPLETED.value,
            "metadata": {
                "booking_amount": booking_amount,
                "cashback_percentage": cashback_percentage,
                **(metadata or {}),
            },
            "created_at": datetime.now(timezone.utc),
        }

        # Update wallet bonus balance
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {"bonus_balance": cashback},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Added cashback {cashback} to wallet for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "cashback_amount": cashback,
            "new_bonus_balance": transaction["balance_after"],
            "message": "Cashback credited successfully",
        }

    async def add_earnings(
        self,
        acharya_id: str,
        booking_id: str,
        amount: float,
        platform_fee: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Add earnings to Acharya's wallet

        Args:
            acharya_id: Acharya user ID
            booking_id: Booking ID
            amount: Total booking amount
            platform_fee: Platform fee deducted
            metadata: Additional metadata

        Returns:
            Earnings details
        """
        net_earnings = amount - platform_fee
        wallet = await self.get_or_create_wallet(acharya_id)

        # Create transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": acharya_id,
            "type": TransactionType.EARNING.value,
            "amount": net_earnings,
            "gross_amount": amount,
            "platform_fee": platform_fee,
            "balance_before": wallet["balance"],
            "balance_after": wallet["balance"] + net_earnings,
            "reference_id": booking_id,
            "description": f"Earnings from booking {booking_id}",
            "status": TransactionStatus.COMPLETED.value,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        # Update wallet
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {"balance": net_earnings, "total_earned": net_earnings},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Added earnings {net_earnings} to wallet for acharya {acharya_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "gross_earnings": amount,
            "platform_fee": platform_fee,
            "net_earnings": net_earnings,
            "new_balance": transaction["balance_after"],
            "message": "Earnings credited successfully",
        }

    async def request_withdrawal(
        self,
        user_id: str,
        amount: float,
        bank_account: Dict[str, str],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Request withdrawal from wallet

        Args:
            user_id: User ID
            amount: Withdrawal amount
            bank_account: Bank account details
            metadata: Additional metadata

        Returns:
            Withdrawal request details
        """
        wallet = await self.get_or_create_wallet(user_id)

        if wallet["balance"] < amount:
            raise InsufficientCreditsError(required=amount, available=wallet["balance"])

        # Create pending transaction
        transaction = {
            "wallet_id": str(wallet["_id"]),
            "user_id": user_id,
            "type": TransactionType.WITHDRAWAL.value,
            "amount": amount,
            "balance_before": wallet["balance"],
            "balance_after": wallet["balance"] - amount,
            "description": "Withdrawal request",
            "status": TransactionStatus.PENDING.value,
            "bank_account": bank_account,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }

        # Hold the amount (deduct from balance)
        await self.wallets.update_one(
            {"_id": wallet["_id"]},
            {
                "$inc": {"balance": -amount},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        # Save transaction
        result = await self.transactions.insert_one(transaction)
        transaction["_id"] = str(result.inserted_id)

        logger.info(f"Withdrawal request {amount} for user {user_id}")

        return {
            "success": True,
            "transaction_id": transaction["_id"],
            "withdrawal_amount": amount,
            "status": "pending",
            "message": "Withdrawal request submitted. Amount will be transferred within 2-3 business days.",
        }

    async def get_transaction_history(
        self,
        user_id: str,
        transaction_type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get wallet transaction history

        Args:
            user_id: User ID
            transaction_type: Filter by transaction type
            limit: Number of transactions to return
            offset: Offset for pagination

        Returns:
            Transaction history
        """
        query = {"user_id": user_id}

        if transaction_type:
            query["type"] = transaction_type

        cursor = (
            self.transactions.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        transactions = await cursor.to_list(length=limit)

        total = await self.transactions.count_documents(query)

        # Format transactions
        formatted_transactions = []
        for txn in transactions:
            formatted_transactions.append(
                {
                    "id": str(txn["_id"]),
                    "type": txn["type"],
                    "amount": txn["amount"],
                    "description": txn["description"],
                    "status": txn["status"],
                    "balance_after": txn.get("balance_after"),
                    "created_at": txn["created_at"].isoformat(),
                }
            )

        return {
            "transactions": formatted_transactions,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": total > offset + limit,
        }

    async def get_wallet_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get wallet summary with statistics

        Args:
            user_id: User ID

        Returns:
            Wallet summary
        """
        wallet = await self.get_or_create_wallet(user_id)

        return {
            "balance": wallet["balance"],
            "bonus_balance": wallet["bonus_balance"],
            "total_balance": wallet["balance"] + wallet["bonus_balance"],
            "currency": wallet["currency"],
            "is_active": wallet["is_active"],
            "statistics": {
                "total_credited": wallet.get("total_credited", 0),
                "total_debited": wallet.get("total_debited", 0),
                "total_earned": wallet.get("total_earned", 0),
                "total_withdrawn": wallet.get("total_withdrawn", 0),
            },
            "created_at": wallet["created_at"].isoformat(),
        }


# End of file
