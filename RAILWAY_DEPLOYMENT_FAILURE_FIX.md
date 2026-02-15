# 🚨 RAILWAY DEPLOYMENT FAILURES - FIX GUIDE

## What's Failing
- **prolific-unity - Savitara**: Deployment failed
- **thriving-beauty - Savitara**: Deployment failed

## Most Likely Cause
The deployments are failing because of **one or more of these issues**:

1. ❌ **Old MongoDB credentials** (we just sanitized them)
2. ❌ **Missing `MONGODB_URL` environment variable**
3. ❌ **Wrong Railway root directory**
4. ❌ **MongoDB Atlas not allowing Railway IP addresses**

---

## 🔧 IMMEDIATE FIXES (Do in Order)

### Fix 1: Check Railway Project Configuration

**Both deployments seem to be for the same project. Do you have 2 Railway services?**

Check if you accidentally created multiple Railway services:
1. Go to https://railway.app/
2. Check your projects
3. **You should have ONLY ONE service** for the backend
4. **Delete any duplicate/test services**

### Fix 2: Update MongoDB Credentials in Railway

Since we just sanitized the exposed credentials, Railway still has the **OLD password**:

1. **Go to Railway Dashboard**: https://railway.app/
2. **Select your Savitara backend service**
3. Click **Variables** tab
4. Find `MONGODB_URL` variable
5. Click **Edit**
6. Update with your **NEW MongoDB password** (from MongoDB Atlas)
7. Click **Save**

**Format**:
```
MONGODB_URL=mongodb+srv://sheshagirijoshi18_db_savitara:NEW_PASSWORD_HERE@cluster0.0q2ghgt.mongodb.net/?appName=Cluster0
```

### Fix 3: Verify ALL Required Environment Variables

Railway needs these variables (check if they're all set):

```bash
# Critical (Application won't start without these)
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
JWT_SECRET_KEY=<generate with: openssl rand -base64 32>
SECRET_KEY=<generate with: openssl rand -base64 32>

# CORS (Required for frontend to connect)
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# App Settings
APP_ENV=production
DEBUG=False
API_VERSION=v1

# Google OAuth (for login)
GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://your-app.railway.app/api/v1/auth/google/callback

# Optional (can skip for now)
REDIS_URL=<railway-provides-this-if-you-add-redis-plugin>
RAZORPAY_KEY_ID=<your-razorpay-key>
RAZORPAY_KEY_SECRET=<your-razorpay-secret>
```

### Fix 4: Check Railway Root Directory

1. Railway Dashboard → Your Service → Settings
2. **Root Directory**: Should be `backend`
3. If it's blank or wrong, set it to: `backend`
4. Click **Save**

### Fix 5: Allow Railway IP in MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. Select **Allow Access from Anywhere** (0.0.0.0/0)
5. Click **Confirm**

---

## 🔍 HOW TO VIEW RAILWAY LOGS

To see the EXACT error:

1. Go to Railway Dashboard
2. Click on your service
3. Click **Deployments** tab
4. Click on the failed deployment (red X)
5. Scroll down to see **Build Logs** and **Deploy Logs**

**Common errors you might see**:

### Error: "MONGODB_URL Field required"
**Solution**: Add `MONGODB_URL` to Railway environment variables (Fix 2)

### Error: "Connection timeout" or "Unable to connect to MongoDB"
**Solution**: 
- Check MongoDB password is correct (Fix 2)
- Allow Railway IPs in MongoDB Atlas (Fix 5)

### Error: "Module not found" or "Import error"
**Solution**: 
- Check Root Directory is set to `backend` (Fix 4)
- Rebuild service

### Error: "Port already in use" or "Address in use"
**Solution**: Railway automatically sets `$PORT` - this shouldn't happen

---

## 📋 VERIFICATION STEPS

After making fixes above:

### Step 1: Trigger Redeploy
1. Railway Dashboard → Your Service
2. Click **Deployments** tab
3. Click **⋮** menu on latest deployment
4. Click **Redeploy**

### Step 2: Monitor Build
Watch the logs as it builds:
- ✅ "Building..." → Should complete successfully
- ✅ "Starting application..." → Should show Uvicorn starting
- ✅ "Application startup complete" → Success!

### Step 3: Test Health Endpoint
Once deployed:
```bash
curl https://your-app.railway.app/health
# Should return: {"status": "healthy"}
```

### Step 4: Test API Docs
Visit: `https://your-app.railway.app/docs`
- Should show FastAPI Swagger UI

---

## 🎯 QUICK DIAGNOSTIC CHECKLIST

Run through this checklist:

**Railway Configuration**:
- [ ] Root Directory = `backend`
- [ ] Start Command = `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
- [ ] Build Command = `pip install -r requirements.txt`

**Environment Variables** (All set in Railway):
- [ ] `MONGODB_URL` (with NEW password)
- [ ] `JWT_SECRET_KEY`
- [ ] `SECRET_KEY`
- [ ] `ALLOWED_ORIGINS`
- [ ] `APP_ENV=production`
- [ ] `DEBUG=False`
- [ ] `GOOGLE_CLIENT_ID`

**MongoDB Atlas**:
- [ ] Network Access allows 0.0.0.0/0
- [ ] Database user password is correct
- [ ] Database user has read/write permissions

**GitHub**:
- [ ] Latest code is pushed (with sanitized credentials)
- [ ] No secrets committed to repository

---

## 🔄 IF STILL FAILING

### Option 1: Delete and Recreate Railway Service

If the service is corrupted:
1. Railway Dashboard → Settings → **Delete Service**
2. Create new service from GitHub repo
3. Set Root Directory to `backend`
4. Add all environment variables fresh
5. Deploy

### Option 2: Switch to Render Instead

Railway might be having issues. You can use Render instead:
1. Go to https://render.com/
2. Follow the steps in `READY_TO_DEPLOY.md`
3. Render is more reliable for Python apps

---

## 📊 EXPECTED BUILD OUTPUT (Success)

When it's working, Railway logs should show:

```
[Build] Installing dependencies from requirements.txt
[Build] ✓ Successfully installed packages
[Deploy] Starting application...
[Deploy] INFO:     Started server process
[Deploy] INFO:     Application startup complete.
[Deploy] INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 🆘 SHARE RAILWAY LOGS

If still stuck, do this:

1. Railway Dashboard → Your Service → Deployments
2. Click failed deployment
3. Copy all **Deploy Logs** (especially the red error messages)
4. Share them here

**Look for lines that say**:
- `ERROR:`
- `ValidationError:`
- `Failed:`
- `Exception:`

These will tell us exactly what's wrong!

---

## 💡 MOST COMMON FIX

**90% of Railway failures are due to missing `MONGODB_URL`**. 

Make sure it's set with your **NEW password** (not the old `savitara123` that was exposed).

---

**Current Status**: 🔴 2 Railway deployments failing

**Next Action**: 
1. Check Railway logs for exact error
2. Update `MONGODB_URL` with new password (Fix 2)
3. Verify Root Directory = `backend` (Fix 4)
4. Redeploy
