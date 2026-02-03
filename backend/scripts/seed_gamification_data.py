"""
Data Seeding Script for Gamification System
Seeds initial coupons, vouchers, and configuration
"""
import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Constants
MAX_DISCOUNT_TEXT = "Maximum discount ₹150"

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "savitara")

async def seed_coupons(db):
    """Seed default coupon codes"""
    coupons_collection = db.coupons
    
    # Check if coupons already exist
    existing = await coupons_collection.count_documents({})
    if existing > 0:
        print(f"⚠️  {existing} coupons already exist. Skipping...")
        return
    
    now = datetime.now(timezone.utc)
    year_end = datetime(2026, 12, 31, 23, 59, 59)
    
    default_coupons = [
        # First-time user codes
        {
            "code": "FIRST50",
            "name": "50% Off First Booking",
            "description": "Get 50% discount on your first booking with us!",
            "discount_type": "percentage",
            "discount_value": 50.0,
            "max_discount": 200.0,
            "min_booking_amount": 100.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": True,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for first booking only",
                "Maximum discount ₹200",
                "Cannot be combined with other offers"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "WELCOME100",
            "name": "Welcome Bonus",
            "description": "₹100 off + 100 bonus coins on your first booking!",
            "discount_type": "fixed",
            "discount_value": 100.0,
            "max_discount": None,
            "min_booking_amount": 300.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": True,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for first booking only",
                "Minimum booking ₹300",
                "100 bonus coins will be credited"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "NEWUSER",
            "name": "New User Special",
            "description": "30% off on your first 3 bookings",
            "discount_type": "percentage",
            "discount_value": 30.0,
            "max_discount": 150.0,
            "min_booking_amount": 200.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 3,
            "applicable_for": ["grihasta"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for first 3 bookings",
                "Maximum discount ₹150 per booking",
                "New users only"
            ],
            "created_by": "system",
            "created_at": now
        },
        
        # Pooja-specific codes
        {
            "code": "GANESH50",
            "name": "Ganesh Pooja Special",
            "description": "50% off on Ganesh Pooja bookings",
            "discount_type": "percentage",
            "discount_value": 50.0,
            "max_discount": 250.0,
            "min_booking_amount": 300.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 2,
            "applicable_for": ["all"],
            "applicable_services": ["ganesh_pooja"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for Ganesh Pooja bookings only",
                "Maximum discount ₹250"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "GRIHAPRAVES",
            "name": "Griha Pravesh Offer",
            "description": "₹300 off on Griha Pravesh ceremonies",
            "discount_type": "fixed",
            "discount_value": 300.0,
            "max_discount": None,
            "min_booking_amount": 1000.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["griha_pravesh"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for Griha Pravesh ceremonies",
                "Minimum booking ₹1000"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "SATYANARAYAN",
            "name": "Satyanarayan Katha Discount",
            "description": "₹200 off on Satyanarayan Katha",
            "discount_type": "fixed",
            "discount_value": 200.0,
            "max_discount": None,
            "min_booking_amount": 800.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 2,
            "applicable_for": ["all"],
            "applicable_services": ["satyanarayan_katha"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for Satyanarayan Katha bookings",
                "Minimum booking ₹800"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "NAVGRAHA40",
            "name": "Navgraha Pooja Special",
            "description": "40% off on Navgraha Pooja",
            "discount_type": "percentage",
            "discount_value": 40.0,
            "max_discount": 300.0,
            "min_booking_amount": 500.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["navgraha_pooja"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for Navgraha Pooja bookings",
                "Maximum discount ₹300"
            ],
            "created_by": "system",
            "created_at": now
        },
        
        # Referral codes
        {
            "code": "REFER500",
            "name": "Referral Bonus",
            "description": "₹500 off for you and your friend!",
            "discount_type": "fixed",
            "discount_value": 500.0,
            "max_discount": None,
            "min_booking_amount": 1000.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid when using referral code",
                "Both referrer and referee get ₹500 off",
                "Minimum booking ₹1000"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "FRIENDBONUS",
            "name": "Friend Bonus",
            "description": "Both you and your friend get 20% off",
            "discount_type": "percentage",
            "discount_value": 20.0,
            "max_discount": 200.0,
            "min_booking_amount": 500.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 1,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid with referral",
                "Maximum discount ₹200",
                "One-time use"
            ],
            "created_by": "system",
            "created_at": now
        },
        
        # Time-based codes
        {
            "code": "EARLYBIRD",
            "name": "Early Bird Special",
            "description": "25% off for bookings before 9 AM",
            "discount_type": "percentage",
            "discount_value": 25.0,
            "max_discount": 150.0,
            "min_booking_amount": 300.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 5,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for bookings before 9 AM",
                MAX_DISCOUNT_TEXT
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "WEEKEND20",
            "name": "Weekend Special",
            "description": "20% off on weekend bookings",
            "discount_type": "percentage",
            "discount_value": 20.0,
            "max_discount": 150.0,
            "min_booking_amount": 400.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 10,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid for Saturday and Sunday bookings",
                MAX_DISCOUNT_TEXT
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "FESTIVE50",
            "name": "Festival Season Special",
            "description": "50% off during festival seasons",
            "discount_type": "percentage",
            "discount_value": 50.0,
            "max_discount": 300.0,
            "min_booking_amount": 500.0,
            "valid_from": now,
            "valid_until": year_end,
            "usage_limit": None,
            "used_count": 0,
            "per_user_limit": 3,
            "applicable_for": ["all"],
            "applicable_services": ["all"],
            "first_booking_only": False,
            "can_combine_offers": False,
            "is_active": True,
            "terms_conditions": [
                "Valid during major festivals",
                "Maximum discount ₹300",
                "Check website for eligible dates"
            ],
            "created_by": "system",
            "created_at": now
        }
    ]
    
    result = await coupons_collection.insert_many(default_coupons)
    print(f"✅ Seeded {len(result.inserted_ids)} coupons successfully!")
    
    # Print coupon codes for reference
    print("\n📋 Created Coupon Codes:")
    for coupon in default_coupons:
        print(f"   - {coupon['code']}: {coupon['name']}")


async def seed_vouchers(db):
    """Seed default vouchers"""
    vouchers_collection = db.vouchers
    
    # Check if vouchers already exist
    existing = await vouchers_collection.count_documents({})
    if existing > 0:
        print(f"⚠️  {existing} vouchers already exist. Skipping...")
        return
    
    now = datetime.now(timezone.utc)
    year_end = datetime(2026, 12, 31, 23, 59, 59)
    
    default_vouchers = [
        {
            "code": "NEXT20",
            "name": "20% Off Next Booking",
            "description": "Get 20% discount on your next booking",
            "category": "booking_discount",
            "discount_type": "percentage",
            "discount_value": 20.0,
            "max_discount": 200.0,
            "min_booking_amount": 500.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 10000,
            "used_quantity": 0,
            "per_user_limit": 1,
            "applicable_for": ["grihasta"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Valid for one use only",
                "Cannot be combined with other offers",
                "Earned after 5 bookings"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "POOJA50",
            "name": "₹50 Off Pooja Items",
            "description": "₹50 discount on pooja items purchase",
            "category": "pooja_items",
            "discount_type": "fixed",
            "discount_value": 50.0,
            "max_discount": None,
            "min_booking_amount": 200.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 5000,
            "used_quantity": 0,
            "per_user_limit": 3,
            "applicable_for": ["grihasta"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Valid for pooja items only",
                "Minimum purchase ₹200",
                "Earned through referrals"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "REPEAT15",
            "name": "15% Off Repeat Booking",
            "description": "15% discount for repeat customers",
            "category": "booking_discount",
            "discount_type": "percentage",
            "discount_value": 15.0,
            "max_discount": 150.0,
            "min_booking_amount": 300.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 15000,
            "used_quantity": 0,
            "per_user_limit": 5,
            "applicable_for": ["grihasta"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Valid for repeat bookings",
                "Maximum discount ₹150",
                "Earned after rating"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "FESTIVAL25",
            "name": "25% Festival Special",
            "description": "25% off during festival seasons",
            "category": "booking_discount",
            "discount_type": "percentage",
            "discount_value": 25.0,
            "max_discount": 250.0,
            "min_booking_amount": 500.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 20000,
            "used_quantity": 0,
            "per_user_limit": 2,
            "applicable_for": ["grihasta"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Valid during festivals",
                "Maximum discount ₹250",
                "Auto-applied for first booking"
            ],
            "created_by": "system",
            "created_at": now
        },
        
        # Acharya vouchers
        {
            "code": "BOOST10",
            "name": "10-Day Profile Boost",
            "description": "Feature your profile for 10 days",
            "category": "profile_boost",
            "discount_type": "fixed",
            "discount_value": 0.0,
            "max_discount": None,
            "min_booking_amount": 0.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 1000,
            "used_quantity": 0,
            "per_user_limit": 3,
            "applicable_for": ["acharya"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Feature profile for 10 days",
                "Earned through milestones",
                "Cannot be transferred"
            ],
            "created_by": "system",
            "created_at": now
        },
        {
            "code": "PREMIUM7",
            "name": "7-Day Premium Badge",
            "description": "Get premium badge for 7 days",
            "category": "premium_features",
            "discount_type": "fixed",
            "discount_value": 0.0,
            "max_discount": None,
            "min_booking_amount": 0.0,
            "valid_from": now,
            "valid_until": year_end,
            "total_quantity": 500,
            "used_quantity": 0,
            "per_user_limit": 2,
            "applicable_for": ["acharya"],
            "applicable_services": ["all"],
            "is_active": True,
            "terms_conditions": [
                "Premium badge for 7 days",
                "Improved visibility",
                "Earned through performance"
            ],
            "created_by": "system",
            "created_at": now
        }
    ]
    
    result = await vouchers_collection.insert_many(default_vouchers)
    print(f"✅ Seeded {len(result.inserted_ids)} vouchers successfully!")
    
    print("\n🎁 Created Vouchers:")
    for voucher in default_vouchers:
        print(f"   - {voucher['code']}: {voucher['name']}")


async def main():
    """Main seeding function"""
    print("🌱 Starting data seeding for Savitara Gamification System...\n")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Seed coupons
        print("📦 Seeding Coupons...")
        await seed_coupons(db)
        
        print("\n📦 Seeding Vouchers...")
        await seed_vouchers(db)
        
        print("\n✨ Data seeding completed successfully!")
        print("\n📝 Next Steps:")
        print("   1. Test APIs using Postman collection")
        print("   2. Verify coupons in admin panel")
        print("   3. Test booking flow with discount codes")
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
