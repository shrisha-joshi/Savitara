import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, RadioButton, ActivityIndicator, Surface, Divider } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { bookingAPI } from '../../services/api';

const BookingScreen = ({ route, navigation }) => {
  // Safely extract params — may be undefined if navigation is misconfigured
  const acharya = route.params?.acharya;

  // ── All hooks MUST be declared before any conditional return ──────────────
  const [validationError, setValidationError] = useState(null);
  const [formData, setFormData] = useState({
    pooja_type: '',
    service_name: '',
    booking_type: 'only',    // 'only' | 'with_samagri'
    booking_mode: 'instant', // 'instant' | 'request'
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    requirements: '',
    notes: '',
    duration_hours: 2,
  });
  const [loading, setLoading] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const priceDebounceRef = useRef(null);

  // Validate acharya data on mount — sets validationError, does NOT return early
  useEffect(() => {
    if (!acharya || !acharya._id || acharya._id === 'undefined' || acharya._id === 'null') {
      setValidationError('Invalid Acharya ID. Please try again from the Acharya profile.');
      Alert.alert('Error', 'Invalid Acharya selection. Returning to search.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, [acharya, navigation]);

  // Fetch real-time dynamic price estimate whenever date / time / duration / type changes
  useEffect(() => {
    if (!acharya?._id || !formData.scheduled_date || !formData.scheduled_time) {
      setPriceEstimate(null);
      return;
    }
    // Only proceed once time looks like HH:MM
    if (!/^\d{2}:\d{2}$/.test(formData.scheduled_time)) return;

    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);

    priceDebounceRef.current = setTimeout(async () => {
      try {
        setPriceLoading(true);
        const dateTimeStr = `${formData.scheduled_date}T${formData.scheduled_time}:00`;
        const res = await bookingAPI.getPriceEstimate({
          acharya_id: acharya._id,
          date_time: dateTimeStr,
          duration_hours: formData.duration_hours,
          booking_type: formData.booking_type,
        });
        setPriceEstimate(res.data?.data || null);
      } catch (err) {
        console.warn('Price estimate error:', err?.response?.data?.detail || err.message);
        setPriceEstimate(null);
      } finally {
        setPriceLoading(false);
      }
    }, 600);

    return () => { if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current); };
  }, [acharya?._id, formData.scheduled_date, formData.scheduled_time, formData.duration_hours, formData.booking_type]);

  // Conditional render AFTER all hooks
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
        duration_hours: formData.duration_hours,
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
        label="Duration (hours)"
        value={String(formData.duration_hours)}
        onChangeText={(text) => {
          const n = parseInt(text, 10);
          if (!isNaN(n) && n >= 1 && n <= 12) {
            setFormData({ ...formData, duration_hours: n });
          } else if (text === '') {
            setFormData({ ...formData, duration_hours: 1 });
          }
        }}
        keyboardType="numeric"
        style={styles.input}
        right={<TextInput.Affix text="hr" />}
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

      {/* Dynamic price breakdown — shown once a date + valid time are selected */}
      {(priceEstimate || priceLoading) && (
        <Surface style={styles.priceCard} elevation={1}>
          <Text variant="titleMedium" style={styles.priceCardTitle}>Price Breakdown</Text>
          {priceLoading ? (
            <ActivityIndicator size="small" color="#FF6B35" style={{ marginVertical: 10 }} />
          ) : (
            <>
              <PriceRow
                label={`Base (₹${acharya.acharya_profile?.hourly_rate || 0}/hr × ${formData.duration_hours}h)`}
                value={priceEstimate.base_price}
              />
              {priceEstimate.weekend_surcharge > 0 && (
                <PriceRow label="Weekend surcharge (+50%)" value={priceEstimate.weekend_surcharge} />
              )}
              {priceEstimate.peak_hour_adj > 0 && (
                <PriceRow label="Peak hour (+20%)" value={priceEstimate.peak_hour_adj} />
              )}
              {priceEstimate.off_peak_discount < 0 && (
                <PriceRow label="Off-peak discount (−15%)" value={priceEstimate.off_peak_discount} discount />
              )}
              {priceEstimate.urgent_surcharge > 0 && (
                <PriceRow label="Urgent booking (+50%)" value={priceEstimate.urgent_surcharge} />
              )}
              {priceEstimate.festival_surcharge > 0 && (
                <PriceRow
                  label={`${priceEstimate.festival_name || 'Festival'} (+30%)`}
                  value={priceEstimate.festival_surcharge}
                />
              )}
              {priceEstimate.samagri_fee > 0 && (
                <PriceRow label="Samagri" value={priceEstimate.samagri_fee} />
              )}
              <Divider style={{ marginVertical: 6 }} />
              <PriceRow label="Subtotal" value={priceEstimate.subtotal} />
              <PriceRow label="Platform fee (10%)" value={priceEstimate.platform_fee} />
              <PriceRow label="GST (18%)" value={priceEstimate.gst} />
              <Divider style={{ marginVertical: 6 }} />
              <PriceRow label="Total" value={priceEstimate.total_price} highlight />
            </>
          )}
        </Surface>
      )}

      {!priceEstimate && !priceLoading && formData.booking_mode === 'instant' && (
        <View style={styles.infoBox}>
          <Text variant="bodySmall" style={{ color: '#555' }}>
            Select a date and time to see the full price breakdown.
          </Text>
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
  note: {
    fontStyle: 'italic',
    color: '#666',
  },
  priceCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  priceCardTitle: {
    marginBottom: 10,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  priceRowLabel: {
    color: '#555',
    flex: 1,
  },
  priceRowLabelBold: {
    color: '#222',
    fontWeight: '600',
    flex: 1,
  },
  priceValue: {
    color: '#333',
  },
  priceHighlight: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  priceDiscount: {
    color: '#4CAF50',
    fontWeight: '500',
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

/** Small helper row for the price breakdown card */
const PriceRow = ({ label, value, highlight, discount }) => (
  <View style={styles.priceRow}>
    <Text
      variant={highlight ? 'titleSmall' : 'bodySmall'}
      style={highlight ? styles.priceRowLabelBold : styles.priceRowLabel}
    >
      {label}
    </Text>
    <Text
      variant={highlight ? 'titleSmall' : 'bodySmall'}
      style={
        highlight
          ? styles.priceHighlight
          : discount
          ? styles.priceDiscount
          : styles.priceValue
      }
    >
      {discount && value < 0 ? `−₹${Math.abs(value)}` : `₹${value}`}
    </Text>
  </View>
);

export default BookingScreen;
