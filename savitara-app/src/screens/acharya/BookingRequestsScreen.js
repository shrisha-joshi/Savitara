import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import { bookingAPI } from '../../services/api';

const BookingRequestsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const response = await bookingAPI.getAcharyaBookings({});
      setBookings(response.data.bookings || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <Text variant="headlineSmall" style={styles.title}>
        Booking Requests
      </Text>

      {loading ? (
        <Text style={styles.centerText}>Loading...</Text>
      ) : bookings.length === 0 ? (
        <Text style={styles.centerText}>No bookings yet</Text>
      ) : (
        bookings.map((booking) => (
          <Card key={booking._id} style={styles.card}>
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
              
              <Text variant="bodyMedium" style={styles.grihastaName}>
                Grihasta: {booking.grihasta_name}
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

              {booking.status === 'confirmed' && (
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('StartBooking', { booking })}
                  style={styles.button}
                >
                  Start Booking
                </Button>
              )}

              {booking.status === 'in_progress' && (
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('AttendanceConfirm', { booking })}
                  style={styles.button}
                >
                  Confirm Completion
                </Button>
              )}
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
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
  grihastaName: {
    marginBottom: 5,
  },
  amount: {
    marginTop: 10,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  button: {
    marginTop: 10,
    backgroundColor: '#FF6B35',
  },
  centerText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

export default BookingRequestsScreen;
