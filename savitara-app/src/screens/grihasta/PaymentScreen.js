import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, Divider, Surface, Icon } from 'react-native-paper';
import RazorpayCheckout from 'react-native-razorpay';
import { bookingAPI } from '../../services/api';
import { RAZORPAY_KEY_ID } from '../../config/api.config';

/**
 * PaymentScreen
 *
 * Handles Razorpay checkout for both booking modes:
 *  - instant  → booking.razorpay_order_id is already set by the create-booking call
 *  - request  → order is created lazily via POST /{id}/create-payment-order
 *
 * Flow:
 *   1. Mount  → resolve order ID (from booking or from backend)
 *   2. User taps "Pay" → open Razorpay checkout
 *   3. Success → POST /{id}/payment/verify → show receipt → navigate to BookingDetails
 *   4. Failure → show error, allow retry
 */
const PaymentScreen = ({ route, navigation }) => {
  const { booking } = route.params;
  const bookingId = booking?._id || booking?.id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [orderLoading, setOrderLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState(
    booking?.razorpay_order_id || null
  );
  const [receipt, setReceipt] = useState(null); // set after successful verification

  // Guard against duplicate submissions while Razorpay sheet is open
  const paymentInFlight = useRef(false);

  // ── Resolve / create payment order ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const resolveOrder = async () => {
      // Instant-mode: order already on the booking object
      if (booking?.razorpay_order_id) {
        setRazorpayOrderId(booking.razorpay_order_id);
        setOrderLoading(false);
        return;
      }

      // Request-mode or order not yet created: call backend
      try {
        const res = await bookingAPI.createPaymentOrder(bookingId);
        if (!cancelled) {
          setRazorpayOrderId(res.data?.data?.razorpay_order_id);
          setOrderLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err.response?.data?.detail ||
            err.response?.data?.message ||
            'Could not create payment order. Please try again.';
          setOrderError(msg);
          setOrderLoading(false);
        }
      }
    };

    resolveOrder();
    return () => { cancelled = true; };
  }, [bookingId, booking?.razorpay_order_id]);

  // ── Open Razorpay checkout ─────────────────────────────────────────────────
  const handlePayment = async () => {
    if (paymentInFlight.current || paying) return;

    if (!razorpayOrderId) {
      Alert.alert('Error', 'Payment order not ready. Please wait and retry.');
      return;
    }

    if (!RAZORPAY_KEY_ID) {
      Alert.alert(
        'Configuration Error',
        'Razorpay key is not configured. Please contact support.'
      );
      return;
    }

    paymentInFlight.current = true;
    setPaying(true);

    const options = {
      description: `Booking for ${booking?.acharya_name || 'Acharya'}`,
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
      amount: String(Math.round((booking?.total_amount || 0) * 100)), // paise
      order_id: razorpayOrderId,
      name: 'Savitara',
      prefill: {
        name: booking?.grihasta_name || '',
        email: booking?.grihasta_email || '',
        contact: booking?.grihasta_phone || '',
      },
      theme: { color: '#FF6B35' },
    };

    try {
      const paymentResult = await RazorpayCheckout.open(options);
      // paymentResult: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      await verifyPayment(paymentResult);
    } catch (err) {
      // err.code === 2 means user cancelled the Razorpay sheet
      if (err?.code === 2) {
        Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
      } else {
        Alert.alert(
          'Payment Failed',
          err?.description || 'Payment could not be completed. Please try again.',
          [{ text: 'Retry' }, { text: 'Cancel', style: 'cancel' }]
        );
      }
    } finally {
      paymentInFlight.current = false;
      setPaying(false);
    }
  };

  // ── Verify payment signature with backend ──────────────────────────────────
  const verifyPayment = async ({ razorpay_payment_id, razorpay_order_id, razorpay_signature }) => {
    try {
      setPaying(true);
      const res = await bookingAPI.verifyPayment(bookingId, {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      });

      const verifiedBooking = res.data?.data || {};
      setReceipt({
        payment_id: razorpay_payment_id,
        amount: booking?.total_amount,
        booking_id: bookingId,
        acharya_name: booking?.acharya_name,
        service: booking?.pooja_type || booking?.service_name,
        paid_at: new Date().toLocaleString('en-IN'),
        booking: verifiedBooking,
      });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Payment was received but verification failed. Please contact support with your payment ID.';
      Alert.alert(
        'Verification Issue',
        `${msg}\n\nPayment ID: ${razorpay_payment_id}`,
        [{ text: 'OK' }]
      );
    } finally {
      setPaying(false);
    }
  };

  // ── Receipt screen (shown after successful verification) ───────────────────
  if (receipt) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.receiptContent}>
        <View style={styles.successIconWrap}>
          <Icon source="check-circle" size={72} color="#4CAF50" />
        </View>
        <Text variant="headlineSmall" style={styles.successTitle}>
          Payment Successful!
        </Text>

        <Surface style={styles.receiptCard} elevation={2}>
          <Text variant="titleMedium" style={styles.receiptTitle}>Receipt</Text>
          <Divider style={styles.divider} />
          <ReceiptRow label="Payment ID" value={receipt.payment_id} mono />
          <ReceiptRow label="Booking ID" value={receipt.booking_id} mono />
          <ReceiptRow label="Acharya"    value={receipt.acharya_name} />
          <ReceiptRow label="Service"    value={receipt.service} />
          <ReceiptRow label="Paid At"    value={receipt.paid_at} />
          <Divider style={styles.divider} />
          <ReceiptRow label="Amount Paid" value={`₹${receipt.amount}`} highlight />
        </Surface>

        <Button
          mode="contained"
          style={styles.button}
          icon="calendar-check"
          onPress={() =>
            navigation.replace('BookingDetails', { bookingId: receipt.booking_id })
          }
        >
          View Booking
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.navigate('MyBookingsScreen')}
        >
          Go to My Bookings
        </Button>
      </ScrollView>
    );
  }

  // ── Loading while resolving order ──────────────────────────────────────────
  if (orderLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Preparing payment...</Text>
      </View>
    );
  }

  // ── Order creation error ───────────────────────────────────────────────────
  if (orderError) {
    return (
      <View style={styles.centerContainer}>
        <Icon source="alert-circle-outline" size={48} color="#EF5350" />
        <Text style={styles.errorText}>{orderError}</Text>
        <Button
          mode="contained"
          style={[styles.button, { marginTop: 20 }]}
          onPress={() => navigation.goBack()}
        >
          Go Back
        </Button>
      </View>
    );
  }

  // ── Main payment screen ────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Complete Payment
      </Text>

      <Surface style={styles.bookingCard} elevation={1}>
        <Text variant="titleMedium" style={styles.cardTitle}>Booking Summary</Text>
        <Divider style={styles.divider} />
        <DetailRow label="Acharya" value={booking?.acharya_name} />
        <DetailRow label="Service" value={booking?.pooja_type || booking?.service_name} />
        {booking?.scheduled_datetime && (
          <DetailRow
            label="Date"
            value={new Date(booking.scheduled_datetime).toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            })}
          />
        )}
        {booking?.duration_hours != null && (
          <DetailRow label="Duration" value={`${booking.duration_hours} hr`} />
        )}
        <Divider style={styles.divider} />
        <DetailRow label="Total" value={`₹${booking?.total_amount ?? 0}`} highlight />
      </Surface>

      <View style={styles.secureRow}>
        <Icon source="shield-check" size={18} color="#4CAF50" />
        <Text variant="bodySmall" style={styles.secureText}>
          {'  '}Secured by Razorpay · 256-bit SSL encryption
        </Text>
      </View>

      <Button
        mode="contained"
        onPress={handlePayment}
        loading={paying}
        disabled={paying || !razorpayOrderId}
        style={styles.button}
        icon="credit-card"
      >
        {paying ? 'Processing...' : `Pay ₹${booking?.total_amount ?? 0}`}
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.goBack()}
        disabled={paying}
        style={styles.cancelButton}
      >
        Cancel
      </Button>
    </ScrollView>
  );
};

// ── Helper row components ──────────────────────────────────────────────────
const DetailRow = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text variant={highlight ? 'titleMedium' : 'bodyMedium'}>{label}</Text>
    <Text
      variant={highlight ? 'titleMedium' : 'bodyMedium'}
      style={highlight ? styles.highlightValue : null}
    >
      {value ?? '—'}
    </Text>
  </View>
);

const ReceiptRow = ({ label, value, highlight, mono }) => (
  <View style={styles.detailRow}>
    <Text variant="bodySmall" style={styles.receiptLabel}>{label}</Text>
    <Text
      variant={highlight ? 'titleMedium' : 'bodySmall'}
      style={[mono && styles.monoText, highlight && styles.highlightValue]}
      numberOfLines={1}
      ellipsizeMode="middle"
    >
      {value ?? '—'}
    </Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  receiptContent: {
    alignItems: 'center',
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    color: '#EF5350',
    textAlign: 'center',
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  successIconWrap: {
    marginBottom: 12,
  },
  successTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 24,
  },
  bookingCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  receiptCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#fff',
    width: '100%',
  },
  cardTitle: {
    marginBottom: 8,
  },
  receiptTitle: {
    marginBottom: 8,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  highlightValue: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  receiptLabel: {
    color: '#888',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#444',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  secureText: {
    color: '#4CAF50',
  },
  button: {
    marginBottom: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
  },
  cancelButton: {
    marginBottom: 40,
  },
});

export default PaymentScreen;
