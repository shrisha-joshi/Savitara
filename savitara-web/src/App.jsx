import { Routes, Route, Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import PrivateRoute from './components/auth/PrivateRoute'
import ErrorBoundary from './components/ErrorBoundary'

// Common pages
import Home from './pages/Home'
import Login from './pages/Login'
import LanguageSelector from './pages/LanguageSelector'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Wallet from './pages/Wallet'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import About from './pages/About'
import Rewards from './pages/Rewards'
import AnalyticsDashboard from './pages/AnalyticsDashboard'

// Services pages
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Panchanga from './pages/Panchanga'

// Grihasta pages
import GrihastaDashboard from './pages/grihasta/Dashboard'
import SearchAcharyas from './pages/grihasta/SearchAcharyas'
import AcharyaProfile from './pages/grihasta/AcharyaProfile'
import CreateBooking from './pages/grihasta/CreateBooking'
import Payment from './pages/grihasta/Payment'
import MyBookings from './pages/grihasta/MyBookings'
import BookingDetails from './pages/grihasta/BookingDetails'
import SubmitReview from './pages/grihasta/SubmitReview'

// Acharya pages
import AcharyaDashboard from './pages/acharya/Dashboard'
import AcharyaBookings from './pages/acharya/Bookings'
import StartService from './pages/acharya/StartService'
import Earnings from './pages/acharya/Earnings'
import Reviews from './pages/acharya/Reviews'
import Settings from './pages/acharya/Settings'
import CalendarManagement from './pages/acharya/CalendarManagement'
import KYCUpload from './pages/acharya/KYCUpload'

// Admin pages
import UserManagement from './pages/admin/UserManagement'
import ServiceManagement from './pages/admin/ServiceManagement'

// Chat pages
import ChatLayout from './pages/chat/ChatLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Wrapper component for onboarding route logic
function OnboardingRoute({ user, isOnboarded }) {
  if (!user) {
    return <Navigate to="/login" />;
  } else if (isOnboarded) {
    return <Navigate to="/" />;
  } else {
    return <Onboarding />;
  }
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired
}

OnboardingRoute.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string,
    onboarded: PropTypes.bool,
    onboarding_completed: PropTypes.bool
  }),
  isOnboarded: PropTypes.bool
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  // Helper to check if user has completed onboarding
  const isOnboarded = user?.onboarded || user?.onboarding_completed

  return (
    <ErrorBoundary>
      <SocketProvider>
        <Routes>
        {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={user ? <Navigate to={isOnboarded ? "/" : "/onboarding"} /> : <Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/about" element={<About />} />
      
      {/* Language Selection - after login/signup, before onboarding */}
      <Route path="/language-select" element={
        user ? <LanguageSelector /> : <Navigate to="/login" />
      } />
      
      {/* Onboarding route - accessible when logged in but not onboarded */}
      <Route path="/onboarding" element={<OnboardingRoute user={user} isOnboarded={isOnboarded} />} />

      {/* Services routes (accessible to all logged in users) */}
      <Route element={<PrivateRoute />}>
        <Route path="/services" element={<Services />} />
        <Route path="/services/:serviceId" element={<ServiceDetail />} />
        <Route path="/panchanga" element={<Panchanga />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
        <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
        <Route path="/chat/u/:recipientId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
        
        {/* Grihasta routes */}
        {(!user || user.role === 'grihasta') && (
          <>
            <Route path="/dashboard" element={<GrihastaDashboard />} />
            <Route path="/search" element={<SearchAcharyas />} />
            <Route path="/acharya/:id" element={<AcharyaProfile />} />
            <Route path="/booking/create/:acharyaId" element={<CreateBooking />} />
            <Route path="/booking/:bookingId/payment" element={<Payment />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/booking/:bookingId" element={<BookingDetails />} />
            <Route path="/booking/:bookingId/review" element={<SubmitReview />} />
          </>
        )}

        {/* Acharya routes */}
        {(!user || user.role === 'acharya') && (
          <>
            <Route path="/dashboard" element={<AcharyaDashboard />} />
            <Route path="/bookings" element={<AcharyaBookings />} />
            <Route path="/booking/:bookingId/start" element={<StartService />} />
            <Route path="/calendar" element={<CalendarManagement />} />
            <Route path="/kyc-upload" element={<KYCUpload />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/settings" element={<Settings />} />
          </>
        )}

        {/* Admin routes */}
        {(!user || user.role === 'admin') && (
          <>
            <Route path="/admin/analytics" element={<AnalyticsDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/services" element={<ServiceManagement />} />
            <Route path="/dashboard" element={<AnalyticsDashboard />} />
          </>
        )}
      </Route>
      
      {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </SocketProvider>
    </ErrorBoundary>
  )
}

export default App
