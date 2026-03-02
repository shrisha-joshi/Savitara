import React, { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import PropTypes from 'prop-types';
import { bookingAPI } from '../../services/api';

const StartBookingScreen = ({ route, navigation }) => {
  const { booking } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartBooking = async () => {
    try {
      setLoading(true);
      await bookingAPI.startBooking(booking._id, otp);
      Alert.alert('Success', 'Booking started successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to start booking:', error);
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Start Booking
      </Text>

      <Text variant="bodyLarge" style={styles.subtitle}>
        Enter the OTP provided by the Grihasta to start the service
      </Text>

      <View style={styles.bookingInfo}>
        <Text variant="titleMedium">{booking.pooja_type}</Text>
        <Text>Grihasta: {booking.grihasta_name}</Text>
        <Text>Duration: {booking.duration_hours} hours</Text>
        <Text>Amount: ₹{booking.total_amount}</Text>
      </View>

      <TextInput
        label="Enter OTP"
        value={otp}
        onChangeText={setOtp}
        style={styles.input}
        keyboardType="numeric"
        maxLength={6}
      />

      <Button 
        mode="contained" 
        onPress={handleStartBooking}
        loading={loading}
        disabled={loading || otp.length !== 6}
        style={styles.button}
      >
        Start Service
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 10,
    color: '#FF6B35',
  },
  subtitle: {
    marginBottom: 20,
    color: '#666',
  },
  bookingInfo: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
  },
  input: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FF6B35',
  },
});

StartBookingScreen.propTypes = {
  navigation: PropTypes.shape({
    goBack: PropTypes.func.isRequired,
  }).isRequired,
  route: PropTypes.shape({
    params: PropTypes.shape({
      booking: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        pooja_type: PropTypes.string,
        grihasta_name: PropTypes.string,
        duration_hours: PropTypes.number,
        total_amount: PropTypes.number,
      }).isRequired,
    }).isRequired,
  }).isRequired,
};

export default StartBookingScreen;
