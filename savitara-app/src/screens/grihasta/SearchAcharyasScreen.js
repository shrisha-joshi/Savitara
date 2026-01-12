import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Searchbar, Card, Chip, Button } from 'react-native-paper';
import { userAPI } from '../../services/api';

const SearchAcharyasScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [acharyas, setAcharyas] = useState([]);
  const [filters, setFilters] = useState({
    specialization: '',
    min_rating: null,
    max_hourly_rate: null,
    is_verified: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    searchAcharyas();
  }, [filters]);

  const searchAcharyas = async () => {
    try {
      setLoading(true);
      const response = await userAPI.searchAcharyas({
        search: searchQuery,
        ...filters,
      });
      setAcharyas(response.data.acharyas || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    searchAcharyas();
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search by name, specialization..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={handleSearch}
        style={styles.searchbar}
      />

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip 
            selected={filters.is_verified} 
            onPress={() => setFilters({...filters, is_verified: !filters.is_verified})}
            style={styles.filterChip}
          >
            Verified Only
          </Chip>
          <Chip 
            selected={filters.min_rating === 4} 
            onPress={() => setFilters({...filters, min_rating: filters.min_rating === 4 ? null : 4})}
            style={styles.filterChip}
          >
            4+ Rating
          </Chip>
          <Chip 
            selected={filters.max_hourly_rate === 500} 
            onPress={() => setFilters({...filters, max_hourly_rate: filters.max_hourly_rate === 500 ? null : 500})}
            style={styles.filterChip}
          >
            Under ₹500/hr
          </Chip>
        </ScrollView>
      </View>

      <ScrollView style={styles.results}>
        {loading ? (
          <Text style={styles.centerText}>Searching...</Text>
        ) : acharyas.length === 0 ? (
          <Text style={styles.centerText}>No Acharyas found</Text>
        ) : (
          acharyas.map((acharya) => (
            <Card 
              key={acharya._id} 
              style={styles.card}
              onPress={() => navigation.navigate('AcharyaDetails', { acharyaId: acharya._id })}
            >
              <Card.Content style={styles.cardContent}>
                <Image 
                  source={{ uri: acharya.profile_picture || 'https://via.placeholder.com/80' }}
                  style={styles.avatar}
                />
                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text variant="titleMedium">{acharya.full_name}</Text>
                    {acharya.acharya_profile?.is_verified && (
                      <Text style={styles.verified}>✓</Text>
                    )}
                  </View>
                  <Text variant="bodySmall" numberOfLines={1}>
                    {acharya.acharya_profile?.specializations?.join(', ')}
                  </Text>
                  <Text variant="bodySmall">{acharya.location}</Text>
                  <View style={styles.bottomRow}>
                    <Text>⭐ {acharya.acharya_profile?.average_rating?.toFixed(1) || 'New'} ({acharya.acharya_profile?.total_reviews || 0})</Text>
                    <Text style={styles.rate}>₹{acharya.acharya_profile?.hourly_rate}/hr</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchbar: {
    margin: 15,
  },
  filters: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  filterChip: {
    marginRight: 10,
  },
  results: {
    flex: 1,
    paddingHorizontal: 15,
  },
  card: {
    marginBottom: 15,
  },
  cardContent: {
    flexDirection: 'row',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verified: {
    marginLeft: 5,
    color: '#4CAF50',
    fontSize: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  rate: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  centerText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

export default SearchAcharyasScreen;
