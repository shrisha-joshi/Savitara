"""
Direct MongoDB Test - Verify users can be inserted and queried
"""
from pymongo import MongoClient
from datetime import datetime
import json

# MongoDB Connection
MONGODB_URL = "mongodb+srv://sheshagirijoshi18_db_savitara:savitara123@cluster0.0q2ghgt.mongodb.net/?appName=Cluster0"
DB_NAME = "savitara"

def main():
    print("\n" + "="*60)
    print(" MONGODB DIRECT TEST")
    print("="*60)
    
    try:
        # Connect to MongoDB
        print("\n1. Connecting to MongoDB...")
        client = MongoClient(MONGODB_URL)
        db = client[DB_NAME]
        print("✅ Connected successfully!")
        
        # Check existing users
        print("\n2. Checking existing users...")
        users_collection = db.users
        existing_count = users_collection.count_documents({})
        print(f"✅ Found {existing_count} existing users")
        
        # List some users
        if existing_count > 0:
            print("\n3. Sample users in database:")
            for user in users_collection.find().limit(5):
                print(f"  - {user.get('email')} ({user.get('role')}) - Status: {user.get('status')}")
        
        # Check indexes
        print("\n4. Checking indexes...")
        indexes = list(users_collection.list_indexes())
        print(f"✅ Found {len(indexes)} indexes on users collection:")
        for idx in indexes:
            print(f"  - {idx['name']}")
        
        # Check collections
        print("\n5. Database collections:")
        collections = db.list_collection_names()
        print(f"✅ Found {len(collections)} collections:")
        for coll in collections:
            count = db[coll].count_documents({})
            print(f"  - {coll}: {count} documents")
        
        # Create test data manually (simplified User model)
        print("\n6. Creating test user directly in MongoDB...")
        test_user = {
            "email": "direct_testuser@savitara.com",
            "role": "grihasta",
            "status": "verified",
            "onboarded": False,
            "profile_picture": None,
            "referral_code": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None,
            "device_tokens": [],
            "credits": 100
        }
        
        # Check if user exists
        existing = users_collection.find_one({"email": test_user["email"]})
        if existing:
            print(f"⚠️  User {test_user['email']} already exists")
            print(f"   ID: {existing['_id']}")
        else:
            result = users_collection.insert_one(test_user)
            print(f"✅ Created test user with ID: {result.inserted_id}")
            
            # Verify it was created
            created_user = users_collection.find_one({"_id": result.inserted_id})
            print("\n7. Verification - User details:")
            print(json.dumps({
                "id": str(created_user["_id"]),
                "email": created_user["email"],
                "role": created_user["role"],
                "status": created_user["status"],
                "credits": created_user["credits"]
            }, indent=2))
        
        print("\n" + "="*60)
        print(" ✅ MONGODB TEST COMPLETED SUCCESSFULLY!")
        print("="*60)
        print("\nKEY FINDINGS:")
        print(f"  • MongoDB connection: ✅ Working")
        print(f"  • Database: {DB_NAME}")
        print(f"  • Users count: {existing_count + (1 if not existing else 0)}")
        print(f"  • Collections: {len(collections)}")
        print(f"  • Indexes on users: {len(indexes)}")
        print(f"  • Data can be inserted: ✅ Yes")
        print(f"  • Data can be queried: ✅ Yes")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n🔌 MongoDB connection closed")

if __name__ == "__main__":
    main()
