import { useState, useEffect, useCallback } from 'react'
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
  Alert,
  TextField,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar
} from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import StarRateIcon from '@mui/icons-material/StarRate'
import CancelIcon from '@mui/icons-material/Cancel'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { 
  FaCalendarAlt, 
  FaClock, 
  FaVideo, 
  FaArrowLeft,
  FaKey
} from 'react-icons/fa'
import Layout from '../../components/Layout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'

// ─── Sub-components to reduce cognitive complexity ───────────────────────────

function OtpSection({ bookingId, isAcharya }) {
  const [generating, setGenerating] = useState(false)
  const [otp, setOtp] = useState(null)
  const [err, setErr] = useState(null)

  const generate = async () => {
    setGenerating(true)
    setErr(null)
    try {
      const res = await api.post(`/bookings/${bookingId}/generate-otp`)
      if (res.data.success) setOtp(res.data.data?.otp)
    } catch {
      setErr('Failed to generate OTP. Please retry.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <FaKey style={{ marginRight: 8, verticalAlign: 'middle' }} />
        Session OTP
      </Typography>
      {isAcharya ? (
        otp ? (
          <Alert severity="success">
            <Typography variant="h5" fontWeight="bold" letterSpacing={6}>{otp}</Typography>
            <Typography variant="caption">Share this OTP with the Grihasta to confirm attendance.</Typography>
          </Alert>
        ) : (
          <>
            {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Generate an OTP to start the session. Share it with the Grihasta.
            </Typography>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <LockOpenIcon />}
              onClick={generate}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Generate Session OTP'}
            </Button>
          </>
        )
      ) : (
        <Alert severity="info">
          Waiting for the Acharya to generate a session OTP.
          Once they share it, enter it in the Attendance section below.
        </Alert>
      )}
    </Box>
  )
}

function AttendanceSection({ bookingId, isAcharya, onDone }) {
  const [otp, setOtp] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState(null)
  const [err, setErr] = useState(null)

  const confirm = async () => {
    setConfirming(true)
    setErr(null)
    try {
      const res = await api.post(`/bookings/${bookingId}/attendance/confirm`, {
        confirmed: true,
        notes: otp || undefined,
      })
      if (res.data.success) {
        setMessage(res.data.message)
        onDone(res.data.message)
      }
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to confirm attendance.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Confirm Attendance
      </Typography>
      {message ? (
        <Alert severity="success">{message}</Alert>
      ) : (
        <>
          {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {isAcharya
              ? 'Confirm that the session is in progress.'
              : 'Enter the OTP provided by the Acharya to confirm attendance.'}
          </Typography>
          {!isAcharya && (
            <TextField
              label="Session OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputProps={{ maxLength: 6, style: { letterSpacing: 4, fontSize: '1.4rem', textAlign: 'center' } }}
              sx={{ mt: 1, mb: 2, width: 200 }}
            />
          )}
          <Box>
            <Button
              variant="contained"
              color="success"
              startIcon={confirming ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
              onClick={confirm}
              disabled={confirming || (!isAcharya && otp.length < 4)}
            >
              {confirming ? 'Confirming…' : 'Confirm Attendance'}
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  requested: 'warning',
  pending_payment: 'warning',
  confirmed: 'info',
  in_progress: 'secondary',
  completed: 'success',
  cancelled: 'error',
  rejected: 'error',
  failed: 'error',
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return dateStr
  }
}

export default function BookingDetails() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { bookingUpdates } = useSocket()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [booking, setBooking] = useState(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })

  const showSnack = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  const fetchBooking = useCallback(async () => {
    try {
      const response = await api.get(`/bookings/${bookingId}`)
      if (response.data.success) setBooking(response.data.data)
    } catch {
      setError('Failed to load booking details.')
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => { if (bookingId) fetchBooking() }, [bookingId, fetchBooking])

  // Real-time status updates via WebSocket
  useEffect(() => {
    if (!bookingUpdates?.length || !booking) return
    const latest = bookingUpdates[bookingUpdates.length - 1]
    const thisId = booking._id || booking.id
    if (latest?.booking_id === thisId) {
      setBooking(prev => ({ ...prev, status: latest.status }))
      showSnack(`Status updated: ${latest.status?.replace('_', ' ').toUpperCase()}`)
    }
  }, [bookingUpdates, booking, showSnack])

  const handleCancelBooking = async () => {
    setCancelling(true)
    try {
      await api.put(`/bookings/${bookingId}/cancel`)
      setBooking(prev => ({ ...prev, status: 'cancelled' }))
      showSnack('Booking cancelled successfully.', 'success')
    } catch (e) {
      showSnack(e.response?.data?.detail || 'Failed to cancel booking.', 'error')
    } finally {
      setCancelling(false)
      setCancelDialogOpen(false)
    }
  }

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
          <Button startIcon={<FaArrowLeft />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>Back</Button>
        </Container>
      </Layout>
    )
  }

  const isAcharya = user?.role === 'acharya'
  const otherPartyId = isAcharya
    ? (booking.grihasta_id || booking.user_id)
    : (booking.acharya_user_id || booking.acharya_userid || booking.acharya_id)
  const otherPartyName = isAcharya ? booking.grihasta_name : booking.acharya_name
  const canCancel = ['requested', 'pending_payment', 'confirmed'].includes(booking.status)
  const dateStr = booking.date_time || booking.scheduled_datetime || booking.date

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<FaArrowLeft />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" fontWeight="bold" component="h1">Booking Details</Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Button variant="outlined" startIcon={<MessageIcon />} onClick={() => navigate(`/chat/u/${otherPartyId}`)}>
                Message {isAcharya ? 'Grihasta' : 'Acharya'}
              </Button>
              <Chip
                label={booking.status ? booking.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                color={STATUS_COLORS[booking.status] || 'default'}
                size="small"
              />
            </Box>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Service / Pooja</Typography>
                <Typography variant="h6">
                  {booking.pooja_name || booking.pooja_type || booking.service_name || 'General Consultation'}
                </Typography>
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Date &amp; Time</Typography>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <FaCalendarAlt color="#666" />
                  <Typography variant="body1">{formatDateTime(dateStr)}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <FaClock color="#666" />
                  <Typography variant="body1">
                    {booking.time_slot || new Date(dateStr || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {(booking.duration_minutes || booking.duration) ? ` (${booking.duration_minutes || booking.duration} mins)` : ''}
                  </Typography>
                </Box>
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {isAcharya ? 'Grihasta (User)' : 'Acharya'}
                </Typography>
                <Typography variant="h6">{otherPartyName || 'Unknown Name'}</Typography>
              </Box>

              {booking.total_amount > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Amount</Typography>
                  <Typography variant="h6" color="primary">₹{booking.total_amount}</Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Actions</Typography>

                <Button fullWidth variant="outlined" startIcon={<MessageIcon />}
                  sx={{ mb: 2, py: 1.5 }} onClick={() => navigate(`/chat/u/${otherPartyId}`)} disabled={!otherPartyId}>
                  Message {isAcharya ? 'Grihasta' : 'Acharya'}
                </Button>

                {['confirmed', 'in_progress', 'completed'].includes(booking.status) && (
                  <Button fullWidth variant="outlined" color="secondary" startIcon={<FaVideo />}
                    sx={{ mb: 2, py: 1.5 }} onClick={() => navigate(`/video-call/${bookingId}`)}>
                    Join Video Call
                  </Button>
                )}

                {booking.status === 'pending_payment' && !isAcharya && (
                  <Button fullWidth variant="contained" color="warning" sx={{ mb: 2, py: 1.5 }}
                    onClick={() => navigate(`/booking/${bookingId}/payment`)}>
                    Complete Payment
                  </Button>
                )}

                {booking.status === 'completed' && !isAcharya && (
                  <Button fullWidth variant="contained" color="success" startIcon={<StarRateIcon />}
                    sx={{ mb: 2, py: 1.5 }} onClick={() => navigate(`/booking/${bookingId}/review`)}>
                    Submit Review
                  </Button>
                )}

                {canCancel && (
                  <Button fullWidth variant="outlined" color="error" startIcon={<CancelIcon />}
                    sx={{ py: 1.5 }} onClick={() => setCancelDialogOpen(true)}>
                    Cancel Booking
                  </Button>
                )}
              </Paper>
            </Grid>
          </Grid>

          {booking.status === 'confirmed' && (
            <>
              <Divider sx={{ my: 3 }} />
              <OtpSection bookingId={bookingId} isAcharya={isAcharya} />
            </>
          )}

          {booking.status === 'in_progress' && (
            <>
              <Divider sx={{ my: 3 }} />
              <AttendanceSection
                bookingId={bookingId}
                isAcharya={isAcharya}
                onDone={(msg) => { showSnack(msg, 'success'); setTimeout(fetchBooking, 1000) }}
              />
            </>
          )}

          {booking.notes && (
            <Box mt={4} pt={2} borderTop={1} borderColor="divider">
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Special Requests / Notes</Typography>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>&ldquo;{booking.notes}&rdquo;</Typography>
            </Box>
          )}

          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">Booking ID: {booking._id || booking.id}</Typography>
          </Box>
        </Paper>
      </Container>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Booking?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel this booking? This action cannot be undone.
            If eligible, a refund will be processed automatically.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>Keep Booking</Button>
          <Button onClick={handleCancelBooking} color="error" variant="contained" disabled={cancelling}
            startIcon={cancelling ? <CircularProgress size={18} color="inherit" /> : <CancelIcon />}>
            {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Layout>
  )
}
