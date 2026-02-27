import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Chip, Dialog, Divider, Provider as PaperProvider, Portal, Searchbar, Text, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSocket } from '../../context/SocketContext';
import { bookingAPI } from '../../services/api';

const BookingRequestsScreen = ({ navigation }) => {
  const socketContext = useSocket();
  const { bookingUpdates = [] } = socketContext || {};
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [acharyaList, setAcharyaList] = useState([]);

  // Accept dialog state
  const [acceptDialog, setAcceptDialog] = useState({ visible: false, booking: null });
  const [acceptAmount, setAcceptAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Refer dialog state
  const [referDialog, setReferDialog] = useState({ visible: false, booking: null });
  const [selectedAcharya, setSelectedAcharya] = useState('');
  const [referNotes, setReferNotes] = useState('');

  useEffect(() => {
    loadBookings();
    loadAcharyas();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchQuery, selectedFilter]);

  // Listen for WebSocket booking updates
  useEffect(() => {
    if (bookingUpdates.length > 0) {
      loadBookings();
    }
  }, [bookingUpdates]);

  const loadAcharyas = async () => {
    try {
      const list = await bookingAPI.fetchAcharyas();
      setAcharyaList(list);
    } catch (error) {
      console.error('Failed to load acharyas:', error);
    }
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await bookingAPI.getAcharyaBookings({});
      const raw = response.data?.data;
      const bookingData = Array.isArray(raw) ? raw : (raw?.bookings || response.data?.bookings || []);
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
      if (selectedFilter === 'requested') {
        filtered = filtered.filter(b => b.status === 'requested');
      } else {
        filtered = filtered.filter(b => b.status === selectedFilter);
      }
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.grihasta_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pooja_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pooja_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  };

  // ==================== ACTIONS ====================

  const handleAcceptBooking = async () => {
    if (!acceptDialog.booking) return;
    setActionLoading(true);
    try {
      const bookingId = acceptDialog.booking._id || acceptDialog.booking.id;
      await bookingAPI.updateBookingStatus(bookingId, {
        status: 'confirmed',
        amount: acceptAmount ? parseFloat(acceptAmount) : undefined,
        notes: 'Request approved by Acharya',
      });
      Alert.alert('Success', 'Booking request accepted! Grihasta will be notified to pay.');
      setAcceptDialog({ visible: false, booking: null });
      setAcceptAmount('');
      await loadBookings();
    } catch (error) {
      console.error('Accept failed:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBooking = (booking) => {
    const bookingId = booking._id || booking.id;
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline this booking from ${booking.grihasta_name || 'the Grihasta'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await bookingAPI.updateBookingStatus(bookingId, {
                status: 'rejected',
                notes: 'Request declined by Acharya',
              });
              Alert.alert('Done', 'Booking request declined.');
              await loadBookings();
            } catch (error) {
              console.error('Reject failed:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to decline booking');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReferBooking = async () => {
    if (!selectedAcharya || !referDialog.booking) return;
    setActionLoading(true);
    try {
      const bookingId = referDialog.booking._id || referDialog.booking.id;
      await bookingAPI.referBooking(bookingId, selectedAcharya, referNotes);
      Alert.alert('Success', 'Booking referred to another Acharya.');
      setReferDialog({ visible: false, booking: null });
      setSelectedAcharya('');
      setReferNotes('');
      await loadBookings();
    } catch (error) {
      console.error('Refer failed:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to refer booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = (booking) => {
    const bookingId = booking._id || booking.id;
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingAPI.updateBookingStatus(bookingId, {
                status: 'cancelled',
                notes: 'Cancelled by Acharya',
              });
              Alert.alert('Done', 'Booking cancelled.');
              await loadBookings();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  // ==================== UI HELPERS ====================

  const getStatusColor = (status) => {
    const colors = {
      requested: '#2196F3',
      pending_payment: '#FFA726',
      pending: '#FFA726',
      confirmed: '#42A5F5',
      in_progress: '#66BB6A',
      completed: '#4CAF50',
      cancelled: '#EF5350',
      rejected: '#EF5350',
    };
    return colors[status] || '#999';
  };

  const getStatusIcon = (status) => {
    const icons = {
      requested: 'clock-alert-outline',
      pending_payment: 'clock-outline',
      pending: 'clock-outline',
      confirmed: 'check-circle-outline',
      in_progress: 'play-circle-outline',
      completed: 'check-circle',
      cancelled: 'close-circle-outline',
      rejected: 'close-circle-outline',
    };
    return icons[status] || 'help-circle-outline';
  };

  const filters = [
    { value: 'all', label: 'All', count: bookings.length },
    { value: 'requested', label: 'Requests', count: bookings.filter(b => b.status === 'requested').length },
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
    <PaperProvider>
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
              textStyle={selectedFilter === filter.value ? styles.filterChipTextSelected : undefined}
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
            <Text variant="bodySmall" style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#E3F2FD' }]}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#1976D2' }]}>
              {bookings.filter(b => b.status === 'requested').length}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>Requests</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#E8F5E9' }]}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#388E3C' }]}>
              {bookings.filter(b => b.status === 'confirmed').length}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FFF3E0' }]}>
            <Text variant="headlineSmall" style={[styles.statNumber, { color: '#F57C00' }]}>
              {bookings.filter(b => b.status === 'completed').length}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>Completed</Text>
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
                        {booking.pooja_name || booking.pooja_type || 'Consultation'}
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
                      ₹{booking.total_amount || booking.amount || 0}
                    </Text>
                  </View>

                  <Divider style={styles.divider} />

                  {/* Grihasta Info */}
                  <View style={styles.infoRow}>
                    <Avatar.Icon size={40} icon="account" style={styles.avatar} />
                    <View style={styles.infoText}>
                      <Text variant="bodySmall" style={styles.infoLabel}>Grihasta</Text>
                      <Text variant="titleSmall" style={styles.infoValue}>
                        {booking.grihasta_name || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Time */}
                  <View style={styles.infoRow}>
                    <Icon name="calendar" size={20} color="#666" />
                    <Text variant="bodyMedium" style={styles.infoTextOnly}>
                      {new Date(booking.scheduled_datetime || booking.date_time).toLocaleDateString('en-IN', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Icon name="clock-outline" size={20} color="#666" />
                    <Text variant="bodyMedium" style={styles.infoTextOnly}>
                      {new Date(booking.scheduled_datetime || booking.date_time).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit'
                      })} • {booking.duration_hours || 1} hours
                    </Text>
                  </View>

                  {/* Requirements (for request bookings) */}
                  {booking.requirements && (
                    <View style={styles.infoRow}>
                      <Icon name="text-box-outline" size={20} color="#666" />
                      <Text variant="bodyMedium" style={styles.infoTextOnly} numberOfLines={2}>
                        {booking.requirements}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    {/* REQUESTED — Accept / Reject / Refer */}
                    {booking.status === 'requested' && (
                      <>
                        <Button
                          mode="contained"
                          onPress={() => {
                            setAcceptDialog({ visible: true, booking });
                            setAcceptAmount(String(booking.total_amount || ''));
                          }}
                          style={[styles.primaryButton, { backgroundColor: '#4CAF50' }]}
                          icon="check-circle"
                        >
                          Accept
                        </Button>
                        <View style={styles.buttonRow}>
                          <Button
                            mode="outlined"
                            onPress={() => handleRejectBooking(booking)}
                            style={[styles.halfButton, { borderColor: '#EF5350' }]}
                            textColor="#EF5350"
                            icon="close-circle"
                          >
                            Decline
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={() => setReferDialog({ visible: true, booking })}
                            style={[styles.halfButton, { borderColor: '#2196F3' }]}
                            textColor="#2196F3"
                            icon="account-arrow-right"
                          >
                            Refer
                          </Button>
                        </View>
                      </>
                    )}

                    {/* CONFIRMED — Start Session / Cancel */}
                    {booking.status === 'confirmed' && (
                      <>
                        <Button
                          mode="contained"
                          onPress={() => navigation.navigate('StartBooking', { booking })}
                          style={styles.primaryButton}
                          icon="play"
                        >
                          Start Session
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => handleCancelBooking(booking)}
                          style={{ borderColor: '#EF5350' }}
                          textColor="#EF5350"
                          icon="close"
                        >
                          Cancel
                        </Button>
                      </>
                    )}

                    {/* IN_PROGRESS — Mark Complete */}
                    {booking.status === 'in_progress' && (
                      <Button
                        mode="contained"
                        onPress={() => navigation.navigate('AttendanceConfirm', { booking })}
                        style={[styles.primaryButton, { backgroundColor: '#4CAF50' }]}
                        icon="check-circle"
                      >
                        Mark Complete
                      </Button>
                    )}

                    {/* COMPLETED */}
                    {booking.status === 'completed' && (
                      <Button
                        mode="outlined"
                        style={styles.outlinedButton}
                        textColor="#4CAF50"
                        icon="check-circle"
                        disabled
                      >
                        Completed
                      </Button>
                    )}

                    {/* PENDING PAYMENT */}
                    {booking.status === 'pending_payment' && (
                      <Button
                        mode="outlined"
                        style={styles.outlinedButton}
                        textColor="#FFA726"
                        icon="clock-outline"
                        disabled
                      >
                        Awaiting Payment
                      </Button>
                    )}
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>

        {/* ==================== Accept Dialog ==================== */}
        <Portal>
          <Dialog visible={acceptDialog.visible} onDismiss={() => setAcceptDialog({ visible: false, booking: null })}>
            <Dialog.Title>Accept Booking Request</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
                This will approve the request and notify the Grihasta to proceed with payment.
              </Text>
              {acceptDialog.booking && (
                <Text variant="bodySmall" style={{ color: '#666', marginBottom: 12 }}>
                  {acceptDialog.booking.pooja_name || acceptDialog.booking.pooja_type || 'Consultation'} — {acceptDialog.booking.grihasta_name || 'Grihasta'}
                </Text>
              )}
              <TextInput
                label="Confirmed Amount (₹)"
                value={acceptAmount}
                onChangeText={setAcceptAmount}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 8 }}
              />
              <Text variant="bodySmall" style={{ color: '#888' }}>
                You can adjust the final amount before accepting.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAcceptDialog({ visible: false, booking: null })}>Cancel</Button>
              <Button
                mode="contained"
                onPress={handleAcceptBooking}
                loading={actionLoading}
                disabled={actionLoading}
                style={{ backgroundColor: '#4CAF50' }}
              >
                Confirm Accept
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* ==================== Refer Dialog ==================== */}
        <Portal>
          <Dialog visible={referDialog.visible} onDismiss={() => setReferDialog({ visible: false, booking: null })}>
            <Dialog.Title>Refer/Pass Booking</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                Select another Acharya to refer this booking. The new Acharya will be notified.
              </Text>
              {acharyaList.length > 0 ? (
                <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
                  {acharyaList
                    .filter(a => a._id !== referDialog.booking?.acharya_id)
                    .map(a => (
                      <Button
                        key={a._id}
                        mode={selectedAcharya === a._id ? 'contained' : 'outlined'}
                        onPress={() => setSelectedAcharya(a._id)}
                        style={{ marginBottom: 6 }}
                        compact
                      >
                        {a.full_name || a.name}
                      </Button>
                    ))
                  }
                </ScrollView>
              ) : (
                <Text variant="bodySmall" style={{ color: '#999', marginBottom: 12 }}>
                  No other Acharyas available.
                </Text>
              )}
              <TextInput
                label="Notes (optional)"
                value={referNotes}
                onChangeText={setReferNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setReferDialog({ visible: false, booking: null }); setSelectedAcharya(''); setReferNotes(''); }}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleReferBooking}
                loading={actionLoading}
                disabled={!selectedAcharya || actionLoading}
              >
                Confirm Refer
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </PaperProvider>
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: {
    flex: 1,
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
