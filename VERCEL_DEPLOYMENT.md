# Vercel Deployment Guide - Savitara Web Apps

## Deploy savitara-web (React + Vite)

### Step 1: Prepare the Project

1. **Create environment file for production**
   ```bash
   cd savitara-web
   ```

2. **Create `.env.production` file:**
   ```bash
   VITE_API_URL=https://your-backend.railway.app/api/v1
   VITE_GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
   VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
   ```

### Step 2: Deploy to Vercel

1. **Push to GitHub**
   - Ensure your code is in a GitHub repository

2. **Import to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Select root directory: `savitara-web`

3. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Add Environment Variables**
   In Vercel dashboard → Settings → Environment Variables:
   ```
   VITE_API_URL = https://your-backend.railway.app/api/v1
   VITE_GOOGLE_CLIENT_ID = your-google-client-id
   VITE_RAZORPAY_KEY_ID = your-razorpay-key
   ```

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - You'll get a URL like: `https://savitara-web.vercel.app`

---

## Deploy admin-savitara-web (Next.js)

### Step 1: Prepare the Project

1. **Create environment file for production**
   ```bash
   cd admin-savitara-web
   ```

2. **Create `.env.production` file:**
   ```bash
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
   ```

### Step 2: Deploy to Vercel

1. **Import to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Select root directory: `admin-savitara-web`

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Add Environment Variables**
   In Vercel dashboard → Settings → Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend.railway.app/api/v1
   NEXT_PUBLIC_GOOGLE_CLIENT_ID = your-google-client-id
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - You'll get a URL like: `https://admin-savitara-web.vercel.app`

---

## Post-Deployment Configuration

### 1. Update Backend CORS

Update your Railway backend environment variables:
```bash
ALLOWED_ORIGINS=https://savitara-web.vercel.app,https://admin-savitara-web.vercel.app
```

### 2. Update Google OAuth

1. Go to Google Cloud Console
2. Add authorized redirect URIs:
   - `https://savitara-web.vercel.app`
   - `https://admin-savitara-web.vercel.app`
   - `https://your-backend.railway.app/api/v1/auth/google/callback`

### 3. Update Razorpay Webhook

1. Go to Razorpay Dashboard
2. Add webhook URL: `https://your-backend.railway.app/api/v1/payments/webhook`

### 4. Test the Deployment

Visit your deployed URLs and test:
- ✅ Homepage loads correctly
- ✅ Can login with Google OAuth
- ✅ API calls work (check Network tab)
- ✅ No CORS errors in console

---

## Troubleshooting

### Build Fails on Vercel

**Error: "Module not found"**
- Solution: Run `npm install` locally and commit `package-lock.json`

**Error: "Environment variable not defined"**
- Solution: Add all `VITE_*` or `NEXT_PUBLIC_*` variables in Vercel dashboard

### Runtime Errors

**CORS Error**
- Check `ALLOWED_ORIGINS` in backend includes exact Vercel URLs
- Must include `https://` protocol

**API Calls Fail**
- Verify `VITE_API_URL` / `NEXT_PUBLIC_API_URL` points to Railway backend
- Check backend is running on Railway

**OAuth Doesn't Work**
- Add Vercel URLs to Google OAuth authorized URIs
- Update `GOOGLE_REDIRECT_URI` in backend

---

## Automatic Deployments

Vercel automatically deploys when you:
- Push to main branch (production)
- Create pull request (preview deployment)

To disable auto-deployment:
- Go to Project Settings → Git → Uncheck "Production Branch"

---

## Custom Domains (Optional)

### Add Custom Domain to Vercel

1. Go to Project Settings → Domains
2. Add your domain (e.g., `app.savitara.com`)
3. Update DNS records:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

4. Update environment variables and OAuth redirects with new domain

---

## Monitoring

Vercel provides:
- Real-time function logs
- Performance analytics
- Error tracking
- Build history

Access via: Project → Analytics / Logs

---

## Cost

Vercel Free Tier includes:
- Unlimited deployments
- 100GB bandwidth/month
- Automatic HTTPS
- Perfect for production apps!

---

## Summary Checklist

- [ ] Backend deployed to Railway
- [ ] savitara-web deployed to Vercel
- [ ] admin-savitara-web deployed to Vercel
- [ ] Environment variables set in all platforms
- [ ] CORS updated in backend
- [ ] Google OAuth redirect URIs updated
- [ ] Razorpay webhook URL updated
- [ ] All apps tested end-to-end
- [ ] Custom domains configured (optional)

Your Savitara platform is now live! 🚀
