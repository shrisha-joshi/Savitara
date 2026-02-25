# 🚨 CRITICAL DEPLOYMENT FIX GUIDE

**Last Updated:** February 26, 2026  
**Issue:** Login/Signup not working on hosted pages

---

## 🔴 Root Causes Identified

### 1. ❌ Backend Syntax Error (FIXED IN CODE)
- **File:** `backend/app/api/v1/bookings.py` line 540
- **Issue:** Missing `@router.put(` decorator
- **Status:** ✅ Fixed in codebase - needs redeploy

### 2. ❌ Wrong Backend URL in Frontends (FIXED IN CODE)
- **Savitara Web:** Was pointing to `savitara.onrender.com` instead of `savitara-backend.onrender.com`
- **Admin Web:** Same issue
- **Status:** ✅ Fixed in `.env.production` files - needs redeploy

### 3. ❌ CORS Blocking Requests (NEEDS ENV UPDATE)
- **Issue:** Vercel deployment URL not in backend's `ALLOWED_ORIGINS`
- **Your Vercel URL:** `https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app`
- **Status:** ⚠️ Needs backend environment variable update

### 4. ❌ Google OAuth Misconfiguration (NEEDS GOOGLE CLOUD CONSOLE UPDATE)
- **Issue:** Authorized redirect URIs in Google Cloud Console don't include Vercel URLs
- **Status:** ⚠️ Needs Google Cloud Console update

---

## 📋 STEP-BY-STEP FIX (Follow in Order)

### Step 1: Update Backend Environment Variables (Render)

Go to **Render Dashboard** → Your Backend Service → **Environment** tab:

```bash
# Add/Update these variables:

# ━━━ CORS Configuration ━━━
ALLOWED_ORIGINS=https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app,https://savitara-backend.onrender.com,http://localhost:3000,http://localhost:3001

# ━━━ Environment ━━━
APP_ENV=production
DEBUG=False

# ━━━ Google OAuth (Update redirect URI) ━━━
GOOGLE_REDIRECT_URI=https://savitara-backend.onrender.com/api/v1/auth/google/callback

# ━━━ MongoDB (Use your Atlas connection string) ━━━
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/savitara?retryWrites=true&w=majority

# ━━━ Redis (If using external Redis) ━━━
REDIS_URL=redis://:password@hostname:port/0

# ━━━ Secrets (Generate new ones - see below) ━━━
SECRET_KEY=<paste-64-char-random-string-here>
JWT_SECRET_KEY=<paste-different-64-char-random-string-here>

# ━━━ Razorpay (Use LIVE keys for production) ━━━
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
RAZORPAY_KEY_SECRET=your_live_secret_here
```

**Generate Secrets:**
```bash
# Run in PowerShell on your local machine:
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
```

**After updating:** Click **"Save Changes"** → Render will auto-redeploy.

---

### Step 2: Update Vercel Environment Variables (Savitara Web)

Go to **Vercel Dashboard** → Your **savitara-web** Project → **Settings** → **Environment Variables**:

```bash
# Add these for Production:

VITE_API_BASE_URL=https://savitara-backend.onrender.com/api/v1
VITE_GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com

# Make sure to select "Production" in the environment dropdown!
```

**After updating:** Go to **Deployments** tab → Click **"Redeploy"** on latest deployment.

---

### Step 3: Update Vercel Environment Variables (Admin Web)

If you have a separate admin web deployment:

```bash
NEXT_PUBLIC_API_BASE_URL=https://savitara-backend.onrender.com/api/v1
```

---

### Step 4: Update Google Cloud Console (OAuth)

Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**:

**Find your OAuth 2.0 Client ID:** `721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv`

**Add Authorized JavaScript Origins:**
```
https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app
https://savitara-backend.onrender.com
```

**Add Authorized Redirect URIs:**
```
https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app/auth/callback
https://savitara-backend.onrender.com/api/v1/auth/google/callback
```

**Note:** If you get a custom domain from Vercel later (e.g., `savitara.com`), add those URLs too.

---

### Step 5: Commit & Push Code Fixes

```bash
# From d:\Savitara directory:
git add backend/app/api/v1/bookings.py
git add savitara-web/.env.production
git add admin-savitara-web/.env.production
git commit -m "fix: Correct backend URL and syntax error in bookings.py"
git push origin main
```

This will trigger:
- ✅ Render backend redeploy
- ✅ Vercel frontend redeploy

---

## 🧪 Testing Checklist (After All Steps Complete)

### Test 1: Backend Health Check
```bash
curl https://savitara-backend.onrender.com/health
# Expected: {"status": "healthy"}
```

### Test 2: CORS Preflight
```bash
curl -i https://savitara-backend.onrender.com/api/v1/content/testimonials \
  -H "Origin: https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app"

# Look for these headers in response:
# Access-Control-Allow-Origin: https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app
# Access-Control-Allow-Credentials: true
```

### Test 3: Frontend Loading
1. Open: `https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app`
2. Open browser DevTools (F12) → Console tab
3. **Should NOT see:**
   - ❌ CORS errors
   - ❌ `net::ERR_FAILED`
   - ❌ `No 'Access-Control-Allow-Origin' header`

### Test 4: Login Flow
1. Click **"Login with Google"**
2. Should redirect to Google OAuth consent screen
3. After selecting account, should redirect back to your app
4. **Check Console for errors** - should see successful API calls

---

## 🔧 If Login Still Fails After Steps 1-5

### Check Browser Console (F12 → Console)

**Error: "CORS policy: No 'Access-Control-Allow-Origin'"**
→ Backend `ALLOWED_ORIGINS` not updated correctly. Double-check Render environment variables.

**Error: "redirect_uri_mismatch"**
→ Google OAuth redirect URIs not updated. Check Google Cloud Console.

**Error: "Network Error" or "ERR_CONNECTION_REFUSED"**
→ Backend crashed. Check Render logs for Python errors.

**Error: "Failed to load resource: 404"**
→ Wrong API URL. Clear browser cache (Ctrl+Shift+Delete) and refresh.

---

## 📊 Expected Deployment Status After Fix

| Service | URL | Status |
|---------|-----|--------|
| Backend API | `https://savitara-backend.onrender.com` | ✅ Running |
| Frontend Web | `https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app` | ✅ Running |
| Admin Web | (Your Vercel admin URL) | ✅ Running |

---

## 🚀 Post-Deployment: Custom Domain Setup (Optional)

If you want cleaner URLs like `savitara.com`:

### 1. Buy Domain (Namecheap/GoDaddy)
- Example: `savitara.com`

### 2. Add to Vercel
- Vercel Dashboard → Domains → Add `savitara.com` and `www.savitara.com`
- Point DNS to Vercel nameservers

### 3. Update All Environment Variables
Replace all instances of:
- ❌ `savitara-2t7r431uo-shrisha-joshis-projects.vercel.app`
- ✅ `savitara.com`

In:
- Backend `ALLOWED_ORIGINS`
- Google OAuth authorized origins/redirects
- Frontend env vars (if you hardcode any URLs)

---

## 📞 Support Checklist

If you're still stuck after following all steps:

1. **Share Render backend logs:**
   - Render Dashboard → Your Service → Logs tab
   - Copy last 50 lines after deploy

2. **Share browser console errors:**
   - F12 → Console tab
   - Screenshot all red errors

3. **Verify environment variables:**
   ```bash
   # Backend .env check (in Render dashboard env tab):
   - ALLOWED_ORIGINS includes your Vercel URL? ✓ / ✗
   - MONGODB_URL correct? ✓ / ✗
   - SECRET_KEY not default? ✓ / ✗
   ```

---

## 🎯 Quick Reference: All URLs You Need

```bash
# BACKEND
Render URL:     https://savitara-backend.onrender.com
Health Check:   https://savitara-backend.onrender.com/health
API Docs:       https://savitara-backend.onrender.com/api/docs (if DEBUG=True)

# FRONTEND
Vercel URL:     https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app
Login Page:     https://savitara-2t7r431uo-shrisha-joshis-projects.vercel.app/login

# GOOGLE OAUTH
Client ID:      721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv
Console:        https://console.cloud.google.com/apis/credentials
```

---

**✅ After completing Steps 1-5, everything should work correctly!**
