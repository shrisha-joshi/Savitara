import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import PropTypes from 'prop-types';
import api from '../../services/api';

const ServiceDetailScreen = ({ route, navigation }) => {
  const { serviceId } = route.params;
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBookingType, setSelectedBookingType] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingData, setBookingData] = useState({
    selected_date: '',
    selected_time_slot: '',
    venue_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: ''
    },
    contact_number: '',
    alternate_number: '',
    special_requests: ''
  });

  useEffect(() => {
    fetchServiceDetails();
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/services/${serviceId}`);
      if (response.data.success) {
        setService(response.data.data.service);
      }
    } catch (error) {
      console.error('Error fetching service:', error);
      Alert.alert('Error', 'Failed to load service details');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingTypeSelect = (type) => {
    setSelectedBookingType(type);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async () => {
    try {
      const payload = {
        booking_type: selectedBookingType,
        ...bookingData
      };

      const response = await api.post(`/services/${serviceId}/booking`, payload);
      
      if (response.data.success) {
        const bookingId = response.data.data.booking_id;
        
        setShowBookingModal(false);
        
        if (selectedBookingType === 'muhurta_consultation') {
          Alert.alert(
            'Booking Created',
            'Please select an Acharya to proceed with muhurta consultation.',
            [{ text: 'OK', onPress: () => navigation.navigate('Search') }]
          );
        } else {
          navigation.navigate('Payment', { 
            bookingId,
            bookingType: 'service',
            amount: response.data.data.total_amount 
          });
        }
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    }
  };

  const getPrice = (type) => {
    if (!service) return 0;
    
    switch(type) {
      case 'muhurta_consultation':
        return service.muhurta_consultation_price;
      case 'full_service':
        return service.full_service_base_price;
      case 'custom_acharya':
        return service.custom_acharya_base_price;
      default:
        return 0;
    }
  };

  const calculateTotal = (basePrice) => {
    const platformFee = basePrice * 0.1;
    const tax = (basePrice + platformFee) * 0.18;
    return (basePrice + platformFee + tax).toFixed(2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading service details...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Service not found</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FF6B35" />
          </TouchableOpacity>
          <View style={styles.titleSection}>
            <Text style={styles.icon}>{service.icon}</Text>
            <Text style={styles.title}>{service.name_english}</Text>
            <Text style={styles.sanskritTitle}>{service.name_sanskrit}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Service</Text>
            <Text style={styles.sectionText}>{service.full_description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why It's Important</Text>
            <Text style={styles.sectionText}>{service.importance}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benefits</Text>
            <Text style={styles.sectionText}>{service.benefits}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            {service.requirements?.map((req, index) => (
              <View key={`requirement-${req.substring(0, 20).replace(/\s/g, '-')}-${index}`} style={styles.listItem}>
                <Text style={styles.bullet}>✓</Text>
                <Text style={styles.listText}>{req}</Text>
              </View>
            ))}
          </View>

          {service.muhurta_details && (
            <View style={[styles.section, styles.muhurtaSection]}>
              <Text style={styles.sectionTitle}>Muhurta (Auspicious Timing)</Text>
              <View style={styles.muhurtaItem}>
                <Text style={styles.muhurtaLabel}>Best Tithis:</Text>
                <Text style={styles.muhurtaValue}>
                  {service.muhurta_details.best_tithis?.join(', ')}
                </Text>
              </View>
              <View style={styles.muhurtaItem}>
                <Text style={styles.muhurtaLabel}>Best Nakshatras:</Text>
                <Text style={styles.muhurtaValue}>
                  {service.muhurta_details.best_nakshatras?.join(', ')}
                </Text>
              </View>
              <View style={styles.muhurtaItem}>
                <Text style={styles.muhurtaLabel}>Avoid On:</Text>
                <Text style={styles.muhurtaValue}>
                  {service.muhurta_details.avoid_days?.join(', ')}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <Text style={styles.sectionText}>{service.duration}</Text>
          </View>

          {/* Booking Options */}
          <View style={styles.bookingOptionsSection}>
            <Text style={styles.sectionTitle}>Booking Options</Text>

            {/* Muhurta Consultation */}
            <View style={styles.bookingCard}>
              <Text style={styles.bookingTitle}>Muhurta Consultation Only</Text>
              <Text style={styles.bookingDesc}>
                Get auspicious timing consultation from an experienced Acharya
              </Text>
              <Text style={styles.bookingPrice}>₹{getPrice('muhurta_consultation')}</Text>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBookingTypeSelect('muhurta_consultation')}
              >
                <Text style={styles.bookButtonText}>Book Consultation</Text>
              </TouchableOpacity>
            </View>

            {/* Full Service */}
            <View style={[styles.bookingCard, styles.featuredCard]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
              <Text style={styles.bookingTitle}>Complete Service Package</Text>
              <Text style={styles.bookingDesc}>
                Full service organized by Savitara with all arrangements
              </Text>
              <Text style={styles.bookingPrice}>from ₹{getPrice('full_service')}</Text>
              <TouchableOpacity
                style={[styles.bookButton, styles.primaryButton]}
                onPress={() => handleBookingTypeSelect('full_service')}
              >
                <Text style={styles.primaryButtonText}>Book Full Service</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Acharya */}
            <View style={styles.bookingCard}>
              <Text style={styles.bookingTitle}>Choose Your Acharya</Text>
              <Text style={styles.bookingDesc}>
                Select and book with your preferred Acharya
              </Text>
              <Text style={styles.bookingPrice}>from ₹{getPrice('custom_acharya')}</Text>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBookingTypeSelect('custom_acharya')}
              >
                <Text style={styles.bookButtonText}>Choose Acharya</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Your Booking</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Preferred Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={bookingData.selected_date}
                onChangeText={(text) =>
                  setBookingData({ ...bookingData, selected_date: text })
                }
              />

              <Text style={styles.inputLabel}>Time Slot *</Text>
              <TextInput
                style={styles.input}
                placeholder="morning/afternoon/evening"
                value={bookingData.selected_time_slot}
                onChangeText={(text) =>
                  setBookingData({ ...bookingData, selected_time_slot: text })
                }
              />

              <Text style={styles.sectionDivider}>Venue Address</Text>

              <Text style={styles.inputLabel}>Address Line 1 *</Text>
              <TextInput
                style={styles.input}
                placeholder="House/Flat No., Street Name"
                value={bookingData.venue_address.line1}
                onChangeText={(text) =>
                  setBookingData({
                    ...bookingData,
                    venue_address: { ...bookingData.venue_address, line1: text }
                  })
                }
              />

              <Text style={styles.inputLabel}>City *</Text>
              <TextInput
                style={styles.input}
                value={bookingData.venue_address.city}
                onChangeText={(text) =>
                  setBookingData({
                    ...bookingData,
                    venue_address: { ...bookingData.venue_address, city: text }
                  })
                }
              />

              <Text style={styles.inputLabel}>State *</Text>
              <TextInput
                style={styles.input}
                value={bookingData.venue_address.state}
                onChangeText={(text) =>
                  setBookingData({
                    ...bookingData,
                    venue_address: { ...bookingData.venue_address, state: text }
                  })
                }
              />

              <Text style={styles.inputLabel}>Pincode *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                maxLength={6}
                value={bookingData.venue_address.pincode}
                onChangeText={(text) =>
                  setBookingData({
                    ...bookingData,
                    venue_address: { ...bookingData.venue_address, pincode: text }
                  })
                }
              />

              <Text style={styles.inputLabel}>Contact Number *</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={10}
                value={bookingData.contact_number}
                onChangeText={(text) =>
                  setBookingData({ ...bookingData, contact_number: text })
                }
              />

              <Text style={styles.inputLabel}>Special Requests</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={bookingData.special_requests}
                onChangeText={(text) =>
                  setBookingData({ ...bookingData, special_requests: text })
                }
              />

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Booking Summary</Text>
                <View style={styles.summaryRow}>
                  <Text>Base Price:</Text>
                  <Text>₹{getPrice(selectedBookingType)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Platform Fee (10%):</Text>
                  <Text>₹{(getPrice(selectedBookingType) * 0.1).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>GST (18%):</Text>
                  <Text>₹{(getPrice(selectedBookingType) * 1.1 * 0.18).toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalText}>Total:</Text>
                  <Text style={styles.totalAmount}>
                    ₹{calculateTotal(getPrice(selectedBookingType))}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitBooking}
              >
                <Text style={styles.submitButtonText}>
                  {selectedBookingType === 'muhurta_consultation'
                    ? 'Create Booking'
                    : 'Proceed to Payment'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  titleSection: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 60,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  sanskritTitle: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#FF6B35',
    textAlign: 'center',
  },
  content: {
    padding: 15,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    color: '#FF6B35',
    marginRight: 10,
    fontWeight: 'bold',
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  muhurtaSection: {
    backgroundColor: '#FFF9F5',
  },
  muhurtaItem: {
    marginBottom: 12,
  },
  muhurtaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 4,
  },
  muhurtaValue: {
    fontSize: 14,
    color: '#666',
  },
  bookingOptionsSection: {
    marginTop: 10,
  },
  bookingCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  featuredCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF9F5',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bookingDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  bookingPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d65a2d',
    marginBottom: 12,
    textAlign: 'center',
  },
  bookButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#d65a2d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#d65a2d',
  },
  bookButtonText: {
    color: '#d65a2d',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sectionDivider: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d65a2d',
    marginTop: 20,
    marginBottom: 10,
  },
  summaryBox: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d65a2d',
  },
  submitButton: {
    backgroundColor: '#d65a2d',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ServiceDetailScreen;


ServiceDetailScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      serviceId: PropTypes.string.isRequired
    }).isRequired
  }).isRequired,
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired
  }).isRequired
};

