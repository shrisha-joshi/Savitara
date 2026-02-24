import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  CircularProgress,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material'
import {
  Search,
  CalendarMonth,
  AccessTime,
  LocationOn,
  VideoCall,
  Person,
  CheckCircle,
  Cancel,
  PlayArrow,
  Schedule
} from '@mui/icons-material'
import Layout from '../../components/Layout'
import api from '../../services/api'
import { useSocket } from '../../context/SocketContext'
// Helper to fetch all Acharyas for referral
async function fetchAcharyas() {
  try {
    const res = await api.get('/users/acharyas/search', { params: { limit: 100 } })
    return res.data?.data?.profiles || []
  } catch {
    return []
  }
}
import { toast } from 'react-toastify'

export default function AcharyaBookings() {
  const socketContext = useSocket();
  const { bookingUpdates = [] } = socketContext || {};
  const [bookings, setBookings] = useState([])
  const [filteredBookings, setFilteredBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [actionDialog, setActionDialog] = useState({ open: false, type: null })
  const [amount, setAmount] = useState('')
  const [referDialog, setReferDialog] = useState({ open: false, booking: null })
  const [acharyaList, setAcharyaList] = useState([])
  const [selectedAcharya, setSelectedAcharya] = useState('')
  const [referNotes, setReferNotes] = useState('')
  const [referLoading, setReferLoading] = useState(false)
  const [notification, setNotification] = useState(null);
  // Load Acharya list when refer dialog opens
  useEffect(() => {
    if (referDialog.open) {
      fetchAcharyas().then(setAcharyaList)
    }
  }, [referDialog.open])
  const handleRefer = async () => {
    if (!selectedAcharya) return
    setReferLoading(true)
    try {
      await api.put(`/bookings/${referDialog.booking._id}/refer`, {
        new_acharya_id: selectedAcharya,
        notes: referNotes
      })
      toast.success('Booking referred to new Acharya')
      setReferDialog({ open: false, booking: null })
      setSelectedAcharya('')
      setReferNotes('')
      await loadBookings()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to refer booking')
    } finally {
      setReferLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [])

  useEffect(() => {
    filterBookings()
  }, [bookings, selectedTab, searchQuery])

  // Listen for WebSocket booking updates
  useEffect(() => {
    if (bookingUpdates.length > 0) {
      const latestUpdate = bookingUpdates[bookingUpdates.length - 1];
      // Refresh bookings when update received
      loadBookings();
      
      // Show notification for new requests
      if (latestUpdate.status === 'requested') {
        setNotification({
          message: 'New booking request received!',
          severity: 'info'
        });
      } else if (latestUpdate.type === 'booking_update') {
        setNotification({
          message: latestUpdate.message || 'Booking updated',
          severity: 'info'
        });
      }
    }
  }, [bookingUpdates]);

  const loadBookings = async () => {
    try {
      setLoading(true)
      const response = await api.get('/bookings/my-bookings')
      const raw = response.data?.data
      const bookingData = Array.isArray(raw) ? raw : (raw?.bookings || response.data?.bookings || [])
      setBookings(bookingData)
    } catch (error) {
      console.error('Failed to load bookings:', error)
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const filterBookings = () => {
    let filtered = [...bookings]

    // Filter by tab
    if (selectedTab !== 'all') {
      filtered = filtered.filter(b => b.status === selectedTab)
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.grihasta_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pooja_type?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredBookings(filtered)
  }

  const handleAction = async (action) => {
    try {
      let endpoint = ''
      let successMessage = ''
      let data = null

      switch (action) {
        case 'accept':
          endpoint = `/bookings/${selectedBooking._id}/status`
          successMessage = 'Booking request accepted'
          data = {
            status: 'confirmed',
            amount: amount ? Number.parseFloat(amount) : undefined,
            notes: 'Request approved by Acharya'
          }
          await api.put(endpoint, data)
          break
        case 'reject':
          endpoint = `/bookings/${selectedBooking._id}/status`
          successMessage = 'Booking request declined'
          data = {
            status: 'cancelled',
            notes: 'Request declined by Acharya'
          }
          await api.put(endpoint, data)
          break
        case 'start': {
          endpoint = `/bookings/${selectedBooking._id}/start`
          successMessage = 'Booking started successfully'
          const otp = window.prompt('Enter start OTP shared by Grihasta')
          if (!otp) {
            toast.info('Start cancelled: OTP required')
            return
          }
          await api.post(endpoint, null, { params: { otp } })
          break
        }
        case 'complete': {
          endpoint = `/bookings/${selectedBooking._id}/attendance/confirm`
          successMessage = 'Attendance confirmed; booking completion queued'
          await api.post(endpoint, { confirmed: true })
          break
        }
        case 'cancel':
          endpoint = `/bookings/${selectedBooking._id}/status`
          successMessage = 'Booking cancelled successfully'
          await api.put(endpoint, { status: 'cancelled', notes: 'Cancelled by Acharya' })
          break
        default:
          return
      }

      toast.success(successMessage)
      setActionDialog({ open: false, type: null })
      setSelectedBooking(null)
      await loadBookings()
    } catch (error) {
      console.error('Action failed:', error)
      toast.error(error.response?.data?.detail || 'Action failed')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      requested: 'info',
      pending: 'warning',
      confirmed: 'info',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'error',
      rejected: 'error'
    }
    return colors[status] || 'default'
  }

  const getStatusIcon = (status) => {
    const icons = {
      requested: <Schedule />,
      pending: <Schedule />,
      confirmed: <CheckCircle />,
      in_progress: <PlayArrow />,
      completed: <CheckCircle />,
      cancelled: <Cancel />,
      rejected: <Cancel />
    }
    return icons[status]
  }

  const tabs = [
    { value: 'all', label: 'All', count: bookings.length },
    { value: 'requested', label: 'Requests', count: bookings.filter(b => b.status === 'requested').length },
    { value: 'pending', label: 'Pending Payment', count: bookings.filter(b => b.status === 'pending_payment' || b.status === 'pending').length },
    { value: 'confirmed', label: 'Confirmed', count: bookings.filter(b => b.status === 'confirmed').length },
    { value: 'in_progress', label: 'In Progress', count: bookings.filter(b => b.status === 'in_progress').length },
    { value: 'completed', label: 'Completed', count: bookings.filter(b => b.status === 'completed').length }
  ]

  const getDialogTitle = (type) => {
    const titles = {
      accept: 'Accept Booking Request?',
      reject: 'Decline Booking Request?',
      start: 'Start Booking Session?',
      complete: 'Complete Booking?',
      cancel: 'Cancel Booking?'
    }
    return titles[type] || ''
  }

  const dialogTitle = getDialogTitle(actionDialog.type)

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" fontWeight={700} color="primary.main" gutterBottom>
            My Bookings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage all your consultation bookings
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>
                  {bookings.length}
                </Typography>
                <Typography variant="body2">Total Bookings</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>
                  {bookings.filter(b => b.status === 'pending').length}
                </Typography>
                <Typography variant="body2">Pending</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>
                  {bookings.filter(b => b.status === 'confirmed').length}
                </Typography>
                <Typography variant="body2">Confirmed</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>
                  {bookings.filter(b => b.status === 'completed').length}
                </Typography>
                <Typography variant="body2">Completed</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs and Search */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={selectedTab}
              onChange={(e, newValue) => setSelectedTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabs.map(tab => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {tab.label}
                      <Chip label={tab.count} size="small" color="primary" />
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="Search by Grihasta name or pooja type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        </Card>

        {/* Bookings List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={60} />
          </Box>
        ) : (
          filteredBookings.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CalendarMonth sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No bookings found
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  {selectedTab === 'all' ? 'You don\'t have any bookings yet' : `No ${selectedTab} bookings`}
                </Typography>
              </Box>
            </CardContent>
          </Card>
          ) : (
          <Grid container spacing={3}>
            {filteredBookings.map((booking) => (
              <Grid item xs={12} md={6} lg={4} key={booking._id || booking.id}>
                <Card
                  elevation={3}
                  sx={{
                    height: '100%',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent>
                    {/* Status Badge */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Chip
                        icon={getStatusIcon(booking.status)}
                        label={booking.status?.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(booking.status)}
                        size="small"
                      />
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        ₹{booking.total_amount || booking.amount}
                      </Typography>
                    </Box>

                    {/* Pooja Type */}
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {booking.pooja_type || 'Consultation'}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    {/* Grihasta Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                        <Person fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Grihasta
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {booking.grihasta_name || 'Unknown'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Date & Time */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CalendarMonth fontSize="small" color="action" />
                      <Typography variant="body2">
                        {new Date(booking.scheduled_datetime || booking.booking_date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AccessTime fontSize="small" color="action" />
                      <Typography variant="body2">
                        {new Date(booking.scheduled_datetime || booking.booking_date).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} ({booking.duration_hours || 1}h)
                      </Typography>
                    </Box>

                    {/* Location */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      {booking.booking_type === 'virtual' || booking.is_virtual ? (
                        <>
                          <VideoCall fontSize="small" color="action" />
                          <Typography variant="body2">Virtual Consultation</Typography>
                        </>
                      ) : (
                        <>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="body2" noWrap>
                            {booking.location || 'In Person'}
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {booking.status === 'requested' && (
                        <>
                          <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={() => {
                              setSelectedBooking(booking)
                              setAmount(booking.total_amount || '')
                              setActionDialog({ open: true, type: 'accept' })
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            onClick={() => {
                              setSelectedBooking(booking)
                              setActionDialog({ open: true, type: 'reject' })
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            color="secondary"
                            onClick={() => {
                              setReferDialog({ open: true, booking })
                            }}
                          >
                            Refer/Pass
                          </Button>
                        </>
                      )}
        {/* Refer/Pass Dialog */}
        <Dialog
          open={referDialog.open}
          onClose={() => setReferDialog({ open: false, booking: null })}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Refer/Pass Booking</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Select another Acharya to refer this booking. The new Acharya will be notified.
            </Typography>
            <TextField
              select
              label="Select Acharya"
              value={selectedAcharya}
              onChange={e => setSelectedAcharya(e.target.value)}
              fullWidth
              SelectProps={{ native: true }}
              sx={{ mb: 2 }}
            >
              <option value="">-- Select --</option>
              {acharyaList.filter(a => a._id !== referDialog.booking?.acharya_id).map(a => (
                <option key={a._id} value={a._id}>{a.full_name || a.name}</option>
              ))}
            </TextField>
            <TextField
              label="Notes (optional)"
              value={referNotes}
              onChange={e => setReferNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReferDialog({ open: false, booking: null })}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRefer}
              disabled={!selectedAcharya || referLoading}
            >
              {referLoading ? 'Referring...' : 'Confirm Refer'}
            </Button>
          </DialogActions>
        </Dialog>

                      {booking.status === 'confirmed' && (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<PlayArrow />}
                          onClick={() => {
                            setSelectedBooking(booking)
                            setActionDialog({ open: true, type: 'start' })
                          }}
                        >
                          Start Session
                        </Button>
                      )}

                      {booking.status === 'in_progress' && (
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircle />}
                          onClick={() => {
                            setSelectedBooking(booking)
                            setActionDialog({ open: true, type: 'complete' })
                          }}
                        >
                          Mark Complete
                        </Button>
                      )}

                      {(booking.status === 'pending' || booking.status === 'confirmed') && (
                        <Button
                          fullWidth={booking.status === 'pending'}
                          variant="outlined"
                          color="error"
                          startIcon={<Cancel />}
                          onClick={() => {
                            setSelectedBooking(booking)
                            setActionDialog({ open: true, type: 'cancel' })
                          }}
                        >
                          Cancel
                        </Button>
                      )}

                      {booking.status === 'completed' && (
                        <Button fullWidth variant="outlined" disabled>
                          Completed
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ))}

        {/* Action Confirmation Dialog */}
        <Dialog
          open={actionDialog.open}
          onClose={() => setActionDialog({ open: false, type: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {dialogTitle}
          </DialogTitle>
          <DialogContent>
            {actionDialog.type === 'accept' && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  This will accept the request and notify the Grihasta to proceed with payment.
                </Alert>
                <TextField
                  fullWidth
                  label="Confirmed Amount (₹)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  helperText="You can adjust the final amount here before accepting"
                />
              </Box>
            )}
            {actionDialog.type === 'reject' && (
              <Alert severity="warning">
                This will decline the request. This action cannot be undone.
              </Alert>
            )}
            {actionDialog.type === 'start' && (
              <Alert severity="info">
                This will mark the booking as "In Progress" and notify the Grihasta that the session has started.
              </Alert>
            )}
            {actionDialog.type === 'complete' && (
              <Alert severity="success">
                This will mark the booking as completed. The Grihasta will be able to leave a review.
              </Alert>
            )}
            {actionDialog.type === 'cancel' && (
              <Alert severity="warning">
                This will cancel the booking. Any payments will be refunded according to the cancellation policy.
              </Alert>
            )}
            {selectedBooking && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Booking Details:
                </Typography>
                <Typography variant="body1">
                  <strong>{selectedBooking.pooja_type}</strong> with {selectedBooking.grihasta_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(selectedBooking.scheduled_datetime || selectedBooking.booking_date).toLocaleString()}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActionDialog({ open: false, type: null })}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => handleAction(actionDialog.type)}
              color={actionDialog.type === 'cancel' ? 'error' : 'primary'}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
      
      <Snackbar
        open={!!notification}
        autoHideDuration={5000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.severity || 'info'}
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Layout>
  )
}
