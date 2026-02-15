import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Get a sample profile to see its structure
    profile = await db.acharya_profiles.find_one({})
    
    if profile:
        print("Sample acharya_profile document structure:")
        print("-" * 80)
        for key, value in profile.items():
            value_type = type(value).__name__
            value_preview = str(value)[:50] if len(str(value)) > 50 else str(value)
            print(f"  {key}: ({value_type}) {value_preview}")
    else:
        print("No profiles found!")
    
    # Count all profiles without filters
    total = await db.acharya_profiles.count_documents({})
    print(f"\nTotal profiles: {total}")
    
    client.close()

asyncio.run(check())
