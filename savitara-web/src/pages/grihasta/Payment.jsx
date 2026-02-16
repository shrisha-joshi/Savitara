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
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Chip,
  Divider,
  alpha
} from '@mui/material';
import { CheckCircle, Cancel, LocalOffer, MonetizationOn } from '@mui/icons-material';
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

  // Gamification states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [useCoins, setUseCoins] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [calculatedPrice, setCalculatedPrice] = useState(null);

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}`);
      if (response.data.success) {
        setBooking(response.data.data);
      }
      
      // Fetch coin balance
      try {
        const coinsResponse = await api.get('/api/v1/gamification/coins/balance');
        setCoinBalance(coinsResponse.data.balance || 0);
      } catch (err) {
        console.error('Failed to fetch coin balance:', err);
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

  // Validate coupon code
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    try {
      setValidatingCoupon(true);
      setCouponError('');
      
      const response = await api.post('/api/v1/gamification/coupons/validate', {
        code: couponCode.toUpperCase(),
        booking_amount: booking.total_amount
      });

      if (response.data.success && response.data.valid) {
        setAppliedCoupon(response.data.coupon);
        setCouponError('');
        calculateFinalPrice(response.data.coupon, useCoins);
      } else {
        setCouponError(response.data.message || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (error) {
      setCouponError(error.response?.data?.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    calculateFinalPrice(null, useCoins);
  };

  const handleUseCoinsChange = (event) => {
    const checked = event.target.checked;
    setUseCoins(checked);
    calculateFinalPrice(appliedCoupon, checked);
  };

  // Calculate final price with all discounts
  const calculateFinalPrice = async (coupon, applyCoins) => {
    if (!booking) return;

    try {
      const response = await api.post('/api/v1/gamification/calculate-price', {
        booking_id: bookingId,
        base_amount: booking.total_amount,
        coupon_code: coupon?.code || null,
        use_coins: applyCoins,
        coins_to_redeem: applyCoins ? Math.min(coinBalance, booking.total_amount) : 0
      });

      if (response.data.success) {
        setCalculatedPrice(response.data.pricing);
      }
    } catch (error) {
      console.error('Failed to calculate price:', error);
    }
  };

  // Recalculate price when booking, coupon, or coins change
  useEffect(() => {
    if (booking) {
      calculateFinalPrice(appliedCoupon, useCoins);
    }
  }, [booking, appliedCoupon, useCoins]);

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
          } catch (error_) {
            console.error('Payment verification failed:', error_);
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

      const rzp = new globalThis.Razorpay(options);
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

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography color="text.secondary">Base Price:</Typography></Grid>
                  <Grid item xs={6}><Typography>₹{calculatedPrice?.base_amount || booking.total_amount || 0}</Typography></Grid>

                  {calculatedPrice?.coupon_discount > 0 && (
                    <>
                      <Grid item xs={6}>
                        <Typography color="text.secondary">
                          Coupon Discount ({appliedCoupon?.code})
                        </Typography>
                      </Grid>
                      <Grid item xs={6}><Typography color="success.main">-₹{calculatedPrice.coupon_discount}</Typography></Grid>
                    </>
                  )}

                  {calculatedPrice?.coins_discount > 0 && (
                    <>
                      <Grid item xs={6}>
                        <Typography color="text.secondary">Coins Discount ({calculatedPrice.coins_redeemed} coins)</Typography>
                      </Grid>
                      <Grid item xs={6}><Typography color="success.main">-₹{calculatedPrice.coins_discount}</Typography></Grid>
                    </>
                  )}

                  {calculatedPrice?.total_discount > 0 && (
                    <>
                      <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                      <Grid item xs={6}><Typography fontWeight="600">Total Savings:</Typography></Grid>
                      <Grid item xs={6}><Typography fontWeight="600" color="success.main">₹{calculatedPrice.total_discount}</Typography></Grid>
                    </>
                  )}

                  <Grid item xs={12}><Divider sx={{ my: 1.5 }} /></Grid>

                  <Grid item xs={6}><Typography variant="h6">Final Amount:</Typography></Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" color="primary">
                      ₹{calculatedPrice?.final_amount || booking.total_amount || 0}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Coupon Code Section */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <LocalOffer sx={{ mr: 0.5, fontSize: 18 }} />
                  Have a Coupon Code?
                </Typography>
                
                {appliedCoupon ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Chip
                      icon={<CheckCircle />}
                      label={`${appliedCoupon.code} applied! Saved ₹${calculatedPrice?.coupon_discount || 0}`}
                      color="success"
                      sx={{ fontWeight: 600 }}
                    />
                    <IconButton size="small" onClick={handleRemoveCoupon} color="error">
                      <Cancel />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      error={Boolean(couponError)}
                      helperText={couponError}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocalOffer fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCoupon();
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      sx={{ minWidth: 100 }}
                    >
                      {validatingCoupon ? <CircularProgress size={20} /> : 'Apply'}
                    </Button>
                  </Box>
                )}
              </Paper>

              {/* Use Coins Section */}
              {coinBalance > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: alpha('#FFD700', 0.1) }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useCoins}
                        onChange={handleUseCoinsChange}
                        icon={<MonetizationOn />}
                        checkedIcon={<MonetizationOn />}
                        sx={{
                          color: '#FFA500',
                          '&.Mui-checked': {
                            color: '#FFD700',
                          },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          Use {Math.min(coinBalance, calculatedPrice?.final_amount || booking.total_amount || 0)} Coins
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          You have {coinBalance.toLocaleString()} coins available (1 coin = ₹1 discount)
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              )}

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
                {paying ? 'Processing...' : `Pay ₹${calculatedPrice?.final_amount || booking.total_amount || 0}`}
              </Button>
              
              {calculatedPrice?.total_discount > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  🎉 You're saving ₹{calculatedPrice.total_discount} on this booking!
                </Alert>
              )}
            </Box>
          )}
        </Paper>
      </Container>
    </Layout>
  );
}
