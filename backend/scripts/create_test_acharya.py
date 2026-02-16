import asyncio
import logging
import sys
import os
from dotenv import load_dotenv

# Calculate paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
ENV_PATH = os.path.join(BACKEND_DIR, '.env')

# Load .env file explicitly
print(f"Loading env from: {ENV_PATH}")
load_dotenv(ENV_PATH)

# Add parent directory to path so we can import 'app'
sys.path.append(BACKEND_DIR)

from app.db.connection import DatabaseManager
from app.core.security import SecurityManager
from app.models.database import User, UserRole, UserStatus, AcharyaProfile, Location
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_test_acharya():
    try:
        await DatabaseManager.connect_to_database()
        db = DatabaseManager.db

        email = "acharya@savitara.com"
        password = "Password@123"

        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            logger.info("Acharya user already exists. Updating password...")
            hashed_password = SecurityManager.get_password_hash(password)
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "password_hash": hashed_password,
                    "status": UserStatus.VERIFIED,
                    "role": UserRole.ACHARYA
                }}
            )
            logger.info(f"Acharya updated. Login with: {email} / {password}")

            # Ensure profile exists
            user_id = str(existing_user["_id"])
            profile = await db.acharya_profiles.find_one({"user_id": user_id})
            if not profile:
                logger.info("Creating missing acharya profile...")
                new_profile = AcharyaProfile(
                    user_id=user_id,
                    name="Test Acharya",
                    location=Location(city="Varanasi", state="Uttar Pradesh"),
                    specializations=["Vedic Studies", "Yoga"],
                    experience_years=10,
                    languages=["Hindi", "English", "Sanskrit"],
                    bio="Experienced spiritual guide with deep knowledge of Vedic traditions."
                )
                await db.acharya_profiles.insert_one(new_profile.model_dump(by_alias=True))

            return

        # Create new acharya user
        logger.info("Creating new test acharya...")
        hashed_password = SecurityManager.get_password_hash(password)

        new_user = User(
            email=email,
            password_hash=hashed_password,
            role=UserRole.ACHARYA,
            status=UserStatus.VERIFIED,
            onboarded=True
        )

        # Prepare for insertion - remove _id if it's None so Mongo generates it
        user_dict = new_user.model_dump(by_alias=True)
        if user_dict.get("_id") is None:
            del user_dict["_id"]

        result = await db.users.insert_one(user_dict)
        user_id = str(result.inserted_id)

        # Create acharya profile
        profile = AcharyaProfile(
            user_id=user_id,
            name="Test Acharya",
            location=Location(city="Varanasi", state="Uttar Pradesh"),
            specializations=["Vedic Studies", "Yoga"],
            experience_years=10,
            languages=["Hindi", "English", "Sanskrit"],
            bio="Experienced spiritual guide with deep knowledge of Vedic traditions."
        )

        profile_dict = profile.model_dump(by_alias=True)
        if profile_dict.get("_id") is None:
            del profile_dict["_id"]

        await db.acharya_profiles.insert_one(profile_dict)

        logger.info("===========================================")
        logger.info("✅ SUCCESS! Test Acharya Created")
        logger.info(f"📧 Email:    {email}")
        logger.info(f"🔑 Password: {password}")
        logger.info("===========================================")

    except Exception as e:
        logger.error(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_test_acharya())