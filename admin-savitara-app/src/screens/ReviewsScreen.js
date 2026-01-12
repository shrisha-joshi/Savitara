import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, ActivityIndicator } from 'react-native-paper';
import api from '../services/api';

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await api.get('/admin/reviews/pending');
      setReviews(response.data.data);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (reviewId, approve) => {
    try {
      await api.post(`/admin/reviews/${reviewId}/moderate`, { approve });
      fetchReviews();
    } catch (error) {
      console.error('Review moderation failed:', error);
    }
  };

  const renderReview = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Title>{item.grihasta?.name || 'Unknown User'}</Title>
          <Chip icon="star" style={styles.ratingChip}>
            {item.rating}
          </Chip>
        </View>
        <Paragraph style={styles.subtitle}>
          Review for: {item.acharya?.name || 'Unknown Acharya'}
        </Paragraph>
        <Paragraph style={styles.comment}>{item.comment}</Paragraph>
        <Paragraph style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Paragraph>

        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            buttonColor="#4CAF50"
            onPress={() => handleReview(item._id, true)}
            style={styles.button}
          >
            Approve
          </Button>
          <Button
            mode="contained"
            buttonColor="#F44336"
            onPress={() => handleReview(item._id, false)}
            style={styles.button}
          >
            Reject
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <FlatList
      data={reviews}
      renderItem={renderReview}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Paragraph>No pending reviews</Paragraph>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    color: '#757575',
    marginTop: 4,
  },
  comment: {
    marginTop: 12,
    fontSize: 16,
  },
  date: {
    marginTop: 8,
    color: '#BDBDBD',
    fontSize: 12,
  },
  ratingChip: {
    backgroundColor: '#FF6B35',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
});
