"""
MongoDB Index Creation for Trust Architecture
Creates indexes for trust_scores, disputes, guarantees, checkpoints, etc.

Run manually after deployment:
    python scripts/create_trust_indexes.py
"""
import sys
from pathlib import Path
from pymongo import MongoClient, ASCENDING, DESCENDING

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings

# ── Shared print constants (SonarQube S1192) ─────────────────────────────────
_OK_BOOKING_ID = "   \u2705 booking_id"


def create_trust_indexes():
    """Create all indexes for trust architecture"""
    client = MongoClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    print("🔧 Creating Trust Architecture Indexes...")
    print(f"📂 Database: {settings.MONGODB_DB_NAME}")
    print("-" * 60)
    
    # ========== ACHARYA TRUST SCORES ==========
    print("\n1️⃣ Creating acharya_trust_scores indexes...")
    try:
        db.acharya_trust_scores.create_index(
            [("acharya_id", ASCENDING)],
            unique=True,
            name="idx_acharya_trust_unique"
        )
        print("   ✅ acharya_id (unique)")
        
        db.acharya_trust_scores.create_index(
            [("trust_score.verification_level", DESCENDING)],
            name="idx_verification_level"
        )
        print("   ✅ verification_level")
        
        db.acharya_trust_scores.create_index(
            [("trust_score.overall_score", DESCENDING)],
            name="idx_overall_score"
        )
        print("   ✅ overall_score (descending)")
        
        db.acharya_trust_scores.create_index(
            [("last_score_update", DESCENDING)],
            name="idx_last_update"
        )
        print("   ✅ last_score_update")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== DISPUTES ==========
    print("\n2️⃣ Creating disputes indexes...")
    try:
        db.disputes.create_index(
            [("booking_id", ASCENDING)],
            name="idx_disputes_booking"
        )
        print(_OK_BOOKING_ID)
        
        db.disputes.create_index(
            [("complainant_id", ASCENDING)],
            name="idx_disputes_complainant"
        )
        print("   ✅ complainant_id")
        
        db.disputes.create_index(
            [("respondent_id", ASCENDING)],
            name="idx_disputes_respondent"
        )
        print("   ✅ respondent_id")
        
        db.disputes.create_index(
            [("status", ASCENDING)],
            name="idx_disputes_status"
        )
        print("   ✅ status")
        
        db.disputes.create_index(
            [("created_at", DESCENDING)],
            name="idx_disputes_created"
        )
        print("   ✅ created_at (descending)")
        
        # Compound index for admin dashboard
        db.disputes.create_index(
            [("status", ASCENDING), ("created_at", DESCENDING)],
            name="idx_disputes_status_created"
        )
        print("   ✅ status + created_at (compound)")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== SERVICE GUARANTEES ==========
    print("\n3️⃣ Creating service_guarantees indexes...")
    try:
        db.service_guarantees.create_index(
            [("booking_id", ASCENDING)],
            name="idx_guarantees_booking"
        )
        print(_OK_BOOKING_ID)
        
        db.service_guarantees.create_index(
            [("claim_id", ASCENDING)],
            unique=True,
            name="idx_guarantees_claim_unique"
        )
        print("   ✅ claim_id (unique)")
        
        db.service_guarantees.create_index(
            [("status", ASCENDING)],
            name="idx_guarantees_status"
        )
        print("   ✅ status")
        
        db.service_guarantees.create_index(
            [("user_id", ASCENDING)],
            name="idx_guarantees_user"
        )
        print("   ✅ user_id")
        
        db.service_guarantees.create_index(
            [("created_at", DESCENDING)],
            name="idx_guarantees_created"
        )
        print("   ✅ created_at")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== BOOKING CHECKPOINTS (OTP) ==========
    print("\n4️⃣ Creating booking_checkpoints indexes...")
    try:
        db.booking_checkpoints.create_index(
            [("booking_id", ASCENDING), ("checkpoint_type", ASCENDING)],
            name="idx_checkpoints_booking_type"
        )
        print("   ✅ booking_id + checkpoint_type (compound)")
        
        # TTL index - auto-delete after 5 minutes (300 seconds)
        db.booking_checkpoints.create_index(
            [("expires_at", ASCENDING)],
            expireAfterSeconds=300,
            name="idx_checkpoints_ttl"
        )
        print("   ✅ expires_at (TTL - 5 minutes)")
        
        db.booking_checkpoints.create_index(
            [("otp_hash", ASCENDING)],
            name="idx_checkpoints_otp"
        )
        print("   ✅ otp_hash")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== MASKED PHONE RELAYS ==========
    print("\n5️⃣ Creating masked_phone_relays indexes...")
    try:
        db.masked_phone_relays.create_index(
            [("booking_id", ASCENDING)],
            unique=True,
            name="idx_relays_booking_unique"
        )
        print("   ✅ booking_id (unique)")
        
        db.masked_phone_relays.create_index(
            [("relay_number_hash", ASCENDING)],
            name="idx_relays_number"
        )
        print("   ✅ relay_number_hash")
        
        # TTL index - auto-delete after expiration
        db.masked_phone_relays.create_index(
            [("expires_at", ASCENDING)],
            expireAfterSeconds=0,
            name="idx_relays_ttl"
        )
        print("   ✅ expires_at (TTL)")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== MESSAGE CONTENT ANALYSIS ==========
    print("\n6️⃣ Creating message_content_analysis indexes...")
    try:
        db.message_content_analysis.create_index(
            [("message_id", ASCENDING)],
            unique=True,
            name="idx_analysis_message_unique"
        )
        print("   ✅ message_id (unique)")
        
        db.message_content_analysis.create_index(
            [("risk_score", DESCENDING)],
            name="idx_analysis_risk"
        )
        print("   ✅ risk_score (descending)")
        
        db.message_content_analysis.create_index(
            [("booking_id", ASCENDING)],
            name="idx_analysis_booking"
        )
        print(_OK_BOOKING_ID)
        
        db.message_content_analysis.create_index(
            [("analyzed_at", DESCENDING)],
            name="idx_analysis_date"
        )
        print("   ✅ analyzed_at")
        
        # High-risk messages compound index
        db.message_content_analysis.create_index(
            [("risk_score", DESCENDING), ("analyzed_at", DESCENDING)],
            name="idx_analysis_risk_date"
        )
        print("   ✅ risk_score + analyzed_at (compound)")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== OFFLINE TRANSACTION ALERTS ==========
    print("\n7️⃣ Creating offline_transaction_alerts indexes...")
    try:
        db.offline_transaction_alerts.create_index(
            [("booking_id", ASCENDING)],
            name="idx_offline_booking"
        )
        print(_OK_BOOKING_ID)
        
        db.offline_transaction_alerts.create_index(
            [("fraud_confidence", DESCENDING)],
            name="idx_offline_confidence"
        )
        print("   ✅ fraud_confidence (descending)")
        
        db.offline_transaction_alerts.create_index(
            [("investigation_status", ASCENDING)],
            name="idx_offline_status"
        )
        print("   ✅ investigation_status")
        
        db.offline_transaction_alerts.create_index(
            [("detected_at", DESCENDING)],
            name="idx_offline_detected"
        )
        print("   ✅ detected_at")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # ========== INVESTOR METRICS INDEXES ==========
    print("\n8️⃣ Creating investor metrics indexes (users, bookings)...")
    try:
        # User acquisition tracking
        db.users.create_index(
            [("acquisition_channel", ASCENDING)],
            name="idx_users_channel"
        )
        print("   ✅ users.acquisition_channel")
        
        db.users.create_index(
            [("created_at", ASCENDING)],
            name="idx_users_created"
        )
        print("   ✅ users.created_at")
        
        # Cohort analysis
        db.users.create_index(
            [("signup_cohort", ASCENDING)],
            name="idx_users_cohort"
        )
        print("   ✅ users.signup_cohort")
        
        # Booking revenue tracking
        db.bookings.create_index(
            [("status", ASCENDING), ("created_at", DESCENDING)],
            name="idx_bookings_status_date"
        )
        print("   ✅ bookings.status + created_at (compound)")
        
        db.bookings.create_index(
            [("pooja_type", ASCENDING)],
            name="idx_bookings_pooja"
        )
        print("   ✅ bookings.pooja_type")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("✅ Index creation complete!")
    print("=" * 60)
    
    # List all indexes to verify
    print("\n📊 Verifying indexes...")
    collections = [
        "acharya_trust_scores",
        "disputes",
        "service_guarantees",
        "booking_checkpoints",
        "masked_phone_relays",
        "message_content_analysis",
        "offline_transaction_alerts",
        "users",
        "bookings"
    ]
    
    for coll_name in collections:
        indexes = db[coll_name].index_information()
        print(f"\n{coll_name}: {len(indexes)} indexes")
        for idx_name, idx_info in indexes.items():
            key = idx_info.get("key", [])
            print(f"  - {idx_name}: {key}")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Savitara Trust Architecture - Index Migration")
    print("=" * 60)
    create_trust_indexes()
    print("\n✅ Migration complete! Indexes are now active.")
