# PowerShell Setup Script for IndicBERT v2 Enhanced System
# Run this script in PowerShell as Administrator

Write-Host "🔧 IndicBERT v2 Enhanced System - Windows PowerShell Setup" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Cyan

# Check if Python is installed
Write-Host "`n📋 Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found! Please install Python 3.8+ from https://www.python.org/downloads/" -ForegroundColor Red
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pip is available
Write-Host "`n📦 Checking pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "✅ pip found: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pip not found! Please reinstall Python with pip" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install requirements
Write-Host "`n📚 Installing Python requirements..." -ForegroundColor Yellow
try {
    pip install -r enhanced_requirements.txt
    Write-Host "✅ Requirements installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install requirements. Please check the error above." -ForegroundColor Red
    Read-Host "Press Enter to continue anyway"
}

# Create .env file
Write-Host "`n🔐 Creating .env file..." -ForegroundColor Yellow

$envContent = @"
# MongoDB Configuration for Windows
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=indicbert_v2
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_AUTH_SOURCE=admin
MONGO_MAX_POOL_SIZE=100
MONGO_CONNECT_TIMEOUT_MS=5000

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
OPENAI_TOP_P=0.9

# Flask Configuration
FLASK_SECRET_KEY=indicbert-v2-secret-key-2024-windows
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
"@

try {
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env file created successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create .env file: $($_.Exception.Message)" -ForegroundColor Red
}

# Create directories
Write-Host "`n📁 Creating necessary directories..." -ForegroundColor Yellow
$directories = @("fine_tuned_models", "logs", "uploads", "temp")
foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✅ Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Directory already exists: $dir" -ForegroundColor Cyan
    }
}

# MongoDB setup instructions
Write-Host "`n📊 MongoDB Setup Instructions:" -ForegroundColor Yellow
Write-Host "1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community" -ForegroundColor White
Write-Host "2. Install with default settings (MongoDB will run as a Windows service)" -ForegroundColor White
Write-Host "3. Edit the .env file with your MongoDB credentials" -ForegroundColor White
Write-Host "4. Get your OpenAI API key from: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "5. Edit the .env file with your OpenAI API key" -ForegroundColor White

# Create startup script
Write-Host "`n🚀 Creating startup script..." -ForegroundColor Yellow
$startupScript = @"
@echo off
echo Starting IndicBERT v2 Enhanced System...
echo.

REM Check if .env file exists
if not exist ".env" (
    echo Error: .env file not found
    echo Please run: python windows_setup.py
    pause
    exit /b 1
)

REM Start the system
echo Starting the system...
python start_enhanced_system.py

pause
"@

try {
    $startupScript | Out-File -FilePath "start_indicbert.bat" -Encoding ASCII
    Write-Host "✅ Startup script created: start_indicbert.bat" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create startup script: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit the .env file with your actual credentials" -ForegroundColor White
Write-Host "2. Install MongoDB (see instructions above)" -ForegroundColor White
Write-Host "3. Double-click start_indicbert.bat to start the system" -ForegroundColor White
Write-Host "4. Or run: python start_enhanced_system.py" -ForegroundColor White

Write-Host "`n💡 Tip: You can also run 'python windows_setup.py' for an interactive setup" -ForegroundColor Cyan

Read-Host "`nPress Enter to exit"
