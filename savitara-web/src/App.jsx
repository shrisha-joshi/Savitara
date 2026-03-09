import PropTypes from 'prop-types'
import { Navigate, Route, Routes } from 'react-router-dom'
import PrivateRoute from './components/auth/PrivateRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'

// Common pages
import About from './pages/About'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import Home from './pages/Home'
import LanguageSelector from './pages/LanguageSelector'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Privacy from './pages/Privacy'
import Profile from './pages/Profile'
import Rewards from './pages/Rewards'
import Terms from './pages/Terms'
import Wallet from './pages/Wallet'

// Services pages
import Panchanga from './pages/Panchanga'
import ServiceDetail from './pages/ServiceDetail'
import Services from './pages/Services'

// Grihasta pages
import AcharyaProfile from './pages/grihasta/AcharyaProfile'
import BookingDetails from './pages/grihasta/BookingDetails'
import CreateBooking from './pages/grihasta/CreateBooking'
import GrihastaDashboard from './pages/grihasta/Dashboard'
import MyBookings from './pages/grihasta/MyBookings'
import Payment from './pages/grihasta/Payment'
import SearchAcharyas from './pages/grihasta/SearchAcharyas'
import SubmitReview from './pages/grihasta/SubmitReview'

// Acharya pages
import AcharyaBookings from './pages/acharya/Bookings'
import CalendarManagement from './pages/acharya/CalendarManagement'
import AcharyaDashboard from './pages/acharya/Dashboard'
import Earnings from './pages/acharya/Earnings'
import KYCUpload from './pages/acharya/KYCUpload'
import Reviews from './pages/acharya/Reviews'
import Settings from './pages/acharya/Settings'
import StartService from './pages/acharya/StartService'

// Admin pages
import ServiceManagement from './pages/admin/ServiceManagement'
import UserManagement from './pages/admin/UserManagement'

// Chat pages
import ChatLayout from './pages/chat/ChatLayout'

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
    return <Navigate to="/login" replace />;
  } else if (isOnboarded) {
    return <Navigate to="/" replace />;
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
        user ? <LanguageSelector /> : <Navigate to="/login" replace />
      } />
      
      {/* Onboarding route - accessible when logged in but not onboarded */}
      <Route path="/onboarding" element={<OnboardingRoute user={user} isOnboarded={isOnboarded} />} />

      {/* Services routes (accessible to all logged in users) */}
      <Route element={<PrivateRoute />}>
        <Route path="/services" element={<Services />} />
        <Route path="/services/:serviceId" element={<ServiceDetail />} />
        <Route path="/panchanga" element={<Panchanga />} />
        {/* FE-04: Route-level ErrorBoundaries — a crash in one route does not unmount the whole app */}
        <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        <Route path="/wallet" element={<ErrorBoundary><Wallet /></ErrorBoundary>} />
        <Route path="/rewards" element={<ErrorBoundary><Rewards /></ErrorBoundary>} />
        <Route path="/chat" element={<ErrorBoundary><ProtectedRoute><ChatLayout /></ProtectedRoute></ErrorBoundary>} />
        <Route path="/chat/:conversationId" element={<ErrorBoundary><ProtectedRoute><ChatLayout /></ProtectedRoute></ErrorBoundary>} />
        <Route path="/chat/u/:recipientId" element={<ErrorBoundary><ProtectedRoute><ChatLayout /></ProtectedRoute></ErrorBoundary>} />
        
        {/* Grihasta routes */}
        {(!user || user.role === 'grihasta') && (
          <>
            <Route path="/dashboard" element={<GrihastaDashboard />} />
            <Route path="/search" element={<SearchAcharyas />} />
            <Route path="/acharya/:id" element={<AcharyaProfile />} />
            <Route path="/booking/create/:acharyaId" element={<ErrorBoundary><CreateBooking /></ErrorBoundary>} />
            <Route path="/booking/:bookingId/payment" element={<ErrorBoundary><Payment /></ErrorBoundary>} />
            <Route path="/bookings" element={<ErrorBoundary><MyBookings /></ErrorBoundary>} />
            <Route path="/booking/:bookingId" element={<ErrorBoundary><BookingDetails /></ErrorBoundary>} />
            <Route path="/booking/:bookingId/review" element={<ErrorBoundary><SubmitReview /></ErrorBoundary>} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SocketProvider>
    </ErrorBoundary>
  )
}

export default App
