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
    booking_type: 'in_person',
    scheduled_date: '',
    scheduled_time: '',
    duration_hours: '1',
    location: '',
    special_requirements: '',
  });
  const [loading, setLoading] = useState(false);

  const handleDateSelect = (day) => {
    setFormData({ ...formData, scheduled_date: day.dateString });
  };

  const handleBooking = async () => {
    try {
      setLoading(true);
      
      const bookingData = {
        acharya_id: acharya._id,
        pooja_type: formData.pooja_type,
        booking_type: formData.booking_type,
        scheduled_datetime: `${formData.scheduled_date}T${formData.scheduled_time}:00`,
        duration_hours: parseFloat(formData.duration_hours),
        location: formData.booking_type === 'in_person' ? formData.location : null,
        special_requirements: formData.special_requirements,
      };
      
      const response = await bookingAPI.create(bookingData);
      const booking = response.data;
      
      navigation.navigate('Payment', { booking });
    } catch (error) {
      console.error('Booking failed:', error);
      alert(error.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = acharya.acharya_profile.hourly_rate * parseFloat(formData.duration_hours || 1);

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Book {acharya.full_name}
      </Text>

      <TextInput
        label="Pooja/Service Type *"
        value={formData.pooja_type}
        onChangeText={(text) => setFormData({ ...formData, pooja_type: text })}
        style={styles.input}
      />

      <View style={styles.radioGroup}>
        <Text variant="bodyLarge">Booking Type:</Text>
        <RadioButton.Group 
          onValueChange={(value) => setFormData({ ...formData, booking_type: value })}
          value={formData.booking_type}
        >
          <View style={styles.radioItem}>
            <RadioButton value="in_person" />
            <Text>In Person</Text>
          </View>
          <View style={styles.radioItem}>
            <RadioButton value="virtual" />
            <Text>Virtual</Text>
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
        label="Duration (hours) *"
        value={formData.duration_hours}
        onChangeText={(text) => setFormData({ ...formData, duration_hours: text })}
        style={styles.input}
        keyboardType="numeric"
      />

      {formData.booking_type === 'in_person' && (
        <TextInput
          label="Location *"
          value={formData.location}
          onChangeText={(text) => setFormData({ ...formData, location: text })}
          style={styles.input}
          multiline
        />
      )}

      <TextInput
        label="Special Requirements"
        value={formData.special_requirements}
        onChangeText={(text) => setFormData({ ...formData, special_requirements: text })}
        style={styles.input}
        multiline
        numberOfLines={3}
      />

      <View style={styles.summary}>
        <Text variant="titleMedium">Booking Summary</Text>
        <View style={styles.summaryRow}>
          <Text>Hourly Rate:</Text>
          <Text>₹{acharya.acharya_profile.hourly_rate}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Duration:</Text>
          <Text>{formData.duration_hours} hours</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text variant="titleMedium">Total:</Text>
          <Text variant="titleMedium" style={styles.total}>₹{totalAmount}</Text>
        </View>
      </View>

      <Button 
        mode="contained" 
        onPress={handleBooking}
        loading={loading}
        disabled={loading || !formData.pooja_type || !formData.scheduled_date || !formData.scheduled_time}
        style={styles.button}
      >
        Proceed to Payment
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
  button: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#FF6B35',
  },
});

export default BookingScreen;
