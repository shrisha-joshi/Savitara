import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from bson import ObjectId

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    print("Testing aggregation pipeline stages...\n")
    
    # Stage 1: Initial match - using empty filter to get all
    stage1 = [{"$match": {}}]
    results1 = await db.acharya_profiles.aggregate(stage1).to_list(length=None)
    print(f"After $match: {len(results1)} results")
    
    # Stage 2: Add ObjectId conversion
    stage2 = stage1 + [{"$addFields": {"user_id_obj": {"$toObjectId": "$user_id"}}}]
    try:
        results2 = await db.acharya_profiles.aggregate(stage2).to_list(length=None)
        print(f"After $addFields: {len(results2)} results")
        if results2:
            print(f"  Sample user_id_obj type: {type(results2[0].get('user_id_obj'))}")
    except Exception as e:
        print(f"ERROR in $addFields stage: {e}")
        # Try without conversion
        print("\nTrying without $toObjectId conversion...")
        stage2_alt = stage1 + [{"$addFields": {"user_id_obj": "$user_id"}}]
        results2_alt = await db.acharya_profiles.aggregate(stage2_alt).to_list(length=None)
        print(f"  Results: {len(results2_alt)}")
        return
    
    # Stage 3: Lookup
    stage3 = stage2 + [{
        "$lookup": {
            "from": "users",
            "localField": "user_id_obj",
            "foreignField": "_id",
            "as": "user"
        }
    }]
    results3 = await db.acharya_profiles.aggregate(stage3).to_list(length=None)
    print(f"After $lookup: {len(results3)} results")
    if results3:
        print(f"  Sample has user array length: {len(results3[0].get('user', []))}")
    
    # Stage 4: Unwind
    stage4 = stage3 + [{"$unwind": "$user"}]
    try:
        results4 = await db.acharya_profiles.aggregate(stage4).to_list(length=None)
        print(f"After $unwind: {len(results4)} results")
        if results4:
            print(f"  Sample user status: {results4[0].get('user', {}).get('status')}")
    except Exception as e:
        print(f"ERROR in $unwind stage: {e}")
    
    # Stage 5: Status filter
    stage5 = stage4 + [{"$match": {"user.status": "active"}}]
    try:
        results5 = await db.acharya_profiles.aggregate(stage5).to_list(length=None)
        print(f"After status filter: {len(results5)} results")
    except Exception as e:
        print(f"ERROR in status filter: {e}")
    
    client.close()

asyncio.run(check())
