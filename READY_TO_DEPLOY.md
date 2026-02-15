# Deployment Implementation Guide

Your codebase is fully configured for deployment. Follow these exact steps to go live.

## 1. Push Code to GitHub
Ensure all recent fixes are pushed:
```bash
git add .
git commit -m "Finalizing deployment config"
git push origin main
```

## 2. Backend Deployment (Render.com)
1. **New Web Service** -> Connect GitHub Repo.
2. **Settings**:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `PYTHON_VERSION` | `3.11.4` |
   | `MONGODB_URL` | *(Your actual MongoDB Connection String)* |
   | `JWT_SECRET_KEY` | *(Generate a random strong string)* |
   | `ALLOWED_ORIGINS` | `https://savitara-web.vercel.app,http://localhost:3000` |
   | `DEBUG` | `False` |

   > **Note**: After deployment, copy the **onrender.com URL** for the next step.

## 3. Frontend Deployment (Vercel)
1. **Add New Project** -> Import git repo.
2. **Settings**:
   - **Root Directory**: `savitara-web` (Click "Edit" next to Root Directory)
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
3. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://<YOUR-APP-NAME>.onrender.com/api/v1` |
   | `VITE_GOOGLE_CLIENT_ID` | `721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com` |

   > **Critical**: Replace `<YOUR-APP-NAME>` with the actual URL from Step 2.

## 4. Final Verification
1. Open your Vercel URL.
2. Login (This tests AuthContext and Backend connection).
3. If you see a "Network Error", check that proper `VITE_API_BASE_URL` is set in Vercel.
