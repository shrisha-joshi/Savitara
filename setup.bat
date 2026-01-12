@echo off
REM Savitara Platform - Complete Setup Script (Windows)
REM This script sets up the entire Savitara platform on Windows

echo ========================================
echo Savitara Platform - Complete Setup
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is required but not installed
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is required but not installed
    exit /b 1
)

echo [OK] Prerequisites check passed
echo.

REM Setup Backend
echo ========================================
echo Setting up Backend...
echo ========================================
cd backend

REM Create virtual environment
if not exist "venv" (
    python -m venv venv
)

REM Activate and install
call venv\Scripts\activate.bat
pip install -r requirements.txt

REM Create .env
if not exist ".env" (
    copy .env.example .env
    echo [WARNING] Please configure backend\.env file
)

echo [OK] Backend setup complete
cd ..

REM Setup Mobile App
echo.
echo ========================================
echo Setting up Mobile App...
echo ========================================
cd mobile-app

call npm install

if not exist ".env" (
    copy .env.example .env
    echo [WARNING] Please configure mobile-app\.env file
)

echo [OK] Mobile app setup complete
cd ..

REM Setup Admin Dashboard
echo.
echo ========================================
echo Setting up Admin Dashboard...
echo ========================================
cd admin-web

call npm install

if not exist ".env.local" (
    copy .env.example .env.local
    echo [WARNING] Please configure admin-web\.env.local file
)

echo [OK] Admin dashboard setup complete
cd ..

REM Final Instructions
echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Start MongoDB and Redis
echo 2. Configure .env files in each directory
echo 3. Backend:  cd backend ^& venv\Scripts\activate ^& uvicorn app.main:app --reload
echo 4. Mobile:   cd mobile-app ^& npm start
echo 5. Admin:    cd admin-web ^& npm run dev
echo.
echo Access Points:
echo   - Backend API:       http://localhost:8000
echo   - API Docs:          http://localhost:8000/docs
echo   - Admin Dashboard:   http://localhost:3001
echo   - Mobile App:        Expo DevTools
echo.
pause
