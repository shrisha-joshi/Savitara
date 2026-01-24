"""
MongoDB Index Cleanup Script
Fixes the phone_1 index conflict by dropping the old index and letting the system recreate it
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_phone_index():
    # Connect to MongoDB
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/savitara")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_database()
    
    print("🔧 Fixing phone_1 index conflict...")
    
    try:
        # List existing indexes
        indexes = await db.users.list_indexes().to_list(None)
        print(f"\n📋 Current indexes on users collection:")
        for idx in indexes:
            print(f"  - {idx['name']}: {idx.get('key', {})}")
        
        # Drop the conflicting phone_1 index
        print(f"\n🗑️ Dropping old phone_1 index...")
        await db.users.drop_index("phone_1")
        print("✅ Successfully dropped phone_1 index")
        
        # Create the new index with explicit name
        print(f"\n🔨 Creating new phone_unique_idx index...")
        await db.users.create_index(
            [("phone", 1)],
            unique=True,
            sparse=True,
            name="phone_unique_idx"
        )
        print("✅ Successfully created phone_unique_idx")
        
        # List updated indexes
        indexes = await db.users.list_indexes().to_list(None)
        print(f"\n📋 Updated indexes on users collection:")
        for idx in indexes:
            print(f"  - {idx['name']}: {idx.get('key', {})}")
        
        print("\n✨ Index cleanup complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(fix_phone_index())
