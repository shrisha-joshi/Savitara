import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Card, Button, Chip, Searchbar } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import Skeleton from '../../components/common/Skeleton';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [featuredAcharyas, setFeaturedAcharyas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedAcharyas();
  }, []);

  const loadFeaturedAcharyas = async () => {
    try {
      const response = await userAPI.searchAcharyas({ 
        is_verified: true, 
        limit: 5,
        sort_by: 'rating'
      });
      setFeaturedAcharyas(response.data.acharyas || []);
    } catch (error) {
      console.error('Failed to load acharyas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.greeting}>
          Namaste, {user?.full_name?.split(' ')[0]}!
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Find authentic Acharyas for your spiritual needs
        </Text>
      </View>

      <Searchbar
        placeholder="Search for rituals, poojas..."
        onIconPress={() => navigation.navigate('Search')}
        style={styles.searchbar}
      />

      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Popular Services
        </Text>
        <View style={styles.chipContainer}>
          <Chip icon="fire" style={styles.chip}>Satyanarayan Pooja</Chip>
          <Chip icon="baby-face" style={styles.chip}>Namkaran</Chip>
          <Chip icon="heart" style={styles.chip}>Vivaha</Chip>
          <Chip icon="book-open-variant" style={styles.chip}>Vedic Consultation</Chip>
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Top Rated Acharyas
        </Text>
        {loading ? (
          <View>
            {[1, 2, 3].map((key) => (
              <View key={key} style={[styles.card, { padding: 15, backgroundColor: 'white', borderRadius: 10, elevation: 1, flexDirection: 'row' }]}>
                <Skeleton variant="rect" width={80} height={80} style={{ borderRadius: 8, marginRight: 15 }} />
                <View style={{ flex: 1, justifyContent: 'space-around' }}>
                  <Skeleton variant="rect" width="70%" height={20} />
                  <Skeleton variant="rect" width="50%" height={15} />
                  <Skeleton variant="rect" width="30%" height={15} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          featuredAcharyas.map((acharya, index) => (
            <Animated.View key={acharya._id} entering={FadeInDown.delay(index * 100).duration(500)}>
            <Card 
              style={styles.card}
              onPress={() => navigation.navigate('AcharyaDetails', { acharyaId: acharya._id })}
            >
              <Card.Content style={styles.cardContent}>
                <Image 
                  source={{ uri: acharya.profile_picture || 'https://via.placeholder.com/80' }}
                  style={styles.avatar}
                />
                <View style={styles.cardInfo}>
                  <Text variant="titleMedium">{acharya.full_name}</Text>
                  <Text variant="bodySmall">{acharya.acharya_profile?.specializations?.join(', ')}</Text>
                  <View style={styles.rating}>
                    <Text>⭐ {acharya.acharya_profile?.average_rating?.toFixed(1) || 'New'}</Text>
                    <Text> • </Text>
                    <Text>{acharya.acharya_profile?.experience_years} years exp</Text>
                  </View>
                  <Text variant="bodyMedium" style={styles.rate}>
                    ₹{acharya.acharya_profile?.hourly_rate}/hr
                  </Text>
                </View>
              </Card.Content>
            </Card>
            </Animated.View>
          ))
        )}
      </View>

      <Button 
        mode="contained" 
        style={styles.browseButton}
        onPress={() => navigation.navigate('Search')}
      >
        Browse All Acharyas
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
    padding: 20,
    backgroundColor: '#FF6B35',
  },
  greeting: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    marginTop: 5,
  },
  searchbar: {
    margin: 15,
  },
  section: {
    padding: 15,
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
  rating: {
    flexDirection: 'row',
    marginTop: 5,
  },
  rate: {
    marginTop: 5,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  browseButton: {
    margin: 15,
    backgroundColor: '#FF6B35',
  },
});

export default HomeScreen;
