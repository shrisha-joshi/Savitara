# MongoDB Setup Guide for Windows

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
2. Navigate to MongoDB bin directory (usually C:\Program Files\MongoDB\Server\6.0\bin)
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
