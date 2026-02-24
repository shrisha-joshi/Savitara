import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, SegmentedButtons, Button, Snackbar } from 'react-native-paper';
import { bookingAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const MyBookingsScreen = ({ navigation }) => {
  const socketContext = useSocket();
  const { bookingUpdates = [], paymentNotifications = [], markPaymentNotificationRead } = socketContext || {};
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    loadBookings();
  }, [filter]);

  // Listen for WebSocket booking updates
  useEffect(() => {
    if (bookingUpdates.length > 0) {
      const latestUpdate = bookingUpdates[bookingUpdates.length - 1];
      // Refresh bookings when update received
      loadBookings();
      
      // Show notification
      if (latestUpdate.type === 'booking_update') {
        showSnackbar(latestUpdate.message || 'Booking status updated');
      }
    }
  }, [bookingUpdates]);

  // Listen for payment notifications
  useEffect(() => {
    if (paymentNotifications.length > 0) {
      const unreadNotifs = paymentNotifications.filter(n => !n.read);
      if (unreadNotifs.length > 0) {
        const latest = unreadNotifs[unreadNotifs.length - 1];
        Alert.alert(
          'Booking Approved!',
          `Amount: ₹${latest.amount}. Please complete payment.`,
          [
            { text: 'Later', style: 'cancel', onPress: () => markPaymentNotificationRead(latest.booking_id) },
            { 
              text: 'Pay Now', 
              onPress: () => {
                markPaymentNotificationRead(latest.booking_id);
                handlePayNow(latest.booking_id, latest.amount);
              }
            }
          ]
        );
      }
    }
  }, [paymentNotifications]);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handlePayNow = async (bookingId, amount) => {
    try {
      // Create payment order
      const response = await bookingAPI.createPaymentOrder(bookingId);
      if (response.data.success) {
        // Navigate to payment screen
        navigation.navigate('Payment', {
          booking: { id: bookingId, total_amount: amount },
          razorpayOrderId: response.data.data.razorpay_order_id
        });
      }
    } catch (error) {
      console.error('Payment order creation failed:', error);
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    }
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await bookingAPI.getMyBookings(params);
      setBookings(response.data.bookings || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      requested: '#42A5F5', // Blue for requested
      pending: '#FFA726',
      confirmed: '#42A5F5',
      in_progress: '#66BB6A',
      completed: '#4CAF50',
      cancelled: '#EF5350',
    };
    return colors[status] || '#999';
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={filter}
        onValueChange={setFilter}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'requested', label: 'Requested' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'completed', label: 'Completed' },
        ]}
        style={styles.filter}
      />

      <ScrollView style={styles.list}>
        {loading ? (
          <Text style={styles.centerText}>Loading...</Text>
        ) : bookings.length === 0 ? (
          <Text style={styles.centerText}>No bookings found</Text>
        ) : (
          bookings.map((booking) => (
            <Card 
              key={booking._id} 
              style={styles.card}
              onPress={() => navigation.navigate('BookingDetails', { bookingId: booking._id })}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium">{booking.pooja_type}</Text>
                  <Chip 
                    style={{ backgroundColor: getStatusColor(booking.status) }}
                    textStyle={{ color: '#fff' }}
                  >
                    {booking.status}
                  </Chip>
                </View>
                <Text variant="bodyMedium" style={styles.acharyaName}>
                  Acharya: {booking.acharya_name}
                </Text>
                <Text variant="bodySmall">
                  📅 {new Date(booking.scheduled_datetime).toLocaleString()}
                </Text>
                <Text variant="bodySmall">
                  ⏱️ {booking.duration_hours} hours
                </Text>
                <Text variant="bodySmall">
                  📍 {booking.booking_type === 'in_person' ? booking.location : 'Virtual'}
                </Text>
                <Text variant="titleSmall" style={styles.amount}>
                  ₹{booking.total_amount}
                </Text>
                
                {booking.status === 'confirmed' && booking.payment_status === 'pending' && (
                  <Button
                    mode="contained"
                    onPress={() => handlePayNow(booking._id || booking.id, booking.total_amount)}
                    style={styles.payButton}
                    buttonColor="#4CAF50"
                  >
                    Pay Now ₹{booking.total_amount}
                  </Button>
                )}
                
                {booking.status === 'requested' && (
                  <Text variant="bodySmall" style={styles.statusNote}>
                    ⏳ Awaiting Acharya confirmation
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: '#4CAF50' }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filter: {
    margin: 15,
  },
  list: {
    flex: 1,
    paddingHorizontal: 15,
  },
  card: {
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  acharyaName: {
    marginBottom: 5,
  },
  amount: {
    marginTop: 10,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  payButton: {
    marginTop: 10,
  },
  statusNote: {
    marginTop: 8,
    fontStyle: 'italic',
    color: '#666',
  },
  centerText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

export default MyBookingsScreen;
