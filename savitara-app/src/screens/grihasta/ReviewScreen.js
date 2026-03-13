import PropTypes from 'prop-types';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { reviewAPI } from '../../services/api';

// Simple star rating component
function StarRating({ value, onChange }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={[styles.star, star <= value && styles.starFilled]}
          onPress={() => onChange(star)}
        >
          ★
        </Text>
      ))}
    </View>
  );
}
StarRating.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

const ReviewScreen = ({ route, navigation }) => {
  const { bookingId, acharyaId, acharyaName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await reviewAPI.create({
        booking_id: bookingId,
        acharya_id: acharyaId,
        rating,
        comment: comment.trim(),
      });
      Alert.alert('Review Submitted', 'Thank you for your feedback!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to submit review. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.title}>
        Write a Review
      </Text>
      {acharyaName ? (
        <Text variant="bodyLarge" style={styles.acharyaName}>
          for {acharyaName}
        </Text>
      ) : null}

      <Text variant="titleMedium" style={styles.label}>
        Your Rating *
      </Text>
      <StarRating value={rating} onChange={setRating} />

      <Text variant="titleMedium" style={styles.label}>
        Comments (optional)
      </Text>
      <TextInput
        mode="outlined"
        placeholder="Share your experience..."
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={5}
        maxLength={1000}
        style={styles.commentInput}
        outlineColor="#ddd"
        activeOutlineColor="#FF6B35"
      />
      <Text style={styles.charCount}>{comment.length}/1000</Text>

      {submitting ? (
        <ActivityIndicator animating color="#FF6B35" style={styles.spinner} />
      ) : (
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          buttonColor="#FF6B35"
          disabled={rating === 0}
        >
          Submit Review
        </Button>
      )}

      <Button
        mode="text"
        onPress={() => navigation.goBack()}
        style={styles.cancelButton}
        textColor="#888"
      >
        Cancel
      </Button>
    </ScrollView>
  );
};

ReviewScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      bookingId: PropTypes.string.isRequired,
      acharyaId: PropTypes.string.isRequired,
      acharyaName: PropTypes.string,
    }).isRequired,
  }).isRequired,
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};

const styles = StyleSheet.create({
  acharyaName: {
    color: '#666',
    marginBottom: 24,
  },
  cancelButton: {
    marginBottom: 8,
  },
  charCount: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 24,
    marginTop: 4,
    textAlign: 'right',
  },
  commentInput: {
    backgroundColor: '#fff',
    fontSize: 15,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  label: {
    color: '#333',
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 20,
  },
  spinner: {
    marginVertical: 16,
  },
  star: {
    color: '#ddd',
    fontSize: 42,
    marginRight: 6,
  },
  starFilled: {
    color: '#FF6B35',
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  submitButton: {
    borderRadius: 24,
    marginBottom: 12,
    paddingVertical: 4,
  },
  title: {
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 4,
  },
});

export default ReviewScreen;
