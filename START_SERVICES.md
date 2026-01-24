# Quick Start Guide - Savitara Platform
**Updated:** January 24, 2026

## 🚀 Starting the Application

### Prerequisites Check
```powershell
# Check MongoDB status
Get-Service MongoDB

# Check Node.js
node --version

# Check Python
python --version
```

### 1. Start MongoDB
**Option A: Windows Service (Requires Admin)**
```powershell
# Open PowerShell as Administrator
net start MongoDB
```

**Option B: Manual Start**
```powershell
cd "C:\Program Files\MongoDB\Server\8.2\bin"
.\mongod.exe --dbpath "C:\data\db"
```

**Option C: MongoDB Atlas (Cloud)**
```bash
# Update backend/.env with MongoDB Atlas connection string
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/savitara
```

---

### 2. Start Backend API
```powershell
cd d:\SAVI\Savitara\backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

**Verify Backend:**
- Open: http://localhost:8000/docs (API documentation)
- Open: http://localhost:8000/health (Health check)

---

### 3. Start Frontend
```powershell
cd d:\SAVI\Savitara\savitara-web
npm run dev
```

**Expected Output:**
```
VITE v5.4.21  ready in 431 ms
➜  Local:   http://localhost:3000/
```

**Verify Frontend:**
- Open: http://localhost:3000
- Should see Savitara login page

---

## 🔥 Quick Testing

### Test Firebase Google Sign-In
1. Go to http://localhost:3000/login
2. Click "Sign in with Google"
3. Select Google account
4. Should redirect to onboarding (new user) or dashboard (returning user)

### Test Email Registration
1. Go to http://localhost:3000/login
2. Click "Register" tab
3. Enter email, password, select role (Grihasta)
4. Should create account and redirect to onboarding

### Test Email Login
1. Go to http://localhost:3000/login
2. Enter registered email/password
3. Should login and redirect based on onboarding status

---

## ⚠️ Common Issues

### MongoDB Won't Start
**Error:** `Access is denied` or `Service not found`

**Solution:**
```powershell
# Check if MongoDB service exists
Get-Service MongoDB

# If not found, start manually:
cd "C:\Program Files\MongoDB\Server\8.2\bin"
.\mongod.exe --dbpath "C:\data\db" --logpath "C:\data\log\mongod.log"
```

---

### Backend Import Errors
**Error:** `ModuleNotFoundError: No module named 'slowapi'`

**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

---

### Frontend Vite Errors
**Error:** `Cannot find module 'firebase'`

**Solution:**
```bash
cd savitara-web
npm install
```

---

### Firebase Environment Variables
**Error:** `Missing VITE_FIREBASE_API_KEY environment variable`

**Solution:**
Create/update `savitara-web/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=AIzaSyABhtSIIz-mjMqArISDtnUAsPsv9eYD2c8
VITE_FIREBASE_AUTH_DOMAIN=savitara-90a1c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=savitara-90a1c
VITE_FIREBASE_STORAGE_BUCKET=savitara-90a1c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=397566787449
VITE_FIREBASE_APP_ID=1:397566787449:web:eb5fca6f1b7a0272dc79a8
```

---

## 🎯 All Services Running Checklist

- [ ] MongoDB running (check with `Get-Service MongoDB` or `mongod --version`)
- [ ] Backend API running on port 8000
- [ ] Frontend dev server running on port 3000
- [ ] Can access http://localhost:8000/docs
- [ ] Can access http://localhost:3000
- [ ] Firebase Google Sign-In works
- [ ] Email login/registration works

---

## 🔧 Development Tips

### Auto-Restart Backend on Code Changes
Backend uses `--reload` flag - automatically restarts when Python files change.

### Hot Module Reload (HMR) Frontend
Vite automatically reloads when React files change - no manual refresh needed.

### View Backend Logs
```powershell
# Backend terminal shows all API requests
# Look for INFO/ERROR/WARNING messages
```

### View Frontend Logs
- Open browser DevTools (F12)
- Check Console tab for logs
- Network tab shows API calls

---

## 📊 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React web application |
| Backend API | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Interactive API documentation |
| Health Check | http://localhost:8000/health | Service health status |

---

## 🚀 Production Deployment

For production deployment, see:
- `DEPLOYMENT.md` - Full deployment guide
- `docker-compose.yml` - Container orchestration
- `PHASE_2_COMPLETION_REPORT.md` - Latest changes and requirements

---

## 💡 Pro Tips

1. **Keep terminals open:** Each service needs its own terminal window
2. **Check logs first:** Most issues show clear error messages in logs
3. **Restart services:** After code changes, restart backend/frontend
4. **Clear browser cache:** If frontend acts weird, clear cache or use incognito
5. **Check environment files:** Many issues are missing/incorrect env variables

---

## 🆘 Need Help?

1. Check backend terminal for Python errors
2. Check frontend terminal for build errors
3. Check browser console (F12) for JavaScript errors
4. Review API calls in Network tab (F12)
5. Check `PHASE_2_COMPLETION_REPORT.md` for recent changes
6. Review `API_TESTING_GUIDE.md` for testing endpoints

---

**Last Updated:** Phase 2 Completion - January 24, 2026  
**Status:** ✅ All core features working  
**Known Issues:** Redis not deployed (requires Docker), MongoDB requires admin privileges
