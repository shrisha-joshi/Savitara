import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';

const ManageAvailabilityScreen = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Manage Availability
      </Text>
      
      <Calendar
        markedDates={{}}
        onDayPress={(day) => {
          console.log('Selected day:', day);
        }}
        theme={{
          selectedDayBackgroundColor: '#FF6B35',
          todayTextColor: '#FF6B35',
        }}
      />
      
      <Text variant="bodyMedium" style={styles.note}>
        Feature coming soon: Set your available time slots
      </Text>
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
  note: {
    marginTop: 20,
    textAlign: 'center',
    color: '#999',
  },
});

export default ManageAvailabilityScreen;
