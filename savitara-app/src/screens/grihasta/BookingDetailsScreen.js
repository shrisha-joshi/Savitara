import * as Clipboard from 'expo-clipboard';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Divider, Text } from 'react-native-paper';
import { getStatusColor } from '../../constants/statusColors';
import { bookingAPI, chatAPI } from '../../services/api';

const BookingDetailsScreen = ({ route, navigation }) => {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    loadBooking();
  }, []);

  const loadBooking = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await bookingAPI.getBooking(bookingId);
      setBooking(response.data?.data || response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
      setLoadError('Could not load booking details. Please try again.');
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
      Alert.alert('Success', 'Attendance confirmed!');
      loadBooking();
    } catch (error) {
      console.error('Failed to confirm attendance:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || error.response?.data?.message || 'Failed to confirm attendance',
      );
    }
  };

  const handleStartConversation = async () => {
    setStartingChat(true);
    try {
      const response = await chatAPI.verifyConversation(
        booking.acharya_id || booking.acharya_user_id,
      );
      const conversationId = response.data?.data?.conversation_id || response.data?.conversation_id;
      navigation.navigate('Conversation', {
        conversationId,
        otherUserId: booking.acharya_id || booking.acharya_user_id,
        otherUserName: booking.acharya_name || 'Acharya',
      });
    } catch (error) {
      console.error('Could not start conversation:', error);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    } finally {
      setStartingChat(false);
    }
  };

  const handleCopyOtp = async () => {
    try {
      await Clipboard.setStringAsync(String(booking.otp));
      Alert.alert('Copied', 'OTP copied to clipboard.');
    } catch (error) {
      console.error('Could not copy OTP:', error);
      Alert.alert('Error', 'Could not copy OTP.');
    }
  };

  if (loading || !booking) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator animating size="large" color="#FF6B35" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centeredContainer}>
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.errorTitle}>Something went wrong</Text>
            <Text variant="bodyMedium" style={styles.errorMessage}>{loadError}</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={loadBooking} textColor="#FF6B35">Retry</Button>
            <Button onPress={() => navigation.goBack()} textColor="#888">Go Back</Button>
          </Card.Actions>
        </Card>
      </View>
    );
  }

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
        {booking.conversation_id ? (
          <Button 
            mode="text"
            icon="message-text"
            onPress={() => navigation.navigate('Conversation', { 
              conversationId: booking.conversation_id,
              otherUserId: booking.acharya_id || booking.acharya_user_id,
              otherUserName: booking.acharya_name || 'Acharya',
            })}
            style={styles.chatButton}
            textColor="#FF6B35"
          >
            Message Acharya
          </Button>
        ) : (
          <Button
            mode="outlined"
            icon="message-plus"
            onPress={handleStartConversation}
            loading={startingChat}
            disabled={startingChat}
            style={styles.chatButton}
            textColor="#FF6B35"
          >
            Start Conversation
          </Button>
        )}
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
          <View style={styles.otpRow}>
            <Text variant="headlineMedium" style={styles.otp}>{booking.otp}</Text>
            <Button
              mode="outlined"
              compact
              icon="content-copy"
              onPress={handleCopyOtp}
              style={styles.copyButton}
              textColor="#FF6B35"
            >
              Copy
            </Button>
          </View>
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
          icon="star-outline"
          onPress={() => navigation.navigate('WriteReview', {
            bookingId: booking._id || booking.id || bookingId,
            acharyaId: booking.acharya_id || booking.acharya_user_id,
            acharyaName: booking.acharya_name,
          })}
          style={styles.button}
          buttonColor="#FF6B35"
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    elevation: 2,
  },
  errorTitle: {
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#555',
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
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  otp: {
    textAlign: 'center',
    color: '#FF6B35',
    fontWeight: 'bold',
    marginVertical: 10,
    marginRight: 16,
    letterSpacing: 4,
  },
  copyButton: {
    borderColor: '#FF6B35',
  },
  amount: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  chatButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  button: {
    margin: 20,
    borderRadius: 24,
  },
});

BookingDetailsScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      bookingId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};

export default BookingDetailsScreen;
