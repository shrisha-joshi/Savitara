import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Paper,
  Chip,
  Button,
  Grid,
  Alert
} from '@mui/material';
import { format } from 'date-fns';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FaCalendarAlt, FaClock, FaUser, FaRupeeSign, FaVideo } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const BookingCard = ({ booking }) => {
  const navigate = useNavigate();
  const statusColors = {
    'requested': 'info',
    'pending_payment': 'warning',
    'confirmed': 'success',
    'completed': 'info',
    'cancelled': 'error',
    'failed': 'error'
  };

  const isUpcoming = ['requested', 'confirmed', 'pending_payment'].includes(booking.status);

  return (
    <Paper sx={{ p: 3, mb: 2, borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={3}>
          <Typography variant="subtitle2" color="text.secondary">
            Booking ID: #{booking.booking_id ? booking.booking_id.slice(-6) : '...'}
          </Typography>
          <Box display="flex" alignItems="center" mt={1}>
            <FaCalendarAlt color="#888" />
            <Typography variant="body1" ml={1} fontWeight="bold">
              {format(new Date(booking.date_time), 'MMM dd, yyyy')}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" mt={0.5}>
            <FaClock color="#888" />
            <Typography variant="body2" ml={1}>
              {format(new Date(booking.date_time), 'hh:mm a')}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Typography variant="h6" color="primary">{booking.pooja_name || 'Vedic Pooja'}</Typography>
          <Box display="flex" alignItems="center" mt={1}>
            <FaUser size={12} color="#666" />
            <Typography variant="body2" ml={1} color="text.secondary">
              Acharya {booking.acharya_name || '...'}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={2}>
          <Chip 
            label={booking.status?.replace('_', ' ').toUpperCase()} 
            color={statusColors[booking.status] || 'default'} 
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
          <Box display="flex" alignItems="center" mt={1}>
            <FaRupeeSign size={14} />
            <Typography variant="body1" fontWeight="bold">
              {booking.total_amount}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={3} sx={{ textAlign: { sm: 'right' } }}>
          {booking.status === 'requested' && (
            <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
              Awaiting Acharya confirmation
            </Alert>
          )}
          {isUpcoming && booking.status === 'confirmed' && (
            <Button 
              variant="contained" 
              color="primary" 
              size="small" 
              startIcon={<FaVideo />}
              sx={{ mb: 1, width: '100%' }}
              onClick={() => navigate(`/booking/${booking.id}`)}
            >
              Join Session
            </Button>
          )}
          {booking.status === 'pending_payment' && (
            <Button 
              variant="contained" 
              color="warning" 
              size="small"
              sx={{ mb: 1, width: '100%' }}
              onClick={() => navigate(`/booking/${booking.id}/payment`)}
            >
              Complete Payment
            </Button>
          )}
          <Button 
            variant="outlined" 
            size="small" 
            fullWidth
            onClick={() => navigate(`/booking/${booking.id}`)}
          >
            View Details
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

BookingCard.propTypes = {
  booking: PropTypes.shape({
    id: PropTypes.string,
    booking_id: PropTypes.string,
    date_time: PropTypes.string.isRequired,
    pooja_name: PropTypes.string,
    acharya_name: PropTypes.string,
    status: PropTypes.string.isRequired,
    total_amount: PropTypes.number
  }).isRequired
};

export default function MyBookings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Fetch all bookings and filter client side for better UX on small datasets
      const response = await api.get('/bookings?limit=50');
      if (response.data.success) {
        setBookings(response.data.data.bookings || response.data.data || []);
      }
    } catch (err) {
      console.error('Fetch bookings failed:', err);
      setError('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newIndex) => {
    setTabIndex(newIndex);
  };

  // Filter bookings based on tab
  const getFilteredBookings = () => {
    if (tabIndex === 0) return bookings.filter(b => ['confirmed', 'pending_payment'].includes(b.status));
    if (tabIndex === 1) return bookings.filter(b => b.status === 'completed');
    if (tabIndex === 2) return bookings.filter(b => ['cancelled', 'failed'].includes(b.status));
    return bookings;
  };

  const filtered = getFilteredBookings();

  if (loading) return <Layout><Box p={4} textAlign="center"><CircularProgress /></Box></Layout>;

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4, minHeight: '80vh' }}>
        <Typography variant="h4" gutterBottom sx={{ color: 'var(--saffron-dark)', mb: 3 }}>
          My Bookings
        </Typography>

        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange} 
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Upcoming" />
          <Tab label="Completed" />
          <Tab label="Cancelled" />
        </Tabs>

        {error && <Alert severity="error">{error}</Alert>}

        {filtered.length > 0 ? (
          filtered.map(booking => (
            <BookingCard key={booking._id || booking.id} booking={booking} />
          ))
        ) : (
          <Box textAlign="center" py={8} bgcolor="#f9f9f9" borderRadius={2}>
            <Typography variant="h6" color="text.secondary">
              No bookings found in this category.
            </Typography>
            <Button 
              variant="contained" 
              sx={{ mt: 2 }}
              href="/search"
            >
              Book a Pooja
            </Button>
          </Box>
        )}
      </Container>
    </Layout>
  );
}
