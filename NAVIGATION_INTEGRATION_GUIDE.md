# Navigation & Routing Integration Guide

## Overview
This guide shows exactly how to integrate the newly created features into your app navigation and routing.

---

## 1. Mobile App Navigation (savitara-app)

### File: `savitara-app/src/navigation/AppNavigator.js`

Add these screens to your navigator:

```javascript
import LanguageSelectorScreen from '../screens/auth/LanguageSelectorScreen'
import WalletScreen from '../screens/common/WalletScreen'

// In your Auth Stack (after login/signup, before onboarding):
<Stack.Screen 
  name="LanguageSelect" 
  component={LanguageSelectorScreen}
  options={{ headerShown: false }}
/>

// In your Main Tab Navigator or Stack:
<Tab.Screen
  name="Wallet"
  component={WalletScreen}
  options={{
    tabBarLabel: 'Wallet',
    tabBarIcon: ({ color, size }) => (
      <Icon name="wallet" size={size} color={color} />
    ),
  }}
/>
```

### Auth Flow Logic Update:

```javascript
// After successful login/signup:
const handleAuthSuccess = async (userData) => {
  if (!userData.language_preference) {
    // Redirect to language selection
    navigation.navigate('LanguageSelect')
  } else if (!userData.is_onboarded) {
    navigation.navigate('Onboarding')
  } else {
    navigation.navigate('MainApp')
  }
}
```

---

## 2. Web App Routing (savitara-web)

### File: `savitara-web/src/App.jsx`

Add these routes:

```javascript
import LanguageSelector from './pages/LanguageSelector'
import Wallet from './pages/Wallet'

// In your router:
<BrowserRouter>
  <Routes>
    {/* Public Routes */}
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    
    {/* Language Selection (after auth, before onboarding) */}
    <Route 
      path="/language-select" 
      element={
        <ProtectedRoute>
          <LanguageSelector />
        </ProtectedRoute>
      } 
    />
    
    {/* Onboarding */}
    <Route 
      path="/onboarding" 
      element={
        <ProtectedRoute>
          <Onboarding />
        </ProtectedRoute>
      } 
    />
    
    {/* Main App Routes */}
    <Route 
      path="/dashboard" 
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } 
    />
    
    {/* Wallet */}
    <Route 
      path="/wallet" 
      element={
        <ProtectedRoute>
          <Wallet />
        </ProtectedRoute>
      } 
    />
    
    {/* Other routes... */}
  </Routes>
</BrowserRouter>
```

### Navigation Component Update:

```javascript
// In your navigation bar component:
<nav>
  <Link to="/dashboard">Dashboard</Link>
  <Link to="/services">Services</Link>
  <Link to="/bookings">Bookings</Link>
  <Link to="/wallet">💳 Wallet</Link> {/* NEW */}
  <Link to="/chat">Chat</Link>
  <Link to="/profile">Profile</Link>
</nav>
```

### Auth Flow Logic:

```javascript
// In Login.jsx or after auth:
const handleLoginSuccess = (userData) => {
  if (!userData.language_preference) {
    navigate('/language-select')
  } else if (!userData.is_onboarded) {
    navigate('/onboarding')
  } else {
    navigate('/dashboard')
  }
}
```

---

## 3. Admin Web Navigation (admin-savitara-web)

### File: `admin-savitara-web/src/components/Layout.js`

Add KYC Verification link to sidebar:

```javascript
import Link from 'next/link'

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <aside className="sidebar">
        <nav>
          <Link href="/dashboard">
            <a>📊 Dashboard</a>
          </Link>
          <Link href="/users">
            <a>👥 User Management</a>
          </Link>
          <Link href="/verifications">
            <a>✓ Profile Verifications</a>
          </Link>
          
          {/* NEW - KYC Verification */}
          <Link href="/kyc-verification">
            <a>🔐 KYC Verification</a>
          </Link>
          
          <Link href="/reviews">
            <a>⭐ Reviews</a>
          </Link>
          <Link href="/broadcast">
            <a>📢 Broadcast</a>
          </Link>
          <Link href="/content-management">
            <a>📝 Content</a>
          </Link>
          <Link href="/audit-logs">
            <a>📜 Audit Logs</a>
          </Link>
        </nav>
      </aside>
      
      <main className="content">
        {children}
      </main>
    </div>
  )
}
```

### Admin Dashboard Widget (Optional):

```javascript
// In pages/dashboard.js - add KYC stats widget:
<div className="dashboard-widgets">
  {/* Existing widgets */}
  
  {/* NEW - KYC Status Widget */}
  <div className="widget kyc-widget">
    <h3>KYC Verification Queue</h3>
    <div className="stats">
      <div className="stat pending">
        <span className="count">{pendingKYC}</span>
        <span className="label">Pending Review</span>
      </div>
      <div className="stat verified">
        <span className="count">{verifiedKYC}</span>
        <span className="label">Verified</span>
      </div>
    </div>
    <Link href="/kyc-verification">
      <a className="widget-link">Review KYC →</a>
    </Link>
  </div>
</div>
```

---

## 4. Privacy Disclaimer Integration

### When to Show the Privacy Modal:

**For Acharya Booking Confirmation Screens:**

#### Mobile: `savitara-app/src/screens/bookings/BookingDetailsScreen.js`

```javascript
import AcharyaPrivacyModal from '../../components/AcharyaPrivacyModal'

const BookingDetailsScreen = ({ route }) => {
  const { booking } = route.params
  const { user } = useAuth()
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  
  const handleConfirmBooking = () => {
    // Acharyas must accept privacy terms
    if (user.role === 'acharya') {
      setShowPrivacyModal(true)
    } else {
      // Grihastas don't need modal
      confirmBookingAPI()
    }
  }
  
  const handlePrivacyAccept = async () => {
    setShowPrivacyModal(false)
    
    try {
      // Proceed with actual booking confirmation
      await api.post(`/bookings/${booking._id}/confirm`)
      Alert.alert('Success', 'Booking confirmed!')
      navigation.goBack()
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm booking')
    }
  }
  
  return (
    <View>
      {/* Booking details */}
      
      {user.role === 'acharya' && booking.status === 'pending' && (
        <Button title="Confirm Booking" onPress={handleConfirmBooking} />
      )}
      
      <AcharyaPrivacyModal
        visible={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onCancel={() => setShowPrivacyModal(false)}
      />
    </View>
  )
}
```

#### Web: `savitara-web/src/pages/BookingDetails.jsx`

```javascript
import AcharyaPrivacyModal from '../components/AcharyaPrivacyModal'

const BookingDetails = () => {
  const { user } = useAuth()
  const [booking, setBooking] = useState(null)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  
  const handleConfirmBooking = () => {
    if (user.role === 'acharya') {
      setShowPrivacyModal(true)
    } else {
      confirmBookingAPI()
    }
  }
  
  const handlePrivacyAccept = async () => {
    setShowPrivacyModal(false)
    
    try {
      await api.post(`/bookings/${booking._id}/confirm`)
      toast.success('Booking confirmed!')
      navigate('/bookings')
    } catch (error) {
      toast.error('Failed to confirm booking')
    }
  }
  
  return (
    <div>
      {/* Booking details */}
      
      {user.role === 'acharya' && booking?.status === 'pending' && (
        <button onClick={handleConfirmBooking}>
          Confirm Booking
        </button>
      )}
      
      <AcharyaPrivacyModal
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onCancel={() => setShowPrivacyModal(false)}
      />
    </div>
  )
}
```

---

## 5. Wallet Integration in Payment Flow

### Show Wallet as Payment Option:

#### Mobile: `savitara-app/src/screens/bookings/PaymentScreen.js`

```javascript
import { useNavigation } from '@react-navigation/native'

const PaymentScreen = ({ route }) => {
  const { booking } = route.params
  const navigation = useNavigation()
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [wallet, setWallet] = useState(null)
  
  useEffect(() => {
    fetchWalletBalance()
  }, [])
  
  const fetchWalletBalance = async () => {
    const response = await api.get('/wallet/balance')
    setWallet(response.data.data.wallet)
  }
  
  const handlePayment = async () => {
    if (paymentMethod === 'wallet') {
      try {
        await api.post(`/wallet/pay`, {
          booking_id: booking._id,
          amount: booking.amount
        })
        Alert.alert('Success', 'Payment successful from wallet')
        navigation.navigate('BookingConfirmation', { booking })
      } catch (error) {
        Alert.alert('Error', error.response?.data?.message || 'Payment failed')
      }
    } else {
      // Razorpay flow
    }
  }
  
  return (
    <View>
      <Text style={styles.amount}>Amount: ₹{booking.amount}</Text>
      
      <View style={styles.paymentMethods}>
        <TouchableOpacity
          style={[styles.method, paymentMethod === 'wallet' && styles.selected]}
          onPress={() => setPaymentMethod('wallet')}
        >
          <Text>💳 Wallet</Text>
          <Text>Balance: ₹{wallet?.main_balance || 0}</Text>
          {wallet?.main_balance < booking.amount && (
            <Text style={styles.error}>Insufficient balance</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.method, paymentMethod === 'razorpay' && styles.selected]}
          onPress={() => setPaymentMethod('razorpay')}
        >
          <Text>💳 Card/UPI/NetBanking</Text>
        </TouchableOpacity>
      </View>
      
      {paymentMethod === 'wallet' && wallet?.main_balance < booking.amount && (
        <Button 
          title="Add Money to Wallet"
          onPress={() => navigation.navigate('Wallet')}
        />
      )}
      
      <Button
        title="Pay Now"
        onPress={handlePayment}
        disabled={paymentMethod === 'wallet' && wallet?.main_balance < booking.amount}
      />
    </View>
  )
}
```

---

## 6. Backend API Updates Needed

### Add Language Preference Field:

If not already in user model, add:

```python
# In backend/app/models/database.py
class User(BaseModel):
    # ... existing fields
    language_preference: Optional[str] = 'en'  # 'en', 'hi', 'kn', 'te', 'mr'
```

### Update Onboarding Endpoints:

```python
# In backend/app/api/v1/users.py
@router.post("/grihasta/onboarding")
async def onboard_grihasta(data: GrihastaOnboardingRequest):
    # ... existing logic
    
    # Add language if provided
    if data.language_preference:
        await db.users.update_one(
            {"_id": user_id},
            {"$set": {"language_preference": data.language_preference}}
        )
```

### Create Document Upload Endpoint:

```python
# In backend/app/api/v1/upload.py (create if doesn't exist)
from fastapi import UploadFile, File

@router.post("/documents")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Upload multiple documents for KYC verification"""
    urls = []
    
    for file in files:
        # Upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
        # Or save locally for development
        file_path = f"uploads/{file.filename}"
        
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Return URL (adjust based on your storage)
        urls.append(f"/uploads/{file.filename}")
    
    return {
        "success": True,
        "data": {"urls": urls}
    }
```

---

## 7. Testing Checklist

### Language Selection:
- [ ] User shown language screen after login
- [ ] Can select language and proceed
- [ ] Language saved to localStorage/AsyncStorage
- [ ] Language sent to backend on next API call
- [ ] Can change language from settings

### Wallet:
- [ ] Can navigate to wallet screen
- [ ] Balance displays correctly
- [ ] Can open add money modal
- [ ] Quick amount buttons work
- [ ] Amount input validation works
- [ ] Payment gateway redirects correctly
- [ ] Transactions list displays
- [ ] Pull-to-refresh works (mobile)

### KYC:
- [ ] Acharya onboarding shows document upload
- [ ] Can select multiple files
- [ ] Upload progress shows
- [ ] Documents appear in admin board
- [ ] Admin can view documents
- [ ] Admin can approve/reject
- [ ] Acharya receives status update

### Privacy Modal:
- [ ] Shows for Acharya on booking confirm
- [ ] Cannot proceed without scrolling
- [ ] Checkbox disabled until scrolled
- [ ] Accept button disabled until checked
- [ ] Cancel works and resets state
- [ ] Accept proceeds with booking

---

## 8. Environment Variables

Add to `.env` files if needed:

```bash
# Backend
UPLOAD_DIR=/path/to/uploads
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=.pdf,.jpg,.jpeg,.png

# Frontend
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_UPLOAD_ENDPOINT=/upload/documents
```

---

## Quick Start Commands

```bash
# After integration, test each platform:

# Mobile App
cd savitara-app
npm start

# Web App
cd savitara-web
npm run dev

# Admin Web
cd admin-savitara-web
npm run dev

# Backend (ensure running)
cd backend
uvicorn app.main:app --reload
```

---

## Need Help?

Refer to:
- `ENHANCEMENT_IMPLEMENTATION_SUMMARY.md` for detailed feature documentation
- `API_TESTING_GUIDE.md` for backend endpoint details
- Code comments in created files for usage examples

---

*Integration Guide Version 1.0*
*Compatible with implementation as of [Current Date]*
