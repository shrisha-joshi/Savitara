#!/bin/bash

# Savitara Platform - Complete Setup Script
# This script sets up the entire Savitara platform

set -e

echo "🎯 Savitara Platform - Complete Setup"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

command -v python3 >/dev/null 2>&1 || { echo -e "${RED}Python 3 is required but not installed.${NC}" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}" >&2; exit 1; }

echo -e "${GREEN}✓ All prerequisites met${NC}"

# Setup Backend
echo -e "\n${YELLOW}Setting up Backend...${NC}"
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please configure backend/.env file${NC}"
fi

echo -e "${GREEN}✓ Backend setup complete${NC}"
cd ..

# Setup Mobile App
echo -e "\n${YELLOW}Setting up Mobile App...${NC}"
cd mobile-app

# Install dependencies
npm install

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please configure mobile-app/.env file${NC}"
fi

echo -e "${GREEN}✓ Mobile app setup complete${NC}"
cd ..

# Setup Admin Dashboard
echo -e "\n${YELLOW}Setting up Admin Dashboard...${NC}"
cd admin-web

# Install dependencies
npm install

# Create .env.local if not exists
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo -e "${YELLOW}⚠️  Please configure admin-web/.env.local file${NC}"
fi

echo -e "${GREEN}✓ Admin dashboard setup complete${NC}"
cd ..

# Final Instructions
echo -e "\n${GREEN}======================================"
echo "🎉 Setup Complete!"
echo "======================================${NC}"
echo ""
echo "Next Steps:"
echo "1. Start MongoDB:    mongod"
echo "2. Start Redis:      redis-server"
echo "3. Configure .env files in each directory"
echo "4. Start Backend:    cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "5. Start Mobile:     cd mobile-app && npm start"
echo "6. Start Admin:      cd admin-web && npm run dev"
echo ""
echo "Access Points:"
echo "  - Backend API:       http://localhost:8000"
echo "  - API Docs:          http://localhost:8000/docs"
echo "  - Admin Dashboard:   http://localhost:3001"
echo "  - Mobile App:        Expo DevTools"
echo ""
