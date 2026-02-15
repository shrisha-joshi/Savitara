import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  CircularProgress,
  Alert,
  Grid
} from '@mui/material';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success' | 'failed'

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}`);
      if (response.data.success) {
        setBooking(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch booking:', err);
      setError('Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) fetchBooking();
  }, [bookingId, fetchBooking]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-checkout')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-checkout';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    try {
      setPaying(true);
      setError(null);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError('Failed to load payment gateway. Please try again.');
        setPaying(false);
        return;
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: Math.round((booking.total_amount || 0) * 100), // Razorpay expects paise
        currency: 'INR',
        name: 'Savitara',
        description: `Pooja Booking - ${booking.pooja?.name || 'Booking'}`,
        order_id: booking.razorpay_order_id,
        handler: async function (response) {
          // Payment successful - verify with backend
          try {
            const verifyResponse = await api.post(
              `/bookings/${bookingId}/payment/verify`,
              null,
              {
                params: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                }
              }
            );
            if (verifyResponse.data.success) {
              setPaymentStatus('success');
              setTimeout(() => navigate('/bookings'), 3000);
            }
          } catch (verifyErr) {
            console.error('Payment verification failed:', verifyErr);
            setError('Payment was processed but verification failed. Please contact support.');
            setPaymentStatus('failed');
          }
          setPaying(false);
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          }
        },
        prefill: {
          name: booking.grihasta?.name || '',
          email: booking.grihasta?.email || '',
          contact: booking.grihasta?.phone || ''
        },
        theme: {
          color: '#FF6B00'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        setError(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setPaymentStatus('failed');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to initiate payment. Please try again.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box p={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <Layout>
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <FaCheckCircle size={64} color="green" />
            <Typography variant="h5" sx={{ mt: 2 }}>Payment Successful!</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Your booking has been confirmed. Redirecting to bookings...
            </Typography>
          </Paper>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" gutterBottom align="center" sx={{ color: 'var(--saffron-dark)' }}>
            Complete Payment
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {paymentStatus === 'failed' && (
            <Alert severity="error" icon={<FaTimesCircle />} sx={{ mb: 3 }}>
              Payment failed. You can retry below.
            </Alert>
          )}

          {booking && (
            <Box>
              <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: '#fffbf2' }}>
                <Typography variant="h6" gutterBottom>Booking Summary</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}><Typography color="text.secondary">Service:</Typography></Grid>
                  <Grid item xs={6}><Typography fontWeight="bold">{booking.pooja?.name || 'Pooja'}</Typography></Grid>

                  <Grid item xs={6}><Typography color="text.secondary">Type:</Typography></Grid>
                  <Grid item xs={6}>
                    <Typography fontWeight="bold">
                      {booking.booking_type === 'with_samagri' ? 'With Samagri' : 'Pooja Only'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}><Box sx={{ borderTop: '1px solid #eee', my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography color="text.secondary">Base Price:</Typography></Grid>
                  <Grid item xs={6}><Typography>₹{booking.base_price || 0}</Typography></Grid>

                  {booking.samagri_price > 0 && (
                    <>
                      <Grid item xs={6}><Typography color="text.secondary">Samagri:</Typography></Grid>
                      <Grid item xs={6}><Typography>₹{booking.samagri_price}</Typography></Grid>
                    </>
                  )}

                  {booking.platform_fee > 0 && (
                    <>
                      <Grid item xs={6}><Typography color="text.secondary">Platform Fee:</Typography></Grid>
                      <Grid item xs={6}><Typography>₹{booking.platform_fee}</Typography></Grid>
                    </>
                  )}

                  {booking.discount > 0 && (
                    <>
                      <Grid item xs={6}><Typography color="text.secondary">Discount:</Typography></Grid>
                      <Grid item xs={6}><Typography color="green">-₹{booking.discount}</Typography></Grid>
                    </>
                  )}

                  <Grid item xs={12}><Box sx={{ borderTop: '2px solid #333', my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography variant="h6">Total:</Typography></Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="primary">₹{booking.total_amount || 0}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePayment}
                disabled={paying}
                startIcon={paying && <CircularProgress size={20} color="inherit" />}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  bgcolor: '#FF6B00',
                  '&:hover': { bgcolor: '#e55e00' }
                }}
              >
                {paying ? 'Processing...' : `Pay ₹${booking.total_amount || 0}`}
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}
