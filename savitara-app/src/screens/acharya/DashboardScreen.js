import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { bookingAPI } from '../../services/api';

const DashboardScreen = () => {
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    completed: 0,
    totalEarnings: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await bookingAPI.getAcharyaBookings({ limit: 5 });
      const bookings = response.data.bookings || [];
      
      setRecentBookings(bookings);
      
      const pending = bookings.filter(b => b.status === 'pending').length;
      const confirmed = bookings.filter(b => b.status === 'confirmed').length;
      const completed = bookings.filter(b => b.status === 'completed').length;
      const totalEarnings = bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + b.total_amount, 0);
      
      setStats({ pending, confirmed, completed, totalEarnings });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Dashboard
      </Text>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.pending}
            </Text>
            <Text variant="bodyMedium">Pending</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.confirmed}
            </Text>
            <Text variant="bodyMedium">Confirmed</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.completed}
            </Text>
            <Text variant="bodyMedium">Completed</Text>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, styles.earningsCard]}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.earnings}>
              ₹{stats.totalEarnings}
            </Text>
            <Text variant="bodyMedium">Total Earnings</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Recent Bookings
        </Text>
        {loading ? (
          <Text>Loading...</Text>
        ) : recentBookings.length === 0 ? (
          <Text>No recent bookings</Text>
        ) : (
          recentBookings.map((booking) => (
            <Card key={booking._id} style={styles.bookingCard}>
              <Card.Content>
                <Text variant="titleMedium">{booking.pooja_type}</Text>
                <Text variant="bodySmall">
                  Grihasta: {booking.grihasta_name}
                </Text>
                <Text variant="bodySmall">
                  📅 {new Date(booking.scheduled_datetime).toLocaleString()}
                </Text>
                <Text variant="bodySmall">Status: {booking.status}</Text>
                <Text style={styles.amount}>₹{booking.total_amount}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    marginBottom: 15,
  },
  earningsCard: {
    width: '100%',
    backgroundColor: '#FF6B35',
  },
  statNumber: {
    fontWeight: 'bold',
  },
  earnings: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    marginBottom: 15,
    fontWeight: 'bold',
  },
  bookingCard: {
    marginBottom: 15,
  },
  amount: {
    marginTop: 5,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
});

export default DashboardScreen;
