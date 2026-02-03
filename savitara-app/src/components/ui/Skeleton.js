import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../../theme/tokens';

const Skeleton = ({ width, height, style, variant = 'rect' }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startAnimation();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const getBorderRadius = () => {
    if (variant === 'circle') return borderRadius.round;
    return borderRadius.s;
  };

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          opacity,
          borderRadius: getBorderRadius(),
          backgroundColor: colors.textDisabled, // Grayish placeholder
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
});

export default Skeleton;
