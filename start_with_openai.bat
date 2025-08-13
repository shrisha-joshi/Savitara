@echo off
echo 🚀 Starting IndicBERT v2 with OpenAI Integration...
echo.

echo 📋 Checking OpenAI setup...
if "%OPENAI_API_KEY%"=="" (
    echo ⚠️  No OpenAI API key found in environment
    echo.
    echo 🔑 To get an OpenAI API key:
    echo    1. Go to https://platform.openai.com/
    echo    2. Sign up and get your API key
    echo    3. Set it as environment variable or create .env file
    echo.
    echo 💡 For now, the system will work with enhanced fallback responses
    echo.
) else (
    echo ✅ OpenAI API key found
    echo.
)

echo 📦 Installing required packages...
pip install openai flask

echo.
echo 🌐 Starting the web demo...
echo 💬 Open http://localhost:5000 in your browser
echo.
echo Press Ctrl+C to stop the server
echo.

python working_web_demo.py

pause
