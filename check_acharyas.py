import asyncio
import sys
sys.path.insert(0, 'backend')

from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.core.config import settings

async def check_database():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    # Count acharyas
    total_acharyas = await db.users.count_documents({'role': 'acharya'})
    active_acharyas = await db.users.count_documents({'role': 'acharya', 'status': 'active'})
    pending_acharyas = await db.users.count_documents({'role': 'acharya', 'status': 'pending'})
    
    # Count acharya profiles
    total_profiles = await db.acharya_profiles.count_documents({})
    
    print(f"Total acharyas in users collection: {total_acharyas}")
    print(f"Active acharyas: {active_acharyas}")
    print(f"Pending acharyas: {pending_acharyas}")
    print(f"Acharya profiles: {total_profiles}")
    
    # Get a sample
    if total_acharyas > 0:
        sample = await db.users.find_one({'role': 'acharya'})
        print("\nSample acharya:")
        print(f"  ID: {sample.get('_id')}")
        print(f"  Email: {sample.get('email')}")
        print(f"  Status: {sample.get('status')}")
        print(f"  Name: {sample.get('full_name')}")
        
        # Check if they have a profile
        if sample.get('_id'):
            profile = await db.acharya_profiles.find_one({'user_id': sample['_id']})
            print(f"  Has profile: {profile is not None}")
            if profile:
                print(f"  Profile specializations: {profile.get('specializations', [])}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_database())
