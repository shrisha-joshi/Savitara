import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    total = await db.users.count_documents({'role': 'acharya'})
    active = await db.users.count_documents({'role': 'acharya', 'status': 'active'})
    pending = await db.users.count_documents({'role': 'acharya', 'status': 'pending'})
    profiles = await db.acharya_profiles.count_documents({})
    
    print(f'Total acharyas: {total}')
    print(f'Active acharyas: {active}')
    print(f'Pending acharyas: {pending}')
    print(f'Acharya profiles: {profiles}')
    
    if total > 0:
        sample = await db.users.find_one({'role': 'acharya'})
        print(f'Sample acharya status: {sample.get("status")}')
        profile = await db.acharya_profiles.find_one({'user_id': sample['_id']})
        print(f'Sample has profile: {profile is not None}')
    else:
        print('No acharyas in database!')
    
    client.close()

asyncio.run(check())
