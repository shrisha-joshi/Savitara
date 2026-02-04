# 🚀 Savitara Platform - Complete Deployment Guide

## ✅ Your Project is Now Ready for Deployment!

All CI/CD issues have been fixed and deployment configurations are in place.

---

## 📋 What Was Fixed

### 1. GitHub Actions CI/CD Issues ✓
- ✅ Updated all actions to latest versions (v4/v5)
- ✅ Fixed deprecated `upload-artifact@v3` → `v4`
- ✅ Made Slack webhook optional (no longer required)
- ✅ Fixed mobile cache dependencies issue
- ✅ Added missing test/lint scripts to package.json
- ✅ Made all optional secrets truly optional
- ✅ Added proper environment variables for tests

### 2. Deployment Configurations ✓
- ✅ Created `backend/railway.json` for Railway deployment
- ✅ Created `RAILWAY_DEPLOYMENT.md` guide
- ✅ Created `VERCEL_DEPLOYMENT.md` guide
- ✅ Created `check_deployment_ready.py` validation script
- ✅ Created comprehensive `CI_CD_FIXES.md` documentation

---

## 🎯 Deployment Strategy

```
┌─────────────────────────────────────────────────────┐
│                   Savitara Platform                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Backend (FastAPI)           → Railway.app         │
│  ├─ REST API                                       │
│  ├─ WebSocket                                      │
│  ├─ MongoDB Atlas (existing)                       │
│  └─ Redis (Railway provides)                       │
│                                                     │
│  savitara-web (React+Vite)   → Vercel             │
│  └─ User/Acharya interface                        │
│                                                     │
│  admin-savitara-web (Next.js) → Vercel            │
│  └─ Admin dashboard                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📖 Step-by-Step Deployment

### Step 1: Push to GitHub ✓
```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix CI/CD and prepare for production deployment"

# Push to GitHub
git push origin main
```

**Verify:** Go to GitHub → Actions tab → Should see green checkmark ✅

---

### Step 2: Deploy Backend to Railway 🚂

**Read the full guide:** `RAILWAY_DEPLOYMENT.md`

**Quick Steps:**
1. Create account at https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Set **Root Directory** to: `backend`
5. Add environment variables (copy from `.env`)
6. Add Redis database (Railway plugin)
7. Deploy! 🚀

**Result:** Backend URL like `https://savitara-backend.railway.app`

---

### Step 3: Deploy Web Apps to Vercel 🔺

**Read the full guide:** `VERCEL_DEPLOYMENT.md`

#### 3a. Deploy savitara-web
1. Go to https://vercel.com
2. "New Project" → Import your repo
3. Set **Root Directory** to: `savitara-web`
4. Framework: Vite (auto-detected)
5. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.railway.app/api/v1
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_RAZORPAY_KEY_ID=your-razorpay-key
   ```
6. Deploy! 🚀

**Result:** `https://savitara-web.vercel.app`

#### 3b. Deploy admin-savitara-web
1. "New Project" → Import your repo
2. Set **Root Directory** to: `admin-savitara-web`
3. Framework: Next.js (auto-detected)
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
   ```
5. Deploy! 🚀

**Result:** `https://admin-savitara-web.vercel.app`

---

### Step 4: Update CORS and OAuth 🔒

#### Update Backend CORS
In Railway → Environment Variables:
```bash
ALLOWED_ORIGINS=https://savitara-web.vercel.app,https://admin-savitara-web.vercel.app
```

#### Update Google OAuth
Google Cloud Console → Credentials:
```
Authorized redirect URIs:
- https://savitara-web.vercel.app
- https://admin-savitara-web.vercel.app
- https://your-backend.railway.app/api/v1/auth/google/callback
```

#### Update Razorpay Webhook
Razorpay Dashboard → Webhooks:
```
Webhook URL: https://your-backend.railway.app/api/v1/payments/webhook
```

---

### Step 5: Generate Production Secrets 🔐

**Run this to generate secure secrets:**
```bash
python -c "import secrets; print('SECRET_KEY:', secrets.token_urlsafe(32))"
python -c "import secrets; print('JWT_SECRET_KEY:', secrets.token_urlsafe(32))"
python -c "import secrets; print('ADMIN_API_KEY:', secrets.token_urlsafe(32))"
python -c "import secrets; print('ENCRYPTION_KEY:', secrets.token_hex(32))"
```

**Update Railway environment variables with these new secrets!**

---

### Step 6: Test Your Deployment ✅

#### Backend Health Check
```bash
curl https://your-backend.railway.app/health
# Should return: {"status": "healthy"}
```

#### API Documentation
Visit: `https://your-backend.railway.app/docs`
- Should see Swagger UI
- Try authentication endpoints

#### Frontend Testing
1. Visit `https://savitara-web.vercel.app`
   - ✅ Page loads correctly
   - ✅ Can login with Google
   - ✅ API calls work (check Network tab)
   - ✅ No CORS errors in console

2. Visit `https://admin-savitara-web.vercel.app`
   - ✅ Admin dashboard loads
   - ✅ Can authenticate
   - ✅ Can access admin features

---

## 🛠️ Troubleshooting

### Railway Deployment Fails

**Error: "Build failed"**
```bash
# Check requirements.txt exists
ls backend/requirements.txt

# Test locally
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Error: "MongoDB connection failed"**
- Verify `MONGODB_URL` environment variable
- Check MongoDB Atlas allows Railway IPs (0.0.0.0/0)

### Vercel Deployment Fails

**Error: "Build failed"**
```bash
# Test build locally
cd savitara-web
npm install
npm run build
```

**Error: "Environment variables not found"**
- Check all `VITE_*` or `NEXT_PUBLIC_*` variables are set in Vercel dashboard

### CORS Errors

```bash
# Check backend CORS settings
ALLOWED_ORIGINS=https://exact-url.vercel.app

# Must use https:// and exact domain
```

### OAuth Not Working

1. Verify redirect URIs in Google Console match exactly
2. Check `GOOGLE_CLIENT_SECRET` is set in Railway
3. Test OAuth flow: `https://backend.railway.app/api/v1/auth/google`

---

## 📊 Monitoring & Logs

### Railway Logs
```
Railway Dashboard → Your Service → Logs
- Real-time application logs
- Error tracking
- Performance metrics
```

### Vercel Logs
```
Vercel Dashboard → Your Project → Logs
- Function logs
- Build logs
- Edge network logs
```

### Health Checks
Set up uptime monitoring:
- https://uptimerobot.com (free)
- Ping: `https://your-backend.railway.app/health` every 5 minutes

---

## 💰 Cost Estimates

### Railway (Backend)
- **Free Tier:** $5 credit/month (~500 hours)
- **Paid:** ~$5-20/month for production
- Includes: App hosting + Redis

### Vercel (Frontend)
- **Free Tier:** Unlimited deployments
- **Free Tier:** 100GB bandwidth/month
- **Perfect for production at no cost!**

### MongoDB Atlas (Database)
- **Free Tier:** 512MB storage
- **Paid:** ~$9/month for 2GB

**Total estimated cost: $0-30/month**

---

## 🎉 Success Checklist

Before going live, verify:

- [ ] Backend deployed to Railway ✓
- [ ] savitara-web deployed to Vercel ✓
- [ ] admin-savitara-web deployed to Vercel ✓
- [ ] All environment variables set ✓
- [ ] Production secrets generated and set ✓
- [ ] CORS configured correctly ✓
- [ ] Google OAuth redirect URIs updated ✓
- [ ] Razorpay webhook URL updated ✓
- [ ] MongoDB Atlas IP whitelist configured ✓
- [ ] All endpoints tested ✓
- [ ] User registration/login works ✓
- [ ] Booking flow works ✓
- [ ] Payment processing works ✓
- [ ] Admin dashboard accessible ✓
- [ ] WebSocket/chat works ✓

---

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| `RAILWAY_DEPLOYMENT.md` | Complete Railway deployment guide |
| `VERCEL_DEPLOYMENT.md` | Complete Vercel deployment guide |
| `CI_CD_FIXES.md` | All CI/CD fixes explained |
| `check_deployment_ready.py` | Validate deployment readiness |
| `.github/workflows/deploy.yml` | CI/CD configuration |
| `backend/railway.json` | Railway configuration |

---

## 🚀 You're Ready to Deploy!

Run the final check:
```bash
python check_deployment_ready.py
```

Expected output:
```
✓ Your project is ready for deployment!
```

**Now follow the deployment guides above and launch your platform!** 🎊

---

## 💬 Need Help?

If you encounter issues:
1. Check the specific error message
2. Review the troubleshooting section
3. Check Railway/Vercel logs
4. Verify environment variables
5. Test locally first

**Common issues are documented in each deployment guide.**

---

## 🎯 Next Steps After Deployment

1. **Custom Domains** (optional)
   - Add custom domain in Vercel
   - Add custom domain in Railway
   - Update DNS records

2. **SSL/HTTPS** (automatic)
   - Railway provides automatic SSL
   - Vercel provides automatic SSL

3. **Monitoring** (recommended)
   - Set up Sentry for error tracking
   - Configure uptime monitoring
   - Enable Railway metrics

4. **Mobile Apps**
   - Update API URLs in mobile apps
   - Build with EAS (Expo)
   - Publish to Play Store / App Store

5. **Performance**
   - Enable Redis caching
   - Optimize database indexes
   - Configure CDN

---

**Your Savitara platform is deployment-ready! 🎉**

Good luck with your launch! 🚀
