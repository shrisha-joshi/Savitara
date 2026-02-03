import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../services/api';

const ServicesScreen = ({ navigation }) => {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, []);

  const fetchServices = async (category = null, search = null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      
      const response = await api.get(`/services?${params.toString()}`);
      if (response.data.success) {
        setServices(response.data.data.services);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/services/categories');
      if (response.data.success) {
        setCategories(response.data.data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    fetchServices(category, searchQuery);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 2 || query.length === 0) {
      fetchServices(selectedCategory, query);
    }
  };

  const getCategoryDisplayName = (category) => {
    const names = {
      'life_ceremonies': 'Life Ceremonies',
      'worship_puja': 'Worship & Puja',
      'remedial_services': 'Remedial Services',
      'ancestral_rites': 'Ancestral Rites',
      'special_occasions': 'Special Occasions'
    };
    return names[category] || category;
  };

  const renderServiceCard = ({ item }) => (
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => navigation.navigate('ServiceDetail', { serviceId: item._id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.serviceIcon}>{item.icon}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {getCategoryDisplayName(item.category)}
          </Text>
        </View>
      </View>

      <Text style={styles.serviceName}>{item.name_english}</Text>
      <Text style={styles.sanskritName}>{item.name_sanskrit}</Text>
      <Text style={styles.serviceDescription} numberOfLines={2}>
        {item.short_description}
      </Text>

      {item.muhurta_required === 'mandatory' && (
        <View style={styles.muhuртаBadge}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#FF6B35" />
          <Text style={styles.muhuртаText}>Muhurta Required</Text>
        </View>
      )}

      <View style={styles.pricingSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Muhurta:</Text>
          <Text style={styles.price}>₹{item.muhurta_consultation_price}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Full Service:</Text>
          <Text style={styles.price}>from ₹{item.full_service_base_price}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.viewButton}>
        <Text style={styles.viewButtonText}>View Details</Text>
        <Ionicons name="arrow-forward" size={16} color="white" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hindu Spiritual Services</Text>
        <Text style={styles.subtitle}>
          Book authentic rituals and ceremonies
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search services..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={[{ _id: null, count: services.length }, ...categories]}
          keyExtractor={(item) => item._id || 'all'}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                (item._id === null ? !selectedCategory : selectedCategory === item._id) && styles.categoryChipActive
              ]}
              onPress={() => handleCategoryChange(item._id)}
            >
              <Text style={[
                styles.categoryChipText,
                (item._id === null ? !selectedCategory : selectedCategory === item._id) && styles.categoryChipTextActive
              ]}>
                {item._id === null ? 'All Services' : getCategoryDisplayName(item._id)}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          renderItem={renderServiceCard}
          contentContainerStyle={styles.servicesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No services found</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 15,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingVertical: 10,
    marginBottom: 10,
  },
  filtersList: {
    paddingHorizontal: 15,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  categoryChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: 'white',
  },
  servicesList: {
    padding: 15,
  },
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIcon: {
    fontSize: 40,
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    color: '#666',
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sanskritName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#FF6B35',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  muhuртаBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  muhuртаText: {
    fontSize: 12,
    color: '#FF6B35',
    marginLeft: 4,
    fontWeight: '500',
  },
  pricingSection: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: '#666',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  viewButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  viewButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default ServicesScreen;


ServicesScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired
  }).isRequired
};

