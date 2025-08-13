@echo off
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
