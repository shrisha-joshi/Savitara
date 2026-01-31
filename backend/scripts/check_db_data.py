"""
Quick script to check MongoDB data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "savitara")

async def check_database():
    """Check database collections and counts"""
    try:
        print(f"Connecting to MongoDB: {MONGODB_URL}")
        client = AsyncIOMotorClient(MONGODB_URL)
        db = client[DB_NAME]
        
        # Test connection
        await client.admin.command('ping')
        print(f"✓ Successfully connected to database: {DB_NAME}\n")
        
        # Get collection names
        collections = await db.list_collection_names()
        print(f"Collections found: {len(collections)}")
        print(f"Collection names: {collections}\n")
        
        # Count documents in each collection
        print("Document counts:")
        print("-" * 50)
        for collection_name in collections:
            count = await db[collection_name].count_documents({})
            print(f"{collection_name:30} {count:>10} documents")
        
        print("\n" + "=" * 50)
        
        # Check specifically for users
        users_count = await db.users.count_documents({})
        print(f"\nTotal users: {users_count}")
        
        if users_count > 0:
            print("\nSample users:")
            async for user in db.users.find().limit(5):
                print(f"  - {user.get('full_name', 'N/A')} ({user.get('role', 'N/A')})")
        else:
            print("\n⚠ No users found in database!")
            print("This is why the admin dashboard shows 0 users.")
            print("\nYou may need to:")
            print("1. Register some users through the mobile/web app")
            print("2. Run a seed script to populate test data")
            print("3. Import existing data")
        
        # Check bookings
        bookings_count = await db.bookings.count_documents({})
        print(f"\nTotal bookings: {bookings_count}")
        
        # Check admin users
        admin_count = await db.admin_users.count_documents({})
        print(f"Total admin users: {admin_count}")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_database())
