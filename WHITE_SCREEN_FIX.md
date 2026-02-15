# 🚨 WHITE SCREEN FIX GUIDE (Frontend Deployment)

## What You're Seeing
✅ **Backend Root**: `backend/` folder - This is CORRECT  
✅ **Frontend Root**: `savitara-web/` folder - This is CORRECT  
❌ **Problem**: White screen on deployed frontend

---

## Root Cause of White Screen

### Issue #1: Missing Environment Variables ❌
Vercel needs these environment variables, but they weren't configured:
- `VITE_GOOGLE_CLIENT_ID` - Required for Google OAuth login
- `VITE_API_BASE_URL` - Required to connect to your backend

### Issue #2: Content Security Policy (CSP) Blocking API Calls ❌
The `index.html` had a CSP that only allowed `http://localhost:8000`, blocking `https://*.onrender.com`.

### Issue #3: Build Configuration ❌
Vercel needs to know you're building a Vite app from a subfolder.

---

## ✅ FIXES APPLIED

### Fix 1: Updated `.env.production`
```dotenv
VITE_API_BASE_URL=https://savitara.onrender.com/api/v1
VITE_GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
```

### Fix 2: Updated `index.html` CSP
```html
<!-- Now allows https://*.onrender.com for API connections -->
connect-src 'self' http://localhost:8000 https://*.onrender.com ...
```

### Fix 3: Created Local `.env` File
For local development to work properly.

---

## 🔧 HOW TO FIX ON VERCEL (Step-by-Step)

### Step 1: Configure Vercel Project Settings

#### A. Root Directory
1. Go to Vercel Dashboard → Your Project → Settings → General
2. **Root Directory**: `savitara-web` ✅ (Keep this as-is)
3. Click **Save**

#### B. Build & Output Settings
1. **Framework Preset**: Vite ✅ (Auto-detected)
2. **Build Command**: `npm run build` or `vite build` ✅
3. **Output Directory**: `dist` ✅ (Auto-detected)
4. **Install Command**: `npm install` ✅ (Auto-detected)

### Step 2: Add Environment Variables (THIS IS CRITICAL!)

1. Go to **Settings** → **Environment Variables**
2. Add these variables for **Production** environment:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_API_BASE_URL` | `https://YOUR-BACKEND-APP.onrender.com/api/v1` | Production |
| `VITE_GOOGLE_CLIENT_ID` | `721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com` | Production |

**IMPORTANT**: Replace `YOUR-BACKEND-APP` with your actual Render app name!

Example: If your Render URL is `https://savitara-backend.onrender.com`, then:
```
VITE_API_BASE_URL=https://savitara-backend.onrender.com/api/v1
```

### Step 3: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the **⋮** menu on the latest deployment
3. Click **Redeploy**
4. **Important**: Check "Use existing Build Cache" = OFF (unchecked)
5. Click **Redeploy**

This forces a fresh build with the new environment variables.

---

## 🔍 VERIFICATION STEPS

### After Redeployment:

#### 1. Check Build Logs
- Vercel Dashboard → Your deployment → View Build Logs
- Look for: `✓ built in XXs` (should be green checkmark)
- Should NOT see any `ERROR` lines

#### 2. Check Browser Console
- Open your Vercel URL: `https://YOUR-APP.vercel.app`
- Press `F12` to open DevTools → Console tab
- **If you see**:
  - ❌ `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT` → CSP issue (fixed above)
  - ❌ `Access to XMLHttpRequest blocked by CORS` → Backend CORS issue
  - ❌ `Cannot read property 'clientId' of undefined` → Missing VITE_GOOGLE_CLIENT_ID
  - ✅ No errors → Good to go!

#### 3. Test the App
- Homepage should load with content (not white screen)
- Click "Login" → Google OAuth popup should appear
- Try navigating to different pages

---

## 🐛 TROUBLESHOOTING

### Still Seeing White Screen After Redeployment?

#### Debug Step 1: Check if Environment Variables Are Loaded
Add this temporarily to `src/main.jsx` (line 18):
```javascript
console.log('🔍 Debug Info:')
console.log('API URL:', import.meta.env.VITE_API_BASE_URL)
console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID)
```

Redeploy and check the browser console. If you see `undefined`, the env vars aren't loaded.

**Solution**: Make sure you redeployed AFTER adding the environment variables, and unchecked "Use existing Build Cache".

#### Debug Step 2: Check Network Tab
- Open DevTools → Network tab
- Refresh page
- Look for failed requests (red status codes)
- Common issues:
  - **404 on assets**: Wrong root directory or build output
  - **CORS errors**: Backend not allowing your Vercel domain
  - **CSP errors**: Content Security Policy blocking resources

#### Debug Step 3: Verify Backend CORS
Your backend must allow requests from your Vercel domain:

**File**: `backend/app/core/config.py`
```python
ALLOWED_ORIGINS: Union[List[str], str] = [
    "http://localhost:3000",
    "https://savitara-web.vercel.app",  # Add your Vercel domain
]
```

Or in Render Environment Variables:
```
ALLOWED_ORIGINS=https://savitara-web.vercel.app,https://your-custom-domain.com
```

---

## 📝 CHECKLIST FOR SUCCESSFUL DEPLOYMENT

### Backend (Render)
- [x] Root Directory: `backend` ✅
- [ ] Environment Variable: `MONGODB_URL` set
- [ ] Environment Variable: `JWT_SECRET_KEY` set
- [ ] Environment Variable: `SECRET_KEY` set
- [ ] Environment Variable: `ALLOWED_ORIGINS` includes Vercel URL
- [ ] Backend is running (check `/health` endpoint)

### Frontend (Vercel)
- [x] Root Directory: `savitara-web` ✅
- [ ] Environment Variable: `VITE_API_BASE_URL` set (with YOUR Render URL)
- [ ] Environment Variable: `VITE_GOOGLE_CLIENT_ID` set
- [ ] Framework Preset: Vite ✅
- [ ] Build succeeds (no errors in logs)
- [ ] Homepage loads (not white screen)
- [ ] Google OAuth login works

---

## 🎯 EXPECTED RESULTS AFTER FIX

### What You Should See:
1. **Homepage**: Savitara landing page with hero section, features, testimonials
2. **Login Button**: Should open Google OAuth popup
3. **Console**: No red errors (some warnings are OK)
4. **Network Tab**: All API calls to `https://YOUR-BACKEND.onrender.com` should show `200 OK`

### Common Good Warnings (Ignore These):
- `DevTools failed to load source map` - Normal for production builds
- `Download the React DevTools` - Just an FYI, not an error

---

## 🔗 Quick Links

- **Backend Health Check**: `https://YOUR-BACKEND.onrender.com/health`
- **Backend API Docs**: `https://YOUR-BACKEND.onrender.com/docs`
- **Frontend URL**: `https://YOUR-PROJECT.vercel.app`

---

## 📞 If Still Not Working

1. **Export browser console logs**:
   - F12 → Console → Right-click → "Save as..."
   - Share the logs

2. **Check Vercel deployment logs**:
   - Vercel Dashboard → Deployments → Latest → Build Logs
   - Copy any ERROR messages

3. **Check Render logs**:
   - Render Dashboard → Your service → Logs tab
   - Look for errors when frontend tries to connect

---

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Homepage loads with full content
- ✅ You can see the navigation bar
- ✅ "Login with Google" button is clickable
- ✅ Browser console shows minimal/no errors
- ✅ Network tab shows successful API connections

The root folder configuration (`backend/` and `savitara-web/`) is **perfect** - the issue was just missing environment variables and CSP blocking!
