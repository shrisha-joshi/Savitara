import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Common pages
import Home from './pages/Home'
import Login from './pages/Login'
import LanguageSelector from './pages/LanguageSelector'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Wallet from './pages/Wallet'
import Calendar from './pages/Calendar'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

// Services pages
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'

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

// Chat pages
import Conversations from './pages/chat/Conversations'
import Chat from './pages/chat/Chat'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Helper to check if user has completed onboarding
  const isOnboarded = user?.onboarded || user?.onboarding_completed

  return (
      <Routes>
        {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={user ? <Navigate to={isOnboarded ? "/" : "/onboarding"} /> : <Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      
      {/* Language Selection - after login/signup, before onboarding */}
      <Route path="/language-select" element={
        user ? <LanguageSelector /> : <Navigate to="/login" />
      } />
      
      {/* Onboarding route - accessible when logged in but not onboarded */}
      <Route path="/onboarding" element={
        user ? (isOnboarded ? <Navigate to="/" /> : <Onboarding />) : <Navigate to="/login" />
      } />

      {/* Protected routes */}
      {!user && <Route path="*" element={<Navigate to="/login" />} />}

      {/* Main app routes - only accessible if user is logged in AND onboarded */}
      {user && isOnboarded && (
        <>
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet" element={<Wallet />} />
          
          {/* Services routes (accessible to all logged in users) */}
          <Route path="/services" element={<Services />} />
          <Route path="/services/:serviceId" element={<ServiceDetail />} />
          
          {/* Grihasta routes */}
          {user.role === 'grihasta' && (
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
          {user.role === 'acharya' && (
            <>
              <Route path="/dashboard" element={<AcharyaDashboard />} />
              <Route path="/bookings" element={<AcharyaBookings />} />
              <Route path="/booking/:bookingId/start" element={<StartService />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/settings" element={<Settings />} />
            </>
          )}

          {/* Chat routes (common) */}
          <Route path="/chat" element={<Conversations />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
        </>
      )}
      
      {/* Redirect to onboarding if not completed */}
      {user && !isOnboarded && (
        <Route path="*" element={<Navigate to="/onboarding" />} />
      )}
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  )
}
export default App

export default App
