# 🪟 Windows Setup Guide for IndicBERT v2 Enhanced System

## 🚀 Quick Start (3 Steps)

### Step 1: Run Setup Script
```cmd
python windows_setup.py
```
This will create your `.env` file and all necessary files.

### Step 2: Install MongoDB
Download and install from: https://www.mongodb.com/try/download/community

### Step 3: Start the System
Double-click `start_indicbert.bat` or run:
```cmd
python start_enhanced_system.py
```

---

## 📋 Prerequisites

- **Windows 10/11** (64-bit)
- **Python 3.8+** with pip
- **MongoDB Community Server**
- **OpenAI API Key**

---

## 🔧 Detailed Setup

### 1. Python Installation
1. Download Python from: https://www.python.org/downloads/
2. **IMPORTANT**: Check "Add Python to PATH" during installation
3. Verify installation:
   ```cmd
   python --version
   pip --version
   ```

### 2. MongoDB Installation
1. Go to: https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: Latest (6.0+)
   - **Platform**: Windows
   - **Package**: msi
3. Download and run the installer
4. Choose "Complete" installation
5. MongoDB will run automatically as a Windows service

### 3. OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Sign in or create account
3. Create a new API key
4. Copy the key (starts with `sk-`)

---

## 🎯 Setup Scripts

### Option 1: Interactive Python Setup (Recommended)
```cmd
python windows_setup.py
```
This script will:
- Ask for your credentials
- Create `.env` file
- Create startup scripts
- Generate setup guides

### Option 2: PowerShell Setup
```powershell
.\setup_windows.ps1
```
Run this in PowerShell as Administrator.

### Option 3: Manual Setup
1. Create `.env` file manually
2. Add your credentials
3. Run `start_indicbert.bat`

---

## 🔐 Credentials Configuration

### MongoDB Credentials
```bash
# For local installation (default)
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=indicbert_v2

# For authentication (optional)
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_AUTH_SOURCE=admin
```

### OpenAI Credentials
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Example .env File
```bash
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=indicbert_v2
MONGO_USERNAME=admin
MONGO_PASSWORD=mypassword123
MONGO_AUTH_SOURCE=admin

# OpenAI Configuration
OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef

# Flask Configuration
FLASK_SECRET_KEY=my-secret-key-here
FLASK_ENV=development
```

---

## 🚀 Starting the System

### Method 1: Double-click (Easiest)
1. Double-click `start_indicbert.bat`
2. Wait for system to start
3. Open browser to: http://localhost:5000

### Method 2: Command Line
```cmd
python start_enhanced_system.py
```

### Method 3: PowerShell
```powershell
python start_enhanced_system.py
```

---

## 📊 MongoDB Verification

### Check if MongoDB is Running
1. Open Services (Win+R → services.msc)
2. Look for "MongoDB" service
3. Status should be "Running"

### Test Connection
```cmd
python -c "from pymongo import MongoClient; client = MongoClient('mongodb://localhost:27017/'); print('✅ MongoDB Connected!')"
```

### Create Database (Optional)
```cmd
mongosh
use indicbert_v2
db.createUser({user: "admin", pwd: "password", roles: ["readWrite"]})
exit
```

---

## 🐛 Troubleshooting

### Python Not Found
- Reinstall Python with "Add to PATH" checked
- Restart Command Prompt after installation

### MongoDB Connection Failed
- Check if MongoDB service is running
- Verify port 27017 is not blocked by firewall
- Check MongoDB installation

### OpenAI API Error
- Verify API key is correct
- Check if you have credits in your OpenAI account
- Ensure API key has proper permissions

### Port Already in Use
- Change port in `.env` file:
  ```bash
  FLASK_PORT=5001
  ```
- Or kill process using port 5000

---

## 📁 File Structure
```
IndicBERTv2/
├── .env                          # Your credentials (created by setup)
├── windows_setup.py             # Interactive setup script
├── setup_windows.ps1            # PowerShell setup script
├── start_indicbert.bat          # Windows startup script
├── start_enhanced_system.py     # Main system startup
├── enhanced_web_demo.py         # Main Flask application
├── database.py                  # MongoDB handler
├── fine_tuning_processor.py     # Fine-tuning logic
├── openai_integration.py        # OpenAI integration
├── config.py                    # Configuration manager
├── enhanced_requirements.txt    # Python dependencies
└── templates/
    └── index.html              # Web interface
```

---

## 🎉 What You Get

After setup, you'll have:
- ✅ MongoDB database for file storage
- ✅ File upload and fine-tuning system
- ✅ Multilingual IndicBERT v2 models
- ✅ OpenAI API integration
- ✅ Web chat interface
- ✅ Automatic fine-tuning on file upload
- ✅ Persistent storage for lifetime learning

---

## 🆘 Need Help?

1. **Check logs**: Look for error messages in the console
2. **Verify credentials**: Ensure `.env` file has correct values
3. **Test connections**: Use the verification commands above
4. **Restart services**: Stop and restart MongoDB if needed

---

## 🚀 Next Steps

1. **Upload files**: Use the web interface to upload training data
2. **Start fine-tuning**: Click "Start Fine-tuning" button
3. **Chat**: Ask questions in multiple languages
4. **Monitor**: Check training status and costs

**Happy fine-tuning! 🎯**
