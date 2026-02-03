# Gamification System - Deployment & Testing Guide

## Quick Start

This guide helps you deploy and test the complete gamification system (coins, loyalty, vouchers, coupons, referrals, milestones).

---

## Step 1: Seed Initial Data

### Run the Seeding Script

```bash
# Navigate to backend directory
cd backend

# Ensure virtual environment is activated
source venv/bin/activate  # Windows: venv\Scripts\activate

# Run the seeding script
python scripts/seed_gamification_data.py
```

**Expected Output:**
```
✅ Found 0 existing coupons. Creating 12 default coupons...
✅ Created 12 coupons: FIRST50, WELCOME100, NEWUSER, GANESH50, GRIHAPRAVES, SATYANARAYAN, NAVGRAHA40, REFER500, FRIENDBONUS, EARLYBIRD, WEEKEND20, FESTIVE50

✅ Found 0 existing vouchers. Creating 6 default vouchers...
✅ Created 6 vouchers: NEXT20, POOJA50, REPEAT15, FESTIVAL25, BOOST10, PREMIUM7

🎉 Gamification data seeded successfully!
```

---

## Step 2: Import Postman Collection

### Import the Collection

1. Open Postman
2. Click **Import** button
3. Select file: `postman/Savitara_Gamification_API.postman_collection.json`
4. Collection will be imported with 25+ endpoints

### Configure Environment Variables

Create a new environment with these variables:

- `base_url`: `http://localhost:8000`
- `auth_token`: Your JWT access token (get from login endpoint)
- `admin_token`: Admin user JWT token

### Test Endpoints

**Authentication Flow:**
1. Register/Login → Get `access_token`
2. Copy token to `auth_token` variable
3. Test endpoints in order:
   - Coins → Balance → Award → Redeem
   - Loyalty → Status → Tiers
   - Vouchers → My Vouchers → Claim
   - Coupons → Available → Validate
   - Pricing → Calculate with coupons/coins
   - Referrals → My Code → Leaderboard
   - Milestones → My Milestones

---

## Step 3: Test Admin Panel

### Voucher Management

1. Start admin web: `cd admin-savitara-web && npm run dev`
2. Navigate to: http://localhost:3001/voucher-management
3. **Test Create:**
   - Click "Create Voucher"
   - Fill form with test data
   - Submit and verify in table
4. **Test Filters:**
   - Use category dropdown
   - Search by code
5. **Test Edit/Delete:**
   - Click edit icon on any voucher
   - Modify fields and save
   - Delete a test voucher

### Coupon Management

1. Navigate to: http://localhost:3001/coupon-management
2. **Test Tabs:**
   - Active Coupons
   - Inactive
   - First Booking Only
   - All Coupons
3. **Test Create:**
   - Click "Create Coupon"
   - Configure discount type (percentage/fixed)
   - Set applicability rules
   - Test validation (min amount, dates, limits)
4. **View Seeded Coupons:**
   - All 12 default coupons should appear
   - Verify FIRST50, WELCOME100, etc.

---

## Step 4: Test Booking Flow Integration

### PricingDisplay Component

1. Start web app: `cd savitara-web && npm run dev`
2. Navigate to: Create Booking → Step 3 (Confirmation)
3. **Test Features:**
   - See base amount
   - Apply coupon code (try FIRST50)
   - Toggle coin usage
   - Verify discount calculation
   - Check final amount updates
   - See coins to earn

### Expected Behavior

- Base amount displayed correctly
- Coupon dropdown shows available coupons
- Applying FIRST50 gives 50% off (max ₹200)
- Coin toggle calculates discount (10 coins = ₹1)
- Final amount = Base - Coupon Discount - Coin Discount
- Coins earned = 2% of final amount

---

## Step 5: Test Profile Integration

### GamificationDashboard Component

1. In web app, go to: Profile page
2. Scroll to bottom → Gamification Dashboard
3. **Verify Sections:**
   - **Coins Widget:**
     - Balance displayed
     - Recent transactions
     - Award/Redeem buttons
   - **Loyalty Widget:**
     - Current tier (Bronze/Silver/Gold/Platinum)
     - Points and progress bar
     - Tier benefits
   - **Vouchers Widget:**
     - Active vouchers count
     - Quick claim button
     - Expiry dates
   - **Referral Widget:**
     - Your referral code
     - Stats (referrals, earnings)
     - Share button
   - **Milestones Widget:**
     - Progress on achievements
     - Completed vs total
     - Reward preview

---

## Step 6: Test Mobile App

### PricingDisplay (React Native)

1. Start mobile app: `cd savitara-app && npx expo start`
2. Navigate to: Create Booking flow
3. **Test on Step 3 (Confirmation):**
   - PricingDisplay component renders
   - Touch interactions work
   - Coupon input and apply
   - Coin toggle functional
   - Real-time price calculation

### RewardsScreen

1. Navigate to: Profile → Rewards tab
2. **Test Tabs:**
   - Overview (summary cards)
   - Coins (balance + transactions)
   - Vouchers (active list)
   - Referrals (code + stats)
   - Milestones (progress bars)
3. **Test Pull-to-Refresh:**
   - Pull down to refresh all data
   - Verify loading indicator
4. **Test Interactions:**
   - Tap voucher to see details
   - Copy referral code
   - View milestone progress

---

## Step 7: End-to-End Testing

### Complete Booking Flow

1. **Login as Grihasta**
2. **Search for Acharya**
3. **Create Booking:**
   - Select service
   - Choose date/time
   - Proceed to confirmation
4. **Apply Gamification:**
   - Apply FIRST50 coupon (50% off)
   - Toggle coins (use 100 coins for ₹10 off)
   - Verify final price
5. **Complete Payment:**
   - Confirm booking
   - Check wallet balance updated
   - Verify coins earned (2% of final amount)

### Verify Backend

```bash
# Check coins awarded
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/gamification/coins/balance

# Check loyalty points
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/gamification/loyalty/status

# Check milestones progress
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/gamification/milestones/my-milestones
```

---

## Step 8: Admin Analytics

### View Statistics

1. Admin panel → Dashboard
2. Navigate to: Gamification Analytics
3. **Check Metrics:**
   - Total coins in circulation
   - Active vouchers
   - Coupon usage rates
   - Referral conversion
   - Milestone completion rates

### Postman Admin Endpoints

Use Postman with `admin_token`:

- `GET /api/v1/admin/gamification/analytics`
- `POST /api/v1/admin/vouchers/create`
- `POST /api/v1/admin/coupons/create`

---

## Troubleshooting

### Coupon Not Applying

**Issue:** Coupon code shows as invalid

**Solutions:**
- Check coupon is active (`is_active: true`)
- Verify minimum booking amount met
- Check validity dates (valid_from/valid_until)
- Ensure usage limit not exceeded
- Check user-specific limit

**Debug:**
```bash
curl -X POST http://localhost:8000/api/v1/gamification/coupons/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "FIRST50", "booking_amount": 1000}'
```

### Coins Not Deducting

**Issue:** Coin balance not updating after redemption

**Solutions:**
- Check minimum 10 coins available
- Verify booking amount >= ₹100
- Ensure 30% limit (max 30% of booking can be coins)
- Check API response for errors

**Debug:**
```bash
# Check balance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/gamification/coins/balance

# Try manual redemption
curl -X POST http://localhost:8000/api/v1/gamification/coins/redeem \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coins": 100, "booking_id": "test"}'
```

### Vouchers Not Appearing

**Issue:** User has no vouchers in "My Vouchers"

**Solutions:**
- Vouchers must be claimed first (call `/claim` endpoint)
- Check voucher quantity available
- Verify user role matches voucher category
- Check expiry dates

**Claim Voucher:**
```bash
curl -X POST http://localhost:8000/api/v1/gamification/vouchers/claim/NEXT20 \
  -H "Authorization: Bearer $TOKEN"
```

### Referral Code Not Working

**Issue:** Referral code not generating rewards

**Solutions:**
- Ensure referee uses code during registration
- Check referee completes first booking
- Verify referrer and referee are different users
- Check REFER500 coupon is active

### Mobile Components Not Rendering

**Issue:** PricingDisplay or RewardsScreen blank

**Solutions:**
- Check `react-native-paper` installed: `npm install react-native-paper`
- Verify API service configured correctly
- Check auth token in AsyncStorage
- Review console for errors

---

## Testing Checklist

### Backend APIs ✅
- [ ] Coins: balance, award, redeem, transactions
- [ ] Loyalty: status, tiers, award points
- [ ] Vouchers: my-vouchers, claim
- [ ] Coupons: available, validate
- [ ] Pricing: calculate with coupons + coins
- [ ] Referrals: my-code, create, leaderboard
- [ ] Milestones: my-milestones, available
- [ ] Admin: create voucher/coupon, analytics

### Admin Panel ✅
- [ ] Voucher management page loads
- [ ] Create voucher form works
- [ ] Voucher table displays all
- [ ] Edit/delete vouchers
- [ ] Coupon management page loads
- [ ] Create coupon with all fields
- [ ] Tab filtering works
- [ ] View seeded coupons

### Web Integration ✅
- [ ] PricingDisplay in booking flow
- [ ] Coupon code applies
- [ ] Coin toggle works
- [ ] Price updates dynamically
- [ ] GamificationDashboard in profile
- [ ] All dashboard widgets render
- [ ] Real-time data updates

### Mobile App ✅
- [ ] PricingDisplay renders correctly
- [ ] Touch interactions work
- [ ] RewardsScreen loads
- [ ] Tab navigation functional
- [ ] Pull-to-refresh works
- [ ] Voucher list displays
- [ ] Referral code copyable

### End-to-End ✅
- [ ] Complete booking with coupon
- [ ] Complete booking with coins
- [ ] Coins awarded after booking
- [ ] Loyalty points updated
- [ ] Milestone progress tracked
- [ ] Referral rewards processed
- [ ] Admin can view analytics

---

## Next Steps

1. **Production Deployment:**
   - Update environment variables
   - Configure production MongoDB
   - Set up Redis for caching
   - Deploy admin panel separately

2. **Marketing Setup:**
   - Create campaign-specific coupons
   - Configure seasonal vouchers
   - Set up referral incentives
   - Design milestone rewards

3. **Monitoring:**
   - Track coupon usage rates
   - Monitor coin circulation
   - Analyze referral conversions
   - Measure loyalty engagement

4. **A/B Testing:**
   - Test different discount amounts
   - Vary coin earning rates
   - Experiment with milestone targets
   - Optimize loyalty tier benefits

---

## Support

For issues or questions:
- Check logs: `backend/logs/app.log`
- Review API docs: http://localhost:8000/docs
- Test with Postman collection
- Verify MongoDB collections: `coupons`, `vouchers`, `user_coins`, `user_loyalty`, `referrals`, `milestones`

**Gamification System Ready! 🎉**
