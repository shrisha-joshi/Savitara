# Railway Deployment Guide for Savitara Backend

## Quick Setup

1. **Push Your Code to GitHub**
   - Ensure your backend code is in a GitHub repository
   - Make sure `.env` is in `.gitignore`

2. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

3. **Deploy Backend to Railway**
   
   ### Step 1: Create New Project
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your Savitara repository
   - Railway will auto-detect the backend

   ### Step 2: Configure Root Directory
   - In project settings, set **Root Directory** to: `backend`
   - This tells Railway to deploy only the backend folder

   ### Step 3: Set Environment Variables
   Go to your project → Variables tab and add these:

   ```bash
   # Application
   APP_NAME=Savitara
   APP_ENV=production
   DEBUG=False
   API_VERSION=v1

   # Security - GENERATE NEW SECRETS FOR PRODUCTION
   SECRET_KEY=<generate-a-strong-random-32-char-secret>
   JWT_SECRET_KEY=<generate-a-strong-random-32-char-jwt-secret>
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   REFRESH_TOKEN_EXPIRE_DAYS=7

   # CORS - Add your frontend URLs
   ALLOWED_ORIGINS=https://your-savitara-web.vercel.app,https://your-admin-web.vercel.app

   # MongoDB Atlas (use your existing connection)
   MONGODB_URL=mongodb+srv://sheshagirijoshi18_db_savitara:savitara123@cluster0.0q2ghgt.mongodb.net/?appName=Cluster0
   MONGODB_DB_NAME=savitara
   MONGODB_MIN_POOL_SIZE=10
   MONGODB_MAX_POOL_SIZE=100

   # Redis - Use Railway Redis Plugin
   REDIS_URL=${{Redis.REDIS_URL}}
   CACHE_TTL=300

   # Google OAuth
   GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/api/v1/auth/google/callback

   # Razorpay (use production keys)
   RAZORPAY_KEY_ID=<your-razorpay-key>
   RAZORPAY_KEY_SECRET=<your-razorpay-secret>
   RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>

   # Firebase (optional)
   FIREBASE_PROJECT_ID=savitara-90a1c
   FIREBASE_PRIVATE_KEY_ID=<your-key-id>
   FIREBASE_PRIVATE_KEY=<your-private-key>
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@savitara-90a1c.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=<your-client-id>

   # Features
   ENABLE_ENCRYPTION=True
   ENABLE_AUDIT_LOGGING=True
   ENABLE_COMPRESSION=True
   ENABLE_RATE_LIMITING=True
   ENABLE_WEBSOCKETS=True
   ENABLE_ELASTICSEARCH=False

   # Production Settings
   TEST_MODE=False
   SKIP_OTP_VERIFICATION=False

   # Business Settings
   PLATFORM_FEE_PERCENTAGE=10.0
   ACHARYA_COMMISSION_PERCENTAGE=85.0
   MIN_BOOKING_AMOUNT=500.0
   MAX_BOOKING_AMOUNT=100000.0
   REFERRAL_CREDITS=50.0

   # Admin
   ADMIN_API_KEY=<generate-a-strong-admin-key>
   ```

   ### Step 4: Add Redis Service
   - In your Railway project, click "+ New"
   - Select "Database" → "Add Redis"
   - Railway will automatically create `REDIS_URL` variable

   ### Step 5: Deploy
   - Railway will automatically deploy on every push to main branch
   - Check deployment logs for any errors
   - Once deployed, you'll get a public URL like: `https://savitara-backend.railway.app`

4. **Update Frontend Configuration**
   - Update API URLs in your frontend apps to point to Railway backend URL
   - Update CORS settings in backend to include your Vercel frontend URLs

5. **Test Your Deployment**
   - Visit: `https://your-backend.railway.app/docs`
   - You should see the Swagger API documentation
   - Test authentication and key endpoints

## Important Security Notes

⚠️ **NEVER commit these to git:**
- `.env` file with secrets
- Production API keys
- Database passwords
- JWT secrets

✅ **Generate new secrets for production:**
```python
# Run this to generate secure secrets
import secrets
print("SECRET_KEY:", secrets.token_urlsafe(32))
print("JWT_SECRET_KEY:", secrets.token_urlsafe(32))
print("ADMIN_API_KEY:", secrets.token_urlsafe(32))
```

## Troubleshooting

### Build Fails
- Check Railway logs for specific error
- Ensure `requirements.txt` has all dependencies
- Verify Python version compatibility

### App Crashes on Start
- Check environment variables are set correctly
- Verify MongoDB connection string
- Check Redis is provisioned and connected

### CORS Errors
- Update `ALLOWED_ORIGINS` to include your frontend URLs
- Must use exact URLs (include https://)

## Monitoring

Railway provides:
- Real-time logs
- Metrics (CPU, Memory, Network)
- Deployment history
- Automatic restarts on failure

## Custom Domain (Optional)

1. Go to Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update CORS and OAuth redirect URIs

## Cost Estimate

Railway Free Tier:
- $5 free credit per month
- ~500 hours of runtime
- Perfect for development/testing

Production Plan:
- Pay-as-you-go: ~$5-20/month for small apps
- Includes: 8GB RAM, unlimited bandwidth

## Next Steps

After Railway deployment:
1. Deploy frontends to Vercel
2. Update all API URLs in frontend code
3. Test end-to-end user flows
4. Set up monitoring and alerts
5. Configure custom domains
