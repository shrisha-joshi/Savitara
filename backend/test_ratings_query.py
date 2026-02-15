import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    # Test simple match with ratings.average
    print("Test 1: Match all (no filter)")
    results1 = await db.acharya_profiles.find({}).to_list(length=None)
    print(f"  Results: {len(results1)}")
    
    print("\nTest 2: Match with ratings.average >= 0")
    results2 = await db.acharya_profiles.find({"ratings.average": {"$gte": 0}}).to_list(length=None)
    print(f"  Results: {len(results2)}")
    
    print("\nTest 3: Match with ratings.average == 0.0")
    results3 = await db.acharya_profiles.find({"ratings.average": 0.0}).to_list(length=None)
    print(f"  Results: {len(results3)}")
    
    print("\nTest 4: Check actual rating values")
    all_profiles = await db.acharya_profiles.find({}, {"ratings": 1, "name": 1}).to_list(length=None)
    for prof in all_profiles:
        print(f"  {prof.get('name')}: ratings = {prof.get('ratings')}")
    
    client.close()

asyncio.run(check())
