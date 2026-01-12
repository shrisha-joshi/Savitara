# 🚀 Quick Start Guide - Enterprise Features

## Get Started in 5 Minutes

This guide will get all enterprise features running locally for development.

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- MongoDB (via Docker)
- Redis (via Docker)
- Elasticsearch (via Docker)

---

## Step 1: Start Infrastructure (2 minutes)

```bash
# Start MongoDB, Redis, and Elasticsearch
docker-compose up -d

# Verify services are running
docker ps

# Expected output:
# - mongodb:27017
# - redis:6379
# - elasticsearch:9200
```

---

## Step 2: Setup Backend (1 minute)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=savitara_dev
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_HOSTS=["http://localhost:9200"]
ENCRYPTION_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
ENVIRONMENT=development
EOF

# Initialize database indexes
python -c "
from app.services.query_optimizer import QueryOptimizer
from app.db.connection import get_database
import asyncio

async def init():
    db = await get_database()
    optimizer = QueryOptimizer(db)
    await optimizer.create_all_indexes()
    print('✅ Database indexes created')

asyncio.run(init())
"

# Initialize Elasticsearch index
python -c "
from app.services.search_service import SearchService
import asyncio

async def init():
    search = SearchService(['http://localhost:9200'])
    await search.initialize()
    await search.create_index()
    print('✅ Elasticsearch index created')

asyncio.run(init())
"

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend now running at **http://localhost:8000**

---

## Step 3: Setup Mobile App (1 minute)

```bash
# Open new terminal
cd savitara-app

# Install dependencies
npm install

# Start Expo dev server
npm start

# Options:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Scan QR code with Expo Go app
```

Mobile app now running on Expo

---

## Step 4: Setup Web App (1 minute)

```bash
# Open new terminal
cd savitara-web

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
EOF

# Start dev server
npm run dev
```

Web app now running at **http://localhost:5173**

---

## Step 5: Setup Admin Panel (1 minute)

```bash
# Open new terminal
cd admin-savitara-web

# Install dependencies
npm install

# Start dev server
npm run dev
```

Admin panel now running at **http://localhost:3001**

---

## 🎉 You're All Set!

All enterprise features are now running:

### 🔗 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | FastAPI backend with all services |
| API Docs | http://localhost:8000/docs | Interactive API documentation |
| Mobile App | Expo Dev | React Native mobile app |
| Web App | http://localhost:5173 | React web application |
| Admin Panel | http://localhost:3001 | Next.js admin dashboard |
| MongoDB | localhost:27017 | Database |
| Redis | localhost:6379 | Cache & rate limiting |
| Elasticsearch | localhost:9200 | Search engine |

---

## 🧪 Test Enterprise Features

### 1. Test Elasticsearch Search

```bash
# Full-text search
curl "http://localhost:8000/api/v1/users/acharyas?query=vedic%20astrology&use_elasticsearch=true"

# Geospatial search
curl "http://localhost:8000/api/v1/users/acharyas?latitude=19.0760&longitude=72.8777&use_elasticsearch=true"

# Multi-filter search
curl "http://localhost:8000/api/v1/users/acharyas?city=Mumbai&min_rating=4.5&specialization=Vedic%20Rituals"
```

### 2. Test Rate Limiting

```bash
# Make 70 rapid requests (should hit rate limit)
for i in {1..70}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/v1/users/acharyas
done

# You should see:
# - First 60 requests: 200 OK
# - Remaining 10 requests: 429 Too Many Requests
```

### 3. Test Compression

```bash
# Request with compression
curl -H "Accept-Encoding: gzip" -I http://localhost:8000/api/v1/users/acharyas

# Check response headers for:
# Content-Encoding: gzip
# Vary: Accept-Encoding
```

### 4. Test Audit Logging

```bash
# Login (creates audit log)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "device_id": "test_device",
    "role": "GRIHASTA"
  }'

# Check audit logs in MongoDB
mongosh savitara_dev --eval "db.audit_logs.find().limit(5).pretty()"
```

### 5. Test Real-time Chat

```javascript
// In browser console at http://localhost:5173
const ws = new WebSocket('ws://localhost:8000/ws/user_123');

ws.onopen = () => {
  console.log('Connected!');
  ws.send(JSON.stringify({
    type: 'send_message',
    conversation_id: 'conv_123',
    content: 'Hello!'
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

### 6. View Analytics Dashboard

1. Open http://localhost:3001/dashboard
2. View:
   - Revenue trend chart
   - User growth chart
   - Booking status pie chart
   - Top performers grid

---

## 🧪 Run Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run E2E tests only
pytest tests/test_e2e_user_journey.py -v

# View coverage report
open htmlcov/index.html
```

### Load Tests

```bash
cd backend

# Install Locust
pip install locust

# Run load test (web UI)
locust -f tests/load/locustfile.py --host=http://localhost:8000

# Open http://localhost:8089
# Enter: 100 users, 10 spawn rate
# Click "Start swarming"
```

---

## 🐛 Troubleshooting

### MongoDB Connection Failed

```bash
# Check MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker-compose restart mongodb

# Check logs
docker logs savitara_mongodb
```

### Redis Connection Failed

```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli ping
# Should respond: PONG

# Restart Redis
docker-compose restart redis
```

### Elasticsearch Not Starting

```bash
# Increase Docker memory to 4GB
# Docker Desktop → Settings → Resources → Memory: 4GB

# Set vm.max_map_count (Linux/Mac)
sysctl -w vm.max_map_count=262144

# Restart Elasticsearch
docker-compose restart elasticsearch

# Check logs
docker logs savitara_elasticsearch
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
```

### Module Not Found

```bash
# Ensure you're in correct directory
cd backend

# Reinstall dependencies
pip install -r requirements.txt

# Or use virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 📦 Docker Compose (Alternative Setup)

If you prefer running everything in Docker:

```bash
# Start all services
docker-compose -f docker-compose.full.yml up -d

# Services included:
# - backend:8000
# - mongodb:27017
# - redis:6379
# - elasticsearch:9200

# View logs
docker-compose -f docker-compose.full.yml logs -f

# Stop all services
docker-compose -f docker-compose.full.yml down
```

---

## 🚀 Deploy to Production

See [ENTERPRISE_FEATURES_COMPLETE.md](ENTERPRISE_FEATURES_COMPLETE.md) for complete production deployment guide.

Quick deployment to Kubernetes:

```bash
# Build and push Docker image
docker build -t your-org/savitara-backend:latest backend/
docker push your-org/savitara-backend:latest

# Deploy to K8s
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/monitoring/prometheus-config.yaml

# Check status
kubectl get pods
kubectl rollout status deployment/savitara-backend
```

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **Complete Feature Guide**: [ENTERPRISE_FEATURES_COMPLETE.md](ENTERPRISE_FEATURES_COMPLETE.md)
- **API Testing Guide**: [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Testing Guide**: [TESTING.md](TESTING.md)

---

## 🎯 Next Steps

1. ✅ **Create Test Data** - Run seed scripts to populate database
2. ✅ **Test API Endpoints** - Use Postman or http://localhost:8000/docs
3. ✅ **Run Load Tests** - Validate performance with Locust
4. ✅ **Configure Monitoring** - Set up Prometheus and Grafana
5. ✅ **Deploy to Staging** - Test in staging environment

---

## 💡 Tips

**Performance Optimization**:
- Use Elasticsearch for search (10x faster than MongoDB)
- Enable compression for API responses (60-80% bandwidth reduction)
- Use Redis caching for frequent queries (5x faster response)
- Use virtual scrolling for large lists (50% less memory)

**Security Best Practices**:
- All sensitive data encrypted in database
- Rate limiting prevents abuse
- Audit logging tracks all critical actions
- JWT tokens expire after 24 hours
- HTTPS required in production

**Development Workflow**:
- Run tests before committing (`pytest tests/ -v`)
- Check code coverage (`pytest --cov=app`)
- Lint code (`black app/ && isort app/`)
- Update documentation when adding features

---

**🎉 Happy Coding!**

All enterprise features implemented and ready to use. Build the world's #1 spiritual services platform!

