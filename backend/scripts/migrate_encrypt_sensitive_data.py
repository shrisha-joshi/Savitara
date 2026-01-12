"""
Migration Script: Encrypt Existing Sensitive Data
Encrypts phone numbers, Aadhaar, PAN, and bank details in existing database records
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings
from app.services.encryption_service import EncryptionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


async def migrate_user_data():
    """Encrypt sensitive data in users collection"""
    
    # Initialize services
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    encryption_service = EncryptionService(settings.ENCRYPTION_KEY)
    
    logger.info("Starting user data encryption migration...")
    
    try:
        # Get all users with unencrypted phone numbers
        users = await db.users.find({"phone": {"$regex": "^\\+"}}).to_list(length=None)
        
        logger.info(f"Found {len(users)} users to encrypt")
        
        encrypted_count = 0
        for user in users:
            try:
                updates = {}
                
                # Encrypt phone if not already encrypted
                if user.get("phone") and user["phone"].startswith("+"):
                    updates["phone"] = encryption_service.encrypt(user["phone"])
                    
                # Encrypt email if exists
                if user.get("email") and "@" in user["email"]:
                    updates["email"] = encryption_service.encrypt(user["email"])
                
                if updates:
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {"$set": updates}
                    )
                    encrypted_count += 1
                    
                    if encrypted_count % 100 == 0:
                        logger.info(f"Encrypted {encrypted_count} users...")
                        
            except Exception as e:
                logger.error(f"Failed to encrypt user {user['_id']}: {e}")
                continue
        
        logger.info(f"✅ Successfully encrypted {encrypted_count} user records")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        client.close()


async def migrate_acharya_data():
    """Encrypt sensitive data in acharya profiles"""
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    encryption_service = EncryptionService(settings.ENCRYPTION_KEY)
    
    logger.info("Starting acharya profile encryption migration...")
    
    try:
        # Get all acharya profiles
        profiles = await db.acharya_profiles.find({}).to_list(length=None)
        
        logger.info(f"Found {len(profiles)} acharya profiles to encrypt")
        
        encrypted_count = 0
        for profile in profiles:
            try:
                updates = {}
                
                # Encrypt phone
                if profile.get("phone") and profile["phone"].startswith("+"):
                    updates["phone"] = encryption_service.encrypt(profile["phone"])
                
                # Encrypt verification documents
                if profile.get("verification_documents"):
                    docs = profile["verification_documents"]
                    encrypted_docs = {}
                    
                    # Encrypt Aadhaar (12 digits)
                    if docs.get("aadhaar") and len(docs["aadhaar"]) == 12:
                        encrypted_docs["aadhaar"] = encryption_service.encrypt(docs["aadhaar"])
                    
                    # Encrypt PAN (10 chars)
                    if docs.get("pan") and len(docs["pan"]) == 10:
                        encrypted_docs["pan"] = encryption_service.encrypt(docs["pan"])
                    
                    # Encrypt bank account
                    if docs.get("bank_account"):
                        encrypted_docs["bank_account"] = encryption_service.encrypt(docs["bank_account"])
                    
                    # Encrypt IFSC
                    if docs.get("ifsc"):
                        encrypted_docs["ifsc"] = encryption_service.encrypt(docs["ifsc"])
                    
                    if encrypted_docs:
                        updates["verification_documents"] = {
                            **docs,
                            **encrypted_docs
                        }
                
                if updates:
                    await db.acharya_profiles.update_one(
                        {"_id": profile["_id"]},
                        {"$set": updates}
                    )
                    encrypted_count += 1
                    
                    if encrypted_count % 50 == 0:
                        logger.info(f"Encrypted {encrypted_count} acharya profiles...")
                        
            except Exception as e:
                logger.error(f"Failed to encrypt acharya profile {profile['_id']}: {e}")
                continue
        
        logger.info(f"✅ Successfully encrypted {encrypted_count} acharya profile records")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        client.close()


async def migrate_grihasta_data():
    """Encrypt sensitive data in grihasta profiles"""
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    encryption_service = EncryptionService(settings.ENCRYPTION_KEY)
    
    logger.info("Starting grihasta profile encryption migration...")
    
    try:
        profiles = await db.grihasta_profiles.find({}).to_list(length=None)
        
        logger.info(f"Found {len(profiles)} grihasta profiles to encrypt")
        
        encrypted_count = 0
        for profile in profiles:
            try:
                updates = {}
                
                # Encrypt phone
                if profile.get("phone") and profile["phone"].startswith("+"):
                    updates["phone"] = encryption_service.encrypt(profile["phone"])
                
                if updates:
                    await db.grihasta_profiles.update_one(
                        {"_id": profile["_id"]},
                        {"$set": updates}
                    )
                    encrypted_count += 1
                    
                    if encrypted_count % 100 == 0:
                        logger.info(f"Encrypted {encrypted_count} grihasta profiles...")
                        
            except Exception as e:
                logger.error(f"Failed to encrypt grihasta profile {profile['_id']}: {e}")
                continue
        
        logger.info(f"✅ Successfully encrypted {encrypted_count} grihasta profile records")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        client.close()


async def verify_encryption():
    """Verify that encryption was successful"""
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    encryption_service = EncryptionService(settings.ENCRYPTION_KEY)
    
    logger.info("Verifying encryption...")
    
    try:
        # Sample check: Get a few users and try to decrypt
        users = await db.users.find({}).limit(5).to_list(length=5)
        
        for user in users:
            if user.get("phone"):
                try:
                    decrypted_phone = encryption_service.decrypt(user["phone"])
                    # Should start with + after decryption
                    assert decrypted_phone.startswith("+"), "Invalid phone format after decryption"
                except Exception as e:
                    logger.error(f"Failed to decrypt user {user['_id']}: {e}")
                    raise
        
        # Check acharya profiles
        profiles = await db.acharya_profiles.find({}).limit(3).to_list(length=3)
        
        for profile in profiles:
            if profile.get("verification_documents", {}).get("aadhaar"):
                try:
                    aadhaar = profile["verification_documents"]["aadhaar"]
                    decrypted_aadhaar = encryption_service.decrypt(aadhaar)
                    # Should be 12 digits after decryption
                    assert len(decrypted_aadhaar) == 12, "Invalid Aadhaar format after decryption"
                    assert decrypted_aadhaar.isdigit(), "Aadhaar should be all digits"
                except Exception as e:
                    logger.error(f"Failed to decrypt acharya {profile['_id']}: {e}")
                    raise
        
        logger.info("✅ Encryption verification passed!")
        
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        raise
    finally:
        client.close()


async def rollback_encryption():
    """
    Rollback encryption (decrypt data back to plain text)
    USE WITH CAUTION - Only for emergencies
    """
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    encryption_service = EncryptionService(settings.ENCRYPTION_KEY)
    
    logger.warning("⚠️  ROLLING BACK ENCRYPTION - Decrypting all data...")
    
    response = input("Are you sure you want to decrypt all data? Type 'YES' to confirm: ")
    if response != "YES":
        logger.info("Rollback cancelled")
        return
    
    try:
        # Decrypt users
        users = await db.users.find({}).to_list(length=None)
        for user in users:
            updates = {}
            if user.get("phone"):
                try:
                    updates["phone"] = encryption_service.decrypt(user["phone"])
                except:
                    pass
            if user.get("email"):
                try:
                    updates["email"] = encryption_service.decrypt(user["email"])
                except:
                    pass
            
            if updates:
                await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        
        logger.info("✅ Rolled back encryption for users")
        
        # Decrypt acharya profiles
        profiles = await db.acharya_profiles.find({}).to_list(length=None)
        for profile in profiles:
            updates = {}
            if profile.get("phone"):
                try:
                    updates["phone"] = encryption_service.decrypt(profile["phone"])
                except:
                    pass
            
            if profile.get("verification_documents"):
                docs = profile["verification_documents"]
                decrypted_docs = {}
                
                for key in ["aadhaar", "pan", "bank_account", "ifsc"]:
                    if docs.get(key):
                        try:
                            decrypted_docs[key] = encryption_service.decrypt(docs[key])
                        except:
                            pass
                
                if decrypted_docs:
                    updates["verification_documents"] = {**docs, **decrypted_docs}
            
            if updates:
                await db.acharya_profiles.update_one({"_id": profile["_id"]}, {"$set": updates})
        
        logger.info("✅ Rolled back encryption for acharya profiles")
        
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        raise
    finally:
        client.close()


async def main():
    """Run all migrations"""
    
    logger.info("=" * 60)
    logger.info("STARTING DATA ENCRYPTION MIGRATION")
    logger.info("=" * 60)
    
    try:
        # Run migrations
        await migrate_user_data()
        await migrate_acharya_data()
        await migrate_grihasta_data()
        
        # Verify
        await verify_encryption()
        
        logger.info("=" * 60)
        logger.info("✅ MIGRATION COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ MIGRATION FAILED: {e}")
        logger.error("Please review errors and consider running rollback if needed")
        raise


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        asyncio.run(rollback_encryption())
    else:
        asyncio.run(main())
