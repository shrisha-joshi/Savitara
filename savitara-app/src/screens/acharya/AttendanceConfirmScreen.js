import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, RadioButton } from 'react-native-paper';
import { bookingAPI } from '../../services/api';

const AttendanceConfirmScreen = ({ route, navigation }) => {
  const { booking } = route.params;
  const [attended, setAttended] = useState('yes');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await bookingAPI.confirmAttendance(booking._id, {
        attended: attended === 'yes',
        feedback,
      });
      alert('Attendance confirmed!');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to confirm attendance:', error);
      alert(error.response?.data?.message || 'Failed to confirm attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Confirm Attendance
      </Text>

      <View style={styles.bookingInfo}>
        <Text variant="titleMedium">{booking.pooja_type}</Text>
        <Text>Grihasta: {booking.grihasta_name}</Text>
        <Text>Date: {new Date(booking.scheduled_datetime).toLocaleDateString()}</Text>
        <Text>Amount: ₹{booking.total_amount}</Text>
      </View>

      <Text variant="bodyLarge" style={styles.label}>
        Did the Grihasta attend the service?
      </Text>
      <RadioButton.Group onValueChange={setAttended} value={attended}>
        <View style={styles.radioItem}>
          <RadioButton value="yes" />
          <Text>Yes, completed successfully</Text>
        </View>
        <View style={styles.radioItem}>
          <RadioButton value="no" />
          <Text>No, did not attend</Text>
        </View>
      </RadioButton.Group>

      <TextInput
        label="Feedback (optional)"
        value={feedback}
        onChangeText={setFeedback}
        style={styles.input}
        multiline
        numberOfLines={4}
      />

      <Button 
        mode="contained" 
        onPress={handleConfirm}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Confirm Completion
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
    marginBottom: 20,
    color: '#FF6B35',
  },
  bookingInfo: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
  },
  label: {
    marginBottom: 10,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  input: {
    marginTop: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FF6B35',
  },
});

export default AttendanceConfirmScreen;
