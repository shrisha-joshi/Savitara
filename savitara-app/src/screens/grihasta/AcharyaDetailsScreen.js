import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Button, Divider, Chip } from 'react-native-paper';
import { userAPI, reviewAPI } from '../../services/api';

const AcharyaDetailsScreen = ({ route, navigation }) => {
  const { acharyaId } = route.params;
  const [acharya, setAcharya] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAcharya();
    loadReviews();
  }, []);

  const loadAcharya = async () => {
    try {
      const response = await userAPI.getAcharya(acharyaId);
      setAcharya(response.data);
    } catch (error) {
      console.error('Failed to load acharya:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await reviewAPI.getAcharyaReviews(acharyaId, { limit: 5 });
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  if (loading || !acharya) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const profile = acharya.acharya_profile;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={{ uri: acharya.profile_picture || 'https://via.placeholder.com/120' }}
          style={styles.avatar}
        />
        <View style={styles.nameRow}>
          <Text variant="headlineSmall">{acharya.full_name}</Text>
          {profile.is_verified && (
            <Text style={styles.verified}>✓</Text>
          )}
        </View>
        <Text variant="bodyMedium">{acharya.location}</Text>
        <View style={styles.stats}>
          <Text>⭐ {profile.average_rating?.toFixed(1) || 'New'}</Text>
          <Text> • </Text>
          <Text>{profile.total_reviews || 0} reviews</Text>
          <Text> • </Text>
          <Text>{profile.experience_years} years</Text>
        </View>
      </View>

      <Divider />

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>About</Text>
        <Text>{profile.bio}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Specializations</Text>
        <View style={styles.chipContainer}>
          {profile.specializations?.map((spec, index) => (
            <Chip key={index} style={styles.chip}>{spec}</Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Languages</Text>
        <View style={styles.chipContainer}>
          {profile.languages?.map((lang, index) => (
            <Chip key={index} style={styles.chip}>{lang}</Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Pricing
        </Text>
        <Text variant="headlineSmall" style={styles.price}>
          ₹{profile.hourly_rate}/hour
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recent Reviews
        </Text>
        {reviews.length === 0 ? (
          <Text>No reviews yet</Text>
        ) : (
          reviews.map((review) => (
            <View key={review._id} style={styles.review}>
              <View style={styles.reviewHeader}>
                <Text variant="bodyMedium">{review.grihasta_name}</Text>
                <Text>⭐ {review.rating}</Text>
              </View>
              <Text variant="bodySmall">{review.comment}</Text>
            </View>
          ))
        )}
      </View>

      <Button 
        mode="contained" 
        style={styles.bookButton}
        onPress={() => navigation.navigate('Booking', { acharya })}
      >
        Book Now
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verified: {
    marginLeft: 5,
    color: '#4CAF50',
    fontSize: 20,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 10,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    marginRight: 10,
    marginBottom: 10,
  },
  price: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  review: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  bookButton: {
    margin: 20,
    backgroundColor: '#FF6B35',
  },
});

export default AcharyaDetailsScreen;
