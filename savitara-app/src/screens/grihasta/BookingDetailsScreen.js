import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Divider, Chip } from 'react-native-paper';
import { bookingAPI, reviewAPI } from '../../services/api';

const BookingDetailsScreen = ({ route, navigation }) => {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooking();
  }, []);

  const loadBooking = async () => {
    try {
      const response = await bookingAPI.getBooking(bookingId);
      setBooking(response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAttendance = async () => {
    try {
      await bookingAPI.confirmAttendance(bookingId, { 
        attended: true,
        feedback: 'Confirmed attendance' 
      });
      alert('Attendance confirmed!');
      loadBooking();
    } catch (error) {
      console.error('Failed to confirm attendance:', error);
      alert(error.response?.data?.message || 'Failed to confirm attendance');
    }
  };

  if (loading || !booking) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#FFA726',
      confirmed: '#42A5F5',
      in_progress: '#66BB6A',
      completed: '#4CAF50',
      cancelled: '#EF5350',
    };
    return colors[status] || '#999';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall">{booking.pooja_type}</Text>
        <Chip 
          style={{ backgroundColor: getStatusColor(booking.status) }}
          textStyle={{ color: '#fff' }}
        >
          {booking.status}
        </Chip>
      </View>

      <Divider />

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Acharya Details</Text>
        <Text variant="bodyLarge">{booking.acharya_name}</Text>
        <Button 
          mode="text" 
          onPress={() => navigation.navigate('Conversation', { 
            conversationId: booking.conversation_id 
          })}
          style={styles.chatButton}
        >
          Message Acharya
        </Button>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Booking Details</Text>
        <View style={styles.detailRow}>
          <Text>Type:</Text>
          <Text>{booking.booking_type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Date & Time:</Text>
          <Text>{new Date(booking.scheduled_datetime).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Duration:</Text>
          <Text>{booking.duration_hours} hours</Text>
        </View>
        {booking.booking_type === 'in_person' && (
          <View style={styles.detailRow}>
            <Text>Location:</Text>
            <Text style={styles.locationText}>{booking.location}</Text>
          </View>
        )}
        {booking.special_requirements && (
          <View style={styles.detailRow}>
            <Text>Special Requirements:</Text>
            <Text style={styles.locationText}>{booking.special_requirements}</Text>
          </View>
        )}
      </View>

      {booking.otp && booking.status === 'confirmed' && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>OTP</Text>
          <Text variant="headlineMedium" style={styles.otp}>{booking.otp}</Text>
          <Text variant="bodySmall">Share this OTP with the Acharya to start the service</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Payment</Text>
        <View style={styles.detailRow}>
          <Text>Total Amount:</Text>
          <Text style={styles.amount}>₹{booking.total_amount}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text>Payment Status:</Text>
          <Text>{booking.payment_status}</Text>
        </View>
      </View>

      {booking.status === 'completed' && !booking.attendance_confirmation?.grihasta_confirmed && (
        <Button 
          mode="contained" 
          onPress={handleConfirmAttendance}
          style={styles.button}
        >
          Confirm Attendance
        </Button>
      )}

      {booking.status === 'completed' && booking.attendance_confirmation?.grihasta_confirmed && (
        <Button 
          mode="contained" 
          onPress={() => {/* Navigate to review screen */}}
          style={styles.button}
        >
          Write Review
        </Button>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  locationText: {
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  otp: {
    textAlign: 'center',
    color: '#FF6B35',
    fontWeight: 'bold',
    marginVertical: 10,
  },
  amount: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  chatButton: {
    marginTop: 10,
  },
  button: {
    margin: 20,
    backgroundColor: '#FF6B35',
  },
});

export default BookingDetailsScreen;
