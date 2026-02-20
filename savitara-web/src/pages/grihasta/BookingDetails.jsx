import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Chip, 
  Button, 
  CircularProgress,
  Alert
} from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import { 
  FaCalendarAlt, 
  FaClock, 
  FaVideo, 
  FaArrowLeft 
} from 'react-icons/fa'
import Layout from '../../components/Layout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function BookingDetails() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`)
        if (response.data.success) {
          setBooking(response.data.data)
        }
      } catch (err) {
        console.error('Failed to fetch booking:', err)
        setError('Failed to load booking details.')
      } finally {
        setLoading(false)
      }
    }

    if (bookingId) {
      fetchBooking()
    }
  }, [bookingId])

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error || !booking) {
    return (
      <Layout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Booking not found'}</Alert>
          <Button startIcon={<FaArrowLeft />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
            Back
          </Button>
        </Container>
      </Layout>
    )
  }

  const isAcharya = user?.role === 'acharya'
  // Identify participants
  const acharyaChatId = booking.acharya_user_id || booking.acharya_userid || booking.acharya_id
  const grihastaUserId = booking.grihasta_id || booking.user_id
  const otherPartyId = isAcharya ? grihastaUserId : acharyaChatId
  const otherPartyName = isAcharya ? booking.grihasta_name : booking.acharya_name

  const formatStatus = (status) => {
    const colors = {
      pending: 'warning',
      confirmed: 'info',
      completed: 'success',
      cancelled: 'error'
    }
    return <Chip 
      label={status ? status.toUpperCase() : 'UNKNOWN'} 
      color={colors[status] || 'default'} 
      size="small" 
    />
  }
  
  // Format date/time helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } catch (err) {
      console.warn('Invalid date format:', dateStr, err)
      return dateStr
    }
  }

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
              <Button 
                startIcon={<FaArrowLeft />} 
                onClick={() => navigate(-1)} 
                sx={{ mb: 2 }}
              >
                Back
              </Button>
              
              <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h4" fontWeight="bold" component="h1">
                    Booking Details
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Button 
                      variant="outlined" 
                      startIcon={<MessageIcon />} 
                      onClick={() => navigate(`/chat/u/${otherPartyId}`)}
                      sx={{ mr: 1 }}
                    >
                      Message {isAcharya ? 'Grihasta' : 'Acharya'}
                    </Button>
                    {formatStatus(booking.status)}
                  </Box>
                </Box>

          <Grid container spacing={4}>
            {/* Left Column: Info */}
            <Grid item xs={12} md={6}>
              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Service / Pooja
                </Typography>
                  <Typography variant="h6">
                    {booking.pooja_name || booking.pooja_type || booking.service_name || 'General Consultation'}
                  </Typography>
              </Box>
              
              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Date & Time
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <FaCalendarAlt color="#666" />
                  <Typography variant="body1">
                    {formatDateTime(booking.date_time || booking.scheduled_datetime || booking.date)}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <FaClock color="#666" />
                  <Typography variant="body1">
                    {booking.time_slot || new Date(booking.date_time || booking.scheduled_datetime || booking.date || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {booking.duration_minutes || booking.duration ? ` (${booking.duration_minutes || booking.duration} mins)` : ''}
                  </Typography>
                </Box>
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {isAcharya ? 'Grihasta (User)' : 'Acharya'}
                </Typography>
                <Typography variant="h6">{otherPartyName || 'Unknown Name'}</Typography>
              </Box>
            </Grid>
            
            {/* Right Column: Actions */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8f9fa', borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Actions</Typography>
                
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<MessageIcon />}
                  sx={{ mb: 2, py: 1.5 }}
                  onClick={() => navigate(`/chat/u/${otherPartyId}`)}
                  disabled={!otherPartyId}
                >
                  Message {isAcharya ? 'Grihasta' : 'Acharya'}
                </Button>

                {(booking.status === 'confirmed' || booking.status === 'completed') && (
                  <Button  
                    fullWidth 
                    variant="outlined" 
                    color="secondary"
                    startIcon={<FaVideo />}
                    sx={{ py: 1.5 }}
                    onClick={() => navigate(`/video-call/${bookingId}`)} 
                  >
                    Join Video Call
                  </Button>
                )}
              </Paper>
            </Grid>
          </Grid>
          
          {booking.notes && (
            <Box mt={4} pt={2} borderTop={1} borderColor="divider">
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Special Requests / Notes
              </Typography>
              <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.primary' }}>
                "{booking.notes}"
              </Typography>
            </Box>
          )}

          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">
              Booking ID: {booking._id || booking.id}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  )
}
