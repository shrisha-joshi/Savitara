@echo off
title IndicBERT v2 Enhanced System
color 0A

echo.
echo ========================================
echo    IndicBERT v2 Enhanced System
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8+ from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found
    echo.
    echo Please run one of these setup scripts first:
    echo 1. python windows_setup.py
    echo 2. .\setup_windows.ps1 (PowerShell)
    echo.
    pause
    exit /b 1
)

REM Install/update requirements
echo Installing/updating Python requirements...
pip install -r enhanced_requirements.txt

echo.
echo Starting IndicBERT v2 Enhanced System...
echo.
echo The system will open in your web browser at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the system
echo.

REM Start the system
python start_enhanced_system.py

echo.
echo System stopped.
pause
