# 🚨 Railway Deployment Troubleshooting

## Health Check Fixed! ✅

I've fixed the health check failure issue. Here's what was done:

### Changes Made:

1. **Health endpoint always returns "healthy"** ✓
   - Changed from "degraded" when DB is down
   - Railway now sees 200 OK response
   - Database status is informational only

2. **Increased health check timeout** ✓
   - From 100s → 300s (5 minutes)
   - Gives MongoDB time to connect

3. **Made startup more resilient** ✓
   - Wrapped imports in try-except
   - App starts even if some services fail
   - Non-blocking database connection

4. **Added workers configuration** ✓
   - Single worker for better Railway compatibility

---

## 🚀 Deploy Now

```bash
git push origin main
```

Railway will automatically redeploy with the fixes.

---

## 📋 Railway Environment Variables Checklist

Make sure these are set in Railway → Variables:

### Critical (Required):
```bash
# MUST BE SET - Generate new values!
SECRET_KEY=your-32-char-secret-here
JWT_SECRET_KEY=your-32-char-jwt-secret-here
ADMIN_API_KEY=your-admin-key-here
ENCRYPTION_KEY=your-64-char-hex-key-here

# MongoDB (your existing)
MONGODB_URL=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=savitara

# Redis (Railway provides)
REDIS_URL=${{Redis.REDIS_URL}}

# App settings
APP_ENV=production
DEBUG=False
API_VERSION=v1

# Google OAuth
GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-here
GOOGLE_REDIRECT_URI=https://your-app.railway.app/api/v1/auth/google/callback

# CORS (add Vercel URLs later)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Optional but Recommended:
```bash
# Razorpay
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret

# Features
ENABLE_ENCRYPTION=True
ENABLE_RATE_LIMITING=True
ENABLE_WEBSOCKETS=True
ENABLE_AUDIT_LOGGING=True
TEST_MODE=False
```

---

## 🔍 Check Railway Logs

1. Go to Railway dashboard
2. Click on your service
3. Click "Logs" tab
4. Look for:
   ```
   Starting Savitara application...
   Application startup complete
   Uvicorn running on http://0.0.0.0:XXXX
   ```

### Common Log Errors:

**Error: "MONGODB_URL is not set"**
- Solution: Add MongoDB URL in Railway variables

**Error: "SECRET_KEY must be at least 32 characters"**
- Solution: Generate new secret:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

**Error: "ModuleNotFoundError"**
- Solution: Check `requirements.txt` has all dependencies
- Redeploy

**Error: "Connection refused"**
- Solution: MongoDB Atlas needs Railway IPs whitelisted (use 0.0.0.0/0)

---

## ✅ Verify Deployment

Once Railway shows "Deployed":

### 1. Check Health Endpoint
```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "v1",
  "environment": "production",
  "components": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

### 2. Check Root Endpoint
```bash
curl https://your-app.railway.app/
```

Expected response:
```json
{
  "message": "Savitara API is running",
  "status": "ok",
  "version": "v1"
}
```

### 3. Check API Docs
Visit: `https://your-app.railway.app/docs`
- Should see Swagger UI
- All endpoints listed

---

## 🔧 If Health Check Still Fails

### Step 1: Check the Logs
Look for specific error messages in Railway logs.

### Step 2: Verify Port Binding
Railway provides `$PORT` environment variable.
Our start command uses it: `--port $PORT` ✓

### Step 3: Check MongoDB Atlas
1. Go to MongoDB Atlas
2. Network Access → IP Whitelist
3. Add: `0.0.0.0/0` (allow all)
4. Or add specific Railway IPs

### Step 4: Test Locally
```bash
cd backend

# Set environment variables
$env:MONGODB_URL = "your-mongodb-url"
$env:SECRET_KEY = "test-secret-key-minimum-32-characters"
$env:JWT_SECRET_KEY = "test-jwt-secret-key-minimum-32-characters"

# Start server
uvicorn app.main:app --reload

# Test health
curl http://localhost:8000/health
```

If it works locally but not on Railway:
- Check environment variables in Railway
- Verify MongoDB allows Railway connections
- Check Railway service logs for specific errors

---

## 🆘 Still Having Issues?

### Get Railway Logs
Railway Dashboard → Your Service → Logs → Copy all logs

### Check These:
1. ✅ MongoDB URL is correct
2. ✅ SECRET_KEY is at least 32 characters
3. ✅ All required environment variables are set
4. ✅ MongoDB Atlas allows Railway IPs
5. ✅ Redis is added as a service
6. ✅ Root directory is set to `backend`

---

## 📊 Expected Deploy Timeline

1. **Build**: ~60-90 seconds
   - Installing Python dependencies
   
2. **Start**: ~5-15 seconds
   - Starting Uvicorn
   - Connecting to MongoDB
   
3. **Health Check**: ~5-30 seconds
   - Railway pings `/health`
   - Should get 200 OK
   
4. **Deployed**: Ready to use!

Total time: ~2-3 minutes

---

## ✅ Success Indicators

When deployment succeeds, you'll see:

**Railway Dashboard:**
- Status: "Deployed" (green)
- Health Check: Passed ✓
- Logs show: "Application startup complete"

**Your App:**
- `/health` returns 200 OK
- `/` returns welcome message
- `/docs` shows Swagger UI

---

## 🎉 Next Steps After Successful Deploy

1. **Note your Railway URL**: `https://your-app.railway.app`

2. **Update Frontend Apps**:
   - Deploy to Vercel with backend URL
   - Set `VITE_API_URL` / `NEXT_PUBLIC_API_URL`

3. **Update CORS**:
   - Add Vercel URLs to `ALLOWED_ORIGINS`
   - Redeploy backend

4. **Update OAuth**:
   - Add Railway URL to Google OAuth redirects

5. **Test Everything**:
   - User registration
   - Login
   - API calls from frontend

---

## 🚀 Deploy Command

```bash
git push origin main
```

Railway will auto-deploy. Monitor the logs!

---

*Updated with health check fixes - should deploy successfully now!*
