# Savitara Enterprise - Complete Setup and Start Script
# This script will setup and start all services

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SAVITARA ENTERPRISE - COMPLETE SETUP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python 3.11+" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check Docker
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "✅ $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Docker not found (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 1: Installing Backend Dependencies" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location backend
Write-Host "Installing Python packages..." -ForegroundColor Yellow
pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 2: Installing Mobile App Dependencies" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location savitara-app
Write-Host "Installing Node packages for mobile app..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install mobile app dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Mobile app dependencies installed" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 3: Installing Web App Dependencies" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location savitara-web
Write-Host "Installing Node packages for web app..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install web app dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Web app dependencies installed" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 4: Installing Admin Panel Dependencies" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location admin-savitara-web
Write-Host "Installing Node packages for admin panel..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install admin panel dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Admin panel dependencies installed" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 5: Starting Docker Services" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting MongoDB, Redis, and Elasticsearch..." -ForegroundColor Yellow
docker-compose up -d mongodb redis elasticsearch

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker services started" -ForegroundColor Green
    Write-Host ""
    Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Check services
    Write-Host "Checking MongoDB..." -ForegroundColor Yellow
    docker ps | Select-String "savitara-mongodb"
    
    Write-Host "Checking Redis..." -ForegroundColor Yellow
    docker ps | Select-String "savitara-redis"
    
    Write-Host "Checking Elasticsearch..." -ForegroundColor Yellow
    docker ps | Select-String "savitara-elasticsearch"
} else {
    Write-Host "⚠️  Docker services not started. You'll need to run them manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  STEP 6: Initializing Database" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location backend

Write-Host "Creating database indexes..." -ForegroundColor Yellow
python -c @"
import asyncio
import sys
sys.path.insert(0, '.')

async def init_db():
    from app.services.query_optimizer import QueryOptimizer
    from motor.motor_asyncio import AsyncIOMotorClient
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['savitara_dev']
    
    optimizer = QueryOptimizer(db)
    await optimizer.create_all_indexes()
    print('✅ Database indexes created')
    
    client.close()

asyncio.run(init_db())
"@

Write-Host "Creating Elasticsearch index..." -ForegroundColor Yellow
python -c @"
import asyncio
import sys
sys.path.insert(0, '.')

async def init_search():
    try:
        from app.services.search_service import SearchService
        
        search = SearchService(['http://localhost:9200'])
        await search.initialize()
        await search.create_index()
        print('✅ Elasticsearch index created')
    except Exception as e:
        print(f'⚠️  Elasticsearch initialization skipped: {e}')

asyncio.run(init_search())
"@

Set-Location ..

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🎉 All dependencies installed and services started!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the applications, run these commands in separate terminals:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Backend API:" -ForegroundColor Cyan
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host ""
Write-Host "2. Web App:" -ForegroundColor Cyan
Write-Host "   cd savitara-web" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "3. Mobile App:" -ForegroundColor Cyan
Write-Host "   cd savitara-app" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor White
Write-Host ""
Write-Host "4. Admin Panel:" -ForegroundColor Cyan
Write-Host "   cd admin-savitara-web" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Access Points:" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Backend API:    http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:       http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Web App:        http://localhost:5173" -ForegroundColor White
Write-Host "  Admin Panel:    http://localhost:3001" -ForegroundColor White
Write-Host "  Mobile App:     Expo Dev Tools" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "For complete documentation, see:" -ForegroundColor Yellow
Write-Host "  - QUICKSTART_ENTERPRISE.md" -ForegroundColor White
Write-Host "  - ENTERPRISE_FEATURES_COMPLETE.md" -ForegroundColor White
Write-Host ""
