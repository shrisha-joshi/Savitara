/**
 * Skeleton Loader Components
 */
import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';

const SkeletonPlaceholder = ({ width = '100%', height = 20, borderRadius = 4, style }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const AcharyaCardSkeleton = () => (
  <View style={styles.acharyaCard}>
    <View style={styles.acharyaCardContent}>
      <SkeletonPlaceholder width={80} height={80} borderRadius={40} />
      <View style={styles.acharyaInfo}>
        <SkeletonPlaceholder width="70%" height={20} style={styles.mb8} />
        <SkeletonPlaceholder width="50%" height={16} style={styles.mb8} />
        <SkeletonPlaceholder width="60%" height={16} />
      </View>
    </View>
  </View>
);

export const BookingCardSkeleton = () => (
  <View style={styles.bookingCard}>
    <SkeletonPlaceholder width="80%" height={18} style={styles.mb12} />
    <SkeletonPlaceholder width="60%" height={16} style={styles.mb8} />
    <SkeletonPlaceholder width="40%" height={16} style={styles.mb12} />
    <View style={styles.row}>
      <SkeletonPlaceholder width={80} height={32} borderRadius={16} style={styles.mr8} />
      <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
    </View>
  </View>
);

export const ProfileSkeleton = () => (
  <View style={styles.profileContainer}>
    <View style={styles.profileHeader}>
      <SkeletonPlaceholder width={100} height={100} borderRadius={50} style={styles.mb16} />
      <SkeletonPlaceholder width="60%" height={24} style={styles.mb8} />
      <SkeletonPlaceholder width="40%" height={16} />
    </View>
    <View style={styles.profileDetails}>
      <SkeletonPlaceholder width="100%" height={60} style={styles.mb16} borderRadius={8} />
      <SkeletonPlaceholder width="100%" height={60} style={styles.mb16} borderRadius={8} />
      <SkeletonPlaceholder width="100%" height={60} borderRadius={8} />
    </View>
  </View>
);

export const ChatMessageSkeleton = () => (
  <View style={styles.chatContainer}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={i % 2 === 0 ? styles.messageRight : styles.messageLeft}>
        <SkeletonPlaceholder
          width={i % 2 === 0 ? '70%' : '60%'}
          height={40}
          borderRadius={12}
          style={styles.mb8}
        />
      </View>
    ))}
  </View>
);

export const ListSkeleton = ({ count = 5, renderItem }) => (
  <View style={styles.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <View key={index}>
        {renderItem ? renderItem() : <AcharyaCardSkeleton />}
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  acharyaCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  acharyaCardContent: {
    flexDirection: 'row',
  },
  acharyaInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  bookingCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  profileDetails: {
    padding: 16,
  },
  chatContainer: {
    padding: 16,
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  listContainer: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
  },
  mb8: {
    marginBottom: 8,
  },
  mb12: {
    marginBottom: 12,
  },
  mb16: {
    marginBottom: 16,
  },
  mr8: {
    marginRight: 8,
  },
});

export default SkeletonPlaceholder;
