import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { bookingAPI } from '../../services/api';
import { RAZORPAY_KEY_ID } from '../../config/api.config';

const PaymentScreen = ({ route, navigation }) => {
  const { booking } = route.params;
  const [loading, setLoading] = useState(true);
  const [paymentOrder, setPaymentOrder] = useState(null);

  useEffect(() => {
    // In a real app, payment order would be created by backend
    // Here we simulate it
    setTimeout(() => {
      setPaymentOrder({
        order_id: `order_${Date.now()}`,
        amount: booking.total_amount,
      });
      setLoading(false);
    }, 1000);
  }, []);

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      // In a real app, integrate Razorpay SDK
      // For now, simulate successful payment
      alert('Payment integration pending. In production, Razorpay SDK will handle payment.');
      
      // Simulate payment success
      const paymentData = {
        razorpay_order_id: paymentOrder.order_id,
        razorpay_payment_id: `pay_${Date.now()}`,
        razorpay_signature: 'dummy_signature',
      };
      
      // Update booking with payment info (handled by backend)
      navigation.navigate('BookingDetails', { bookingId: booking._id });
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !paymentOrder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Preparing payment...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Complete Payment
      </Text>

      <View style={styles.bookingDetails}>
        <Text variant="titleMedium">Booking Details</Text>
        <View style={styles.detailRow}>
          <Text>Acharya:</Text>
          <Text>{booking.acharya_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Service:</Text>
          <Text>{booking.pooja_type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Date:</Text>
          <Text>{new Date(booking.scheduled_datetime).toLocaleDateString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Duration:</Text>
          <Text>{booking.duration_hours} hours</Text>
        </View>
        <View style={styles.detailRow}>
          <Text variant="titleMedium">Total Amount:</Text>
          <Text variant="titleMedium" style={styles.amount}>
            ₹{booking.total_amount}
          </Text>
        </View>
      </View>

      <View style={styles.paymentInfo}>
        <Text variant="titleMedium">Payment Information</Text>
        <Text variant="bodySmall" style={styles.note}>
          Your payment is secure and encrypted. You will be charged only after the service is completed.
        </Text>
      </View>

      <Button 
        mode="contained" 
        onPress={handlePayment}
        loading={loading}
        disabled={loading}
        style={styles.button}
        icon="credit-card"
      >
        Pay ₹{booking.total_amount}
      </Button>

      <Button 
        mode="text" 
        onPress={() => navigation.goBack()}
        style={styles.cancelButton}
      >
        Cancel
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
  },
  bookingDetails: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  amount: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  paymentInfo: {
    marginBottom: 20,
  },
  note: {
    marginTop: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    marginBottom: 10,
    backgroundColor: '#FF6B35',
  },
  cancelButton: {
    marginBottom: 40,
  },
});

export default PaymentScreen;
