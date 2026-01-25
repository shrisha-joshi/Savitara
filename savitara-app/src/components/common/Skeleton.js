import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing
} from 'react-native-reanimated';

/**
 * Reusable Skeleton Component
 * Displays a loading placeholder with a shimmering opacity effect.
 * 
 * @param {number|string} width - Width of the skeleton
 * @param {number|string} height - Height of the skeleton
 * @param {string} variant - 'rect' | 'circle'
 * @param {object} style - Additional styles
 */
const Skeleton = ({ width, height, style, variant = 'rect' }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite loop
      true // Reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const borderRadius = variant === 'circle' && typeof height === 'number' ? height / 2 : 4;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE', // Light gray standard for skeletons
    overflow: 'hidden',
  },
});

export default Skeleton;
