import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, Text } from 'react-native-paper';
import { chatAPI, reviewAPI, userAPI } from '../../services/api';
import EmptyState from '../../components/EmptyState';
import ErrorBoundary from '../../components/ErrorBoundary';
import ErrorScreen from '../../components/ErrorScreen';
import LoadingScreen from '../../components/LoadingScreen';

const AcharyaDetailsScreen = ({ route, navigation }) => {
  const { acharyaId } = route.params;
  const [acharya, setAcharya] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAcharya();
    loadReviews();
  }, []);

  const loadAcharya = async () => {
    try {
      const response = await userAPI.getAcharya(acharyaId);
      setAcharya(response.data);
    } catch (err) {
      console.error('Failed to load acharya:', err);
      setError(err.response?.data?.message || 'Failed to load Acharya details. Please try again.');
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

  const handleChatNow = async () => {
    try {
      const userId = acharya.user_id || acharya._id || acharyaId;
      const response = await chatAPI.verifyConversation(userId);
      // Backend wraps in StandardResponse: { success, data: { conversation_id, recipient } }
      const convData = response.data?.data || response.data;
      if (convData?.conversation_id) {
        navigation.navigate('Conversation', {
          conversationId: convData.conversation_id,
          otherUserId: convData.recipient?.id || userId,
          otherUserName: convData.recipient?.name || acharya.full_name || 'Acharya',
        });
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      Alert.alert('Error', 'Unable to start chat. Please try again.');
    }
  };

  if (loading) return <LoadingScreen text="Loading Acharya details…" />;
  if (error) return (
    <ErrorScreen
      message={error}
      onRetry={() => { setError(null); setLoading(true); loadAcharya(); }}
    />
  );
  if (!acharya) return <ErrorScreen message="Acharya not found." />;

  const profile = acharya.acharya_profile;

  return (
    <ErrorBoundary>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={acharya.profile_picture ? { uri: acharya.profile_picture } : null}
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
          {profile.specializations?.map((spec) => (
            <Chip key={spec} style={styles.chip}>{spec}</Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Languages</Text>
        <View style={styles.chipContainer}>
          {profile.languages?.map((lang) => (
            <Chip key={lang} style={styles.chip}>{lang}</Chip>
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
          <EmptyState
            icon="star-outline"
            title="No reviews yet"
            message="This Acharya hasn't received any reviews yet."
            iconSize={40}
            iconColor="#ccc"
          />
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

      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          style={styles.bookButton}
          onPress={() => navigation.navigate('Booking', { acharya })}
        >
          Book Now
        </Button>
        
        <Button 
          mode="outlined" 
          style={styles.chatButton}
          icon="chat"
          onPress={handleChatNow}
        >
          Chat Now
        </Button>
      </View>
    </ScrollView>
    </ErrorBoundary>
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

AcharyaDetailsScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      acharyaId: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
  }).isRequired,
};

export default AcharyaDetailsScreen;
