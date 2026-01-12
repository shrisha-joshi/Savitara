# Production Deployment Guide

## Pre-Deployment Checklist

### Backend
- [ ] Configure production environment variables
- [ ] Set up production MongoDB (MongoDB Atlas)
- [ ] Set up production Redis (Redis Cloud)
- [ ] Configure Google OAuth (production credentials)
- [ ] Configure Razorpay (live keys)
- [ ] Set up Firebase (production project)
- [ ] Enable HTTPS/SSL
- [ ] Set up domain (api.savitara.com)
- [ ] Configure CORS for production domains
- [ ] Set up logging and monitoring (Sentry, DataDog)
- [ ] Enable rate limiting
- [ ] Run security audit
- [ ] Backup strategy

### Mobile App
- [ ] Create production build configuration
- [ ] Configure production API URLs
- [ ] Set up Google Play Console account
- [ ] Set up Apple Developer account
- [ ] Create app icons and splash screens
- [ ] Prepare app store screenshots
- [ ] Write app store descriptions
- [ ] Set up deep linking
- [ ] Configure push notification certificates
- [ ] Test on physical devices
- [ ] Enable crash reporting (Sentry, Crashlytics)
- [ ] Set up analytics (Firebase Analytics, Mixpanel)

### Admin Dashboard
- [ ] Build for production
- [ ] Configure production API URL
- [ ] Set up hosting (Vercel, Netlify, AWS)
- [ ] Configure custom domain (admin.savitara.com)
- [ ] Enable SSL
- [ ] Set up monitoring
- [ ] Configure CDN
- [ ] Optimize images and assets

## Deployment Steps

### 1. Backend Deployment

#### Option A: AWS EC2/ECS
```bash
# Build Docker image
docker build -t savitara-backend ./backend

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag savitara-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/savitara-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/savitara-backend:latest

# Deploy to ECS
aws ecs update-service --cluster savitara --service backend --force-new-deployment
```

#### Option B: Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/savitara-backend ./backend
gcloud run deploy savitara-backend --image gcr.io/PROJECT_ID/savitara-backend --platform managed
```

#### Option C: Heroku
```bash
cd backend
heroku create savitara-api
git push heroku main
heroku config:set MONGO_URI=<production-uri>
```

### 2. Mobile App Deployment

#### iOS App Store
```bash
cd mobile-app

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

#### Android Play Store
```bash
cd mobile-app

# Build for Android
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### 3. Admin Dashboard Deployment

#### Vercel (Recommended)
```bash
cd admin-web
npm install -g vercel
vercel deploy --prod
```

#### Netlify
```bash
cd admin-web
npm run build
netlify deploy --prod --dir=.next
```

## Post-Deployment

### Monitoring
1. Set up application monitoring:
   - Backend: Sentry, DataDog, New Relic
   - Mobile: Firebase Crashlytics, Sentry
   - Admin: Vercel Analytics, Google Analytics

2. Set up uptime monitoring:
   - UptimeRobot
   - Pingdom
   - StatusCake

3. Set up log aggregation:
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - CloudWatch (AWS)
   - Stackdriver (GCP)

### Backup Strategy
1. Database backups:
   - MongoDB Atlas automated backups
   - Daily manual backups
   - Test restore procedures

2. Code backups:
   - GitHub/GitLab repository
   - Multiple branches (main, staging, dev)

### Security
1. Enable firewall rules
2. Set up DDoS protection (Cloudflare)
3. Enable WAF (Web Application Firewall)
4. Regular security audits
5. Keep dependencies updated
6. Enable 2FA for all admin accounts

### Performance Optimization
1. Enable CDN (Cloudflare, AWS CloudFront)
2. Implement caching strategies
3. Database indexing and optimization
4. Image optimization
5. Code minification and bundling
6. Enable gzip compression

## Rollback Procedure

### Backend
```bash
# Revert to previous version
aws ecs update-service --cluster savitara --service backend --task-definition savitara-backend:PREVIOUS_VERSION
```

### Mobile App
- Cannot rollback app store versions instantly
- Prepare hotfix and expedite review

### Admin Dashboard
```bash
# Vercel rollback
vercel rollback
```

## Support Contacts

- **Backend Issues**: backend-team@savitara.com
- **Mobile Issues**: mobile-team@savitara.com
- **Admin Issues**: admin-team@savitara.com
- **Infrastructure**: devops@savitara.com

## Documentation

- API Documentation: https://api.savitara.com/docs
- User Guide: https://docs.savitara.com
- Developer Portal: https://developers.savitara.com
