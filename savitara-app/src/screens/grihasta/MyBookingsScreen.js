import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Chip, SegmentedButtons } from 'react-native-paper';
import { bookingAPI } from '../../services/api';

const MyBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [filter]);

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
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
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
  centerText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

export default MyBookingsScreen;
