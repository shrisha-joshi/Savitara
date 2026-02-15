import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from bson import ObjectId

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Get all users with role acharya
    acharyas = await db.users.find({'role': 'acharya'}).to_list(length=10)
    print(f"Found {len(acharyas)} acharyas in users collection:")
    for ach in acharyas:
        print(f"  User ID: {ach['_id']} (type: {type(ach['_id'])}), Email: {ach.get('email')}, Status: {ach.get('status')}")
    
    print("\n" + "="*80 + "\n")
    
    # Get all acharya profiles
    profiles = await db.acharya_profiles.find({}).to_list(length=10)
    print(f"Found {len(profiles)} profiles in acharya_profiles collection:")
    for prof in profiles:
        user_id = prof.get('user_id')
        print(f"  user_id: {user_id} (type: {type(user_id)}), name: {prof.get('name')}")
    
    print("\n" + "="*80 + "\n")
    
    # Try to match them
    print("Attempting to match users with profiles:")
    for ach in acharyas:
        user_id_obj = ach['_id']
        user_id_str = str(ach['_id'])
        
        # Try ObjectId match
        profile_by_obj = await db.acharya_profiles.find_one({'user_id': user_id_obj})
        # Try string match
        profile_by_str = await db.acharya_profiles.find_one({'user_id': user_id_str})
        
        print(f"  User {ach.get('email')}:")
        print(f"    Match by ObjectId: {profile_by_obj is not None}")
        print(f"    Match by string: {profile_by_str is not None}")
        if profile_by_str:
            print(f"    Profile name: {profile_by_str.get('name')}")
    
    client.close()

asyncio.run(check())
