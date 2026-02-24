import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, RadioButton, ActivityIndicator } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { bookingAPI } from '../../services/api';

const BookingScreen = ({ route, navigation }) => {
  const { acharya } = route.params;
  const [validationError, setValidationError] = useState(null);

  // Validate acharya data on mount
  useEffect(() => {
    if (!acharya || !acharya._id || acharya._id === 'undefined' || acharya._id === 'null') {
      setValidationError('Invalid Acharya ID. Please try again from the Acharya profile.');
      Alert.alert('Error', 'Invalid Acharya selection. Returning to search.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [acharya, navigation]);

  if (validationError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{validationError}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
          Go Back
        </Button>
      </View>
    );
  }
  const [formData, setFormData] = useState({
    pooja_type: '',
    service_name: '',
    booking_type: 'only', // 'only' or 'with_samagri'
    booking_mode: 'instant', // 'instant' or 'request'
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    requirements: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleDateSelect = (day) => {
    setFormData({ ...formData, scheduled_date: day.dateString });
  };

  const handleBooking = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.scheduled_date || !formData.scheduled_time) {
        Alert.alert('Error', 'Please select date and time');
        setLoading(false);
        return;
      }

      if (!formData.pooja_type && !formData.service_name) {
        Alert.alert('Error', 'Please specify pooja type or service name');
        setLoading(false);
        return;
      }
      
      const bookingData = {
        acharya_id: acharya._id,
        booking_type: formData.booking_type,
        booking_mode: formData.booking_mode,
        date: formData.scheduled_date,
        time: formData.scheduled_time,
        service_name: formData.service_name || formData.pooja_type,
        requirements: formData.requirements || null,
        notes: formData.notes || null,
        location: formData.location ? {
          address: formData.location,
          city: '',
          state: '',
          country: 'India'
        } : null,
      };
      
      const response = await bookingAPI.create(bookingData);
      const booking = response.data;
      
      // For request mode, navigate to bookings list
      if (formData.booking_mode === 'request') {
        Alert.alert('Success', 'Booking request sent to Acharya!', [
          { text: 'OK', onPress: () => navigation.navigate('MyBookingsScreen') }
        ]);
      } else {
        // For instant mode, navigate to payment
        navigation.navigate('Payment', { booking });
      }
    } catch (error) {
      console.error('Booking failed:', error);
      Alert.alert('Error', error.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const estimatedAmount = acharya.acharya_profile?.hourly_rate || 0;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Book {acharya.full_name}
      </Text>

      <View style={styles.radioGroup}>
        <Text variant="bodyLarge">Booking Mode:</Text>
        <RadioButton.Group 
          onValueChange={(value) => setFormData({ ...formData, booking_mode: value })}
          value={formData.booking_mode}
        >
          <View style={styles.radioItem}>
            <RadioButton value="instant" />
            <Text>Instant Booking (with payment)</Text>
          </View>
          <View style={styles.radioItem}>
            <RadioButton value="request" />
            <Text>Request Booking (Acharya confirms)</Text>
          </View>
        </RadioButton.Group>
      </View>

      <TextInput
        label="Pooja/Service Type *"
        value={formData.pooja_type || formData.service_name}
        onChangeText={(text) => setFormData({ ...formData, service_name: text, pooja_type: text })}
        style={styles.input}
        placeholder="e.g., Satyanarayan Pooja, Consultation"
      />

      <View style={styles.radioGroup}>
        <Text variant="bodyLarge">Booking Type:</Text>
        <RadioButton.Group 
          onValueChange={(value) => setFormData({ ...formData, booking_type: value })}
          value={formData.booking_type}
        >
          <View style={styles.radioItem}>
            <RadioButton value="only" />
            <Text>Service Only</Text>
          </View>
          <View style={styles.radioItem}>
            <RadioButton value="with_samagri" />
            <Text>With Samagri</Text>
          </View>
        </RadioButton.Group>
      </View>

      <Text variant="titleMedium" style={styles.label}>
        Select Date:
      </Text>
      <Calendar
        onDayPress={handleDateSelect}
        markedDates={{
          [formData.scheduled_date]: { selected: true, selectedColor: '#FF6B35' }
        }}
        minDate={new Date().toISOString().split('T')[0]}
        theme={{
          selectedDayBackgroundColor: '#FF6B35',
          todayTextColor: '#FF6B35',
        }}
      />

      <TextInput
        label="Time (HH:MM) *"
        value={formData.scheduled_time}
        onChangeText={(text) => setFormData({ ...formData, scheduled_time: text })}
        style={styles.input}
        placeholder="14:00"
      />

      <TextInput
        label="Location"
        value={formData.location}
        onChangeText={(text) => setFormData({ ...formData, location: text })}
        style={styles.input}
        multiline
        placeholder="Full address"
      />

      {formData.booking_mode === 'request' && (
        <TextInput
          label="Requirements (for request mode)"
          value={formData.requirements}
          onChangeText={(text) => setFormData({ ...formData, requirements: text })}
          style={styles.input}
          multiline
          numberOfLines={3}
          placeholder="Describe your specific requirements..."
        />
      )}

      <TextInput
        label="Additional Notes"
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        style={styles.input}
        multiline
        numberOfLines={2}
      />

      {formData.booking_mode === 'instant' && (
        <View style={styles.summary}>
          <Text variant="titleMedium">Estimated Amount</Text>
          <View style={styles.summaryRow}>
            <Text>Acharya Rate:</Text>
            <Text>₹{estimatedAmount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" style={styles.note}>
              {formData.booking_type === 'with_samagri' 
                ? 'Final amount includes samagri cost' 
                : 'Service only'}
            </Text>
          </View>
        </View>
      )}

      {formData.booking_mode === 'request' && (
        <View style={styles.infoBox}>
          <Text variant="bodyMedium">
            📋 Acharya will review your request and confirm the amount before you pay.
          </Text>
        </View>
      )}

      <Button 
        mode="contained" 
        onPress={handleBooking}
        loading={loading}
        disabled={loading || (!formData.pooja_type && !formData.service_name) || !formData.scheduled_date || !formData.scheduled_time}
        style={styles.button}
      >
        {formData.booking_mode === 'request' ? 'Send Request' : 'Proceed to Payment'}
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
  },
  input: {
    marginBottom: 15,
  },
  radioGroup: {
    marginBottom: 15,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  label: {
    marginTop: 10,
    marginBottom: 10,
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  total: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  note: {
    fontStyle: 'italic',
    color: '#666',
  },
  infoBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  button: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#FF6B35',
  },
});

export default BookingScreen;
