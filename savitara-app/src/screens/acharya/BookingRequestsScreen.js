import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator, Searchbar, Divider, Avatar } from 'react-native-paper';
import { bookingAPI } from '../../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BookingRequestsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchQuery, selectedFilter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await bookingAPI.getAcharyaBookings({});
      const bookingData = response.data?.data || response.data?.bookings || [];
      setBookings(bookingData);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const filterBookings = () => {
    let filtered = [...bookings];

    // Filter by status
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(b => b.status === selectedFilter);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.grihasta_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pooja_type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
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

  const getStatusIcon = (status) => {
    const icons = {
      pending: 'clock-outline',
      confirmed: 'check-circle-outline',
      in_progress: 'play-circle-outline',
      completed: 'check-circle',
      cancelled: 'close-circle-outline'
    };
    return icons[status] || 'help-circle-outline';
  };

  const filters = [
    { value: 'all', label: 'All', count: bookings.length },
    { value: 'pending', label: 'Pending', count: bookings.filter(b => b.status === 'pending').length },
    { value: 'confirmed', label: 'Confirmed', count: bookings.filter(b => b.status === 'confirmed').length },
    { value: 'in_progress', label: 'In Progress', count: bookings.filter(b => b.status === 'in_progress').length },
    { value: 'completed', label: 'Completed', count: bookings.filter(b => b.status === 'completed').length },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          My Bookings
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage your consultations
        </Text>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search bookings..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        icon={() => <Icon name="magnify" size={24} color="#666" />}
      />

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map(filter => (
          <Chip
            key={filter.value}
            selected={selectedFilter === filter.value}
            onPress={() => setSelectedFilter(filter.value)}
            style={[
              styles.filterChip,
              selectedFilter === filter.value && styles.filterChipSelected
            ]}
            textStyle={selectedFilter === filter.value && styles.filterChipTextSelected}
          >
            {filter.label} ({filter.count})
          </Chip>
        ))}
      </ScrollView>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text variant="headlineSmall" style={styles.statNumber}>
            {bookings.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Total
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FFF3E0' }]}>
          <Text variant="headlineSmall" style={[styles.statNumber, { color: '#F57C00' }]}>
            {bookings.filter(b => b.status === 'pending').length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Pending
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#E3F2FD' }]}>
          <Text variant="headlineSmall" style={[styles.statNumber, { color: '#1976D2' }]}>
            {bookings.filter(b => b.status === 'confirmed').length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Confirmed
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#E8F5E9' }]}>
          <Text variant="headlineSmall" style={[styles.statNumber, { color: '#388E3C' }]}>
            {bookings.filter(b => b.status === 'completed').length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Completed
          </Text>
        </View>
      </View>

      {/* Bookings List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
        }
      >
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-blank" size={80} color="#ccc" />
            <Text variant="titleMedium" style={styles.emptyText}>
              No bookings found
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              {selectedFilter !== 'all' ? `No ${selectedFilter} bookings` : 'You don\'t have any bookings yet'}
            </Text>
          </View>
        ) : (
          filteredBookings.map((booking) => (
            <Card key={booking._id || booking.id} style={styles.card} mode="elevated">
              <Card.Content>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <Text variant="titleLarge" style={styles.cardTitle}>
                      {booking.pooja_type || 'Consultation'}
                    </Text>
                    <Chip
                      icon={() => <Icon name={getStatusIcon(booking.status)} size={16} color="#fff" />}
                      style={{ backgroundColor: getStatusColor(booking.status) }}
                      textStyle={{ color: '#fff', fontSize: 11 }}
                    >
                      {booking.status?.replace('_', ' ').toUpperCase()}
                    </Chip>
                  </View>
                  <Text variant="headlineSmall" style={styles.amount}>
                    ₹{booking.total_amount || booking.amount}
                  </Text>
                </View>

                <Divider style={styles.divider} />

                {/* Grihasta Info */}
                <View style={styles.infoRow}>
                  <Avatar.Icon size={40} icon={() => <Icon name="account" size={24} color="#fff" />} style={styles.avatar} />
                  <View style={styles.infoText}>
                    <Text variant="bodySmall" style={styles.infoLabel}>
                      Grihasta
                    </Text>
                    <Text variant="titleSmall" style={styles.infoValue}>
                      {booking.grihasta_name || 'Unknown'}
                    </Text>
                  </View>
                </View>

                {/* Date & Time */}
                <View style={styles.infoRow}>
                  <Icon name="calendar" size={20} color="#666" />
                  <Text variant="bodyMedium" style={styles.infoTextOnly}>
                    {new Date(booking.scheduled_datetime || booking.booking_date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Icon name="clock-outline" size={20} color="#666" />
                  <Text variant="bodyMedium" style={styles.infoTextOnly}>
                    {new Date(booking.scheduled_datetime || booking.booking_date).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • {booking.duration_hours || 1} hours
                  </Text>
                </View>

                {/* Location */}
                <View style={styles.infoRow}>
                  {booking.booking_type === 'virtual' || booking.is_virtual ? (
                    <>
                      <Icon name="video" size={20} color="#666" />
                      <Text variant="bodyMedium" style={styles.infoTextOnly}>
                        Virtual Consultation
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon name="map-marker" size={20} color="#666" />
                      <Text variant="bodyMedium" style={styles.infoTextOnly} numberOfLines={1}>
                        {booking.location || 'In Person'}
                      </Text>
                    </>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  {booking.status === 'confirmed' && (
                    <Button
                      mode="contained"
                      onPress={() => navigation.navigate('StartBooking', { booking })}
                      style={styles.primaryButton}
                      icon={() => <Icon name="play" size={20} color="#fff" />}
                    >
                      Start Session
                    </Button>
                  )}

                  {booking.status === 'in_progress' && (
                    <Button
                      mode="contained"
                      onPress={() => navigation.navigate('AttendanceConfirm', { booking })}
                      style={[styles.primaryButton, { backgroundColor: '#4CAF50' }]}
                      icon={() => <Icon name="check-circle" size={20} color="#fff" />}
                    >
                      Mark Complete
                    </Button>
                  )}

                  {booking.status === 'pending' && (
                    <Button
                      mode="outlined"
                      style={styles.outlinedButton}
                      textColor="#666"
                    >
                      Awaiting Confirmation
                    </Button>
                  )}

                  {booking.status === 'completed' && (
                    <Button
                      mode="outlined"
                      style={styles.outlinedButton}
                      textColor="#4CAF50"
                      icon={() => <Icon name="check-circle" size={20} color="#4CAF50" />}
                    >
                      Completed
                    </Button>
                  )}
                </View>
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
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  title: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
  },
  filterContainer: {
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterChip: {
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: '#FF6B35',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontWeight: 'bold',
    color: '#333',
  },
  amount: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    backgroundColor: '#FF6B35',
  },
  infoText: {
    marginLeft: 12,
  },
  infoLabel: {
    color: '#666',
    fontSize: 11,
  },
  infoValue: {
    color: '#333',
    fontWeight: '600',
  },
  infoTextOnly: {
    marginLeft: 12,
    color: '#333',
  },
  buttonContainer: {
    marginTop: 16,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
  },
  outlinedButton: {
    borderColor: '#ddd',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#999',
  },
});

export default BookingRequestsScreen;
