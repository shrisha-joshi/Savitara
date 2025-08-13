#!/usr/bin/env python3
"""
Windows Setup Script for IndicBERT v2 Enhanced System

This script helps Windows users set up their credentials and configuration.
"""

import os
import sys
import json
from pathlib import Path

def create_env_file():
    """Create a .env file with user credentials."""
    
    print("🔧 IndicBERT v2 Enhanced System - Windows Setup")
    print("=" * 60)
    
    # Get MongoDB credentials
    print("\n📊 MongoDB Configuration:")
    print("-" * 30)
    
    mongo_uri = input("MongoDB URI (default: mongodb://localhost:27017/): ").strip()
    if not mongo_uri:
        mongo_uri = "mongodb://localhost:27017/"
    
    mongo_db_name = input("Database name (default: indicbert_v2): ").strip()
    if not mongo_db_name:
        mongo_db_name = "indicbert_v2"
    
    mongo_username = input("MongoDB username (optional, press Enter to skip): ").strip()
    mongo_password = input("MongoDB password (optional, press Enter to skip): ").strip()
    
    # Get OpenAI API key
    print("\n🤖 OpenAI Configuration:")
    print("-" * 30)
    
    openai_api_key = input("OpenAI API Key (required): ").strip()
    if not openai_api_key:
        print("❌ OpenAI API key is required!")
        return False
    
    # Get Flask secret key
    print("\n🔐 Flask Configuration:")
    print("-" * 30)
    
    flask_secret = input("Flask Secret Key (default: auto-generate): ").strip()
    if not flask_secret:
        import secrets
        flask_secret = secrets.token_hex(32)
    
    # Create .env content
    env_content = f"""# MongoDB Configuration for Windows
MONGO_URI={mongo_uri}
MONGO_DB_NAME={mongo_db_name}
MONGO_USERNAME={mongo_username}
MONGO_PASSWORD={mongo_password}
MONGO_AUTH_SOURCE=admin
MONGO_MAX_POOL_SIZE=100
MONGO_CONNECT_TIMEOUT_MS=5000

# OpenAI Configuration
OPENAI_API_KEY={openai_api_key}
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
OPENAI_TOP_P=0.9

# Flask Configuration
FLASK_SECRET_KEY={flask_secret}
FLASK_ENV=development
FLASK_DEBUG=True

# Fine-tuning Configuration
TRAINING_OUTPUT_DIR=./fine_tuned_models
MAX_FILE_SIZE=10485760
BATCH_SIZE=8
LEARNING_RATE=2e-5
NUM_EPOCHS=3

# System Configuration
LOG_LEVEL=INFO
MAX_WORKERS=4
CACHE_TTL=3600
"""
    
    # Write .env file
    try:
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_content)
        print(f"\n✅ .env file created successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating .env file: {e}")
        return False

def create_windows_batch_file():
    """Create a Windows batch file for easy startup."""
    
    batch_content = """@echo off
echo Starting IndicBERT v2 Enhanced System...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo Error: .env file not found
    echo Please run: python windows_setup.py
    pause
    exit /b 1
)

REM Install requirements if needed
echo Installing/updating requirements...
pip install -r enhanced_requirements.txt

REM Start the system
echo Starting the system...
python start_enhanced_system.py

pause
"""
    
    try:
        with open('start_indicbert_windows.bat', 'w', encoding='utf-8') as f:
            f.write(batch_content)
        print("✅ Windows batch file created: start_indicbert_windows.bat")
        return True
    except Exception as e:
        print(f"❌ Error creating batch file: {e}")
        return False

def create_mongodb_setup_guide():
    """Create a MongoDB setup guide for Windows."""
    
    guide_content = """# MongoDB Setup Guide for Windows

## Step 1: Download MongoDB Community Server
1. Go to: https://www.mongodb.com/try/download/community
2. Select "Windows" and "msi" package
3. Download and run the installer

## Step 2: Install MongoDB
1. Run the downloaded .msi file
2. Choose "Complete" installation
3. Install MongoDB Compass (optional but recommended)
4. Complete the installation

## Step 3: Start MongoDB Service
1. MongoDB should start automatically as a Windows service
2. To check: Open Services (services.msc)
3. Look for "MongoDB" service - it should be running

## Step 4: Verify Installation
1. Open Command Prompt as Administrator
2. Navigate to MongoDB bin directory (usually C:\\Program Files\\MongoDB\\Server\\6.0\\bin)
3. Run: mongod --version
4. Run: mongo (or mongosh for newer versions)

## Step 5: Create Database (Optional)
1. Connect to MongoDB: mongo
2. Create database: use indicbert_v2
3. Create user (optional):
   ```
   db.createUser({
     user: "your_username",
     pwd: "your_password",
     roles: ["readWrite"]
   })
   ```
4. Exit: exit

## Step 6: Test Connection
1. Run: python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017/'); print('Connected!')"
2. If successful, you'll see "Connected!"

## Troubleshooting
- If MongoDB service is not running, start it manually in Services
- If port 27017 is blocked, check Windows Firewall
- For authentication issues, ensure username/password are correct
"""
    
    try:
        with open('MONGODB_WINDOWS_SETUP.md', 'w', encoding='utf-8') as f:
            f.write(guide_content)
        print("✅ MongoDB setup guide created: MONGODB_WINDOWS_SETUP.md")
        return True
    except Exception as e:
        print(f"❌ Error creating guide: {e}")
        return False

def main():
    """Main setup function."""
    
    print("🚀 Welcome to IndicBERT v2 Enhanced System Setup for Windows!")
    
    # Create .env file
    if create_env_file():
        print("\n📝 Next steps:")
        print("1. Edit the .env file with your actual credentials")
        print("2. Install MongoDB (see MONGODB_WINDOWS_SETUP.md)")
        print("3. Get your OpenAI API key from https://platform.openai.com/api-keys")
        print("4. Run: start_indicbert_windows.bat")
        
        # Create additional files
        create_windows_batch_file()
        create_mongodb_setup_guide()
        
        print("\n🎉 Setup complete! You can now:")
        print("- Double-click start_indicbert_windows.bat to start the system")
        print("- Or run: python start_enhanced_system.py")
        
    else:
        print("\n❌ Setup failed. Please check the errors above.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
