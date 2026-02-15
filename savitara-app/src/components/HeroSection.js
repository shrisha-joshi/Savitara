import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  TouchableOpacity,
} from 'react-native';
import PropTypes from 'prop-types';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, Text as SvgText, TextPath } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// Rotating Circle Component
const RotatingCircle = ({ radius, duration, text, textId, fontSize = 12 }) => {
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: duration * 1000,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const centerOffset = radius / 2;
  const pathRadius = (radius / 2) - 15;

  return (
    <Animated.View
      style={[
        styles.rotatingCircle,
        {
          width: radius,
          height: radius,
          transform: [{ rotate }],
        },
      ]}
    >
      <Svg width={radius} height={radius} viewBox={`0 0 ${radius} ${radius}`}>
        <Defs>
          <Path
            id={textId}
            d={`M ${centerOffset},${centerOffset} m -${pathRadius},0 a ${pathRadius},${pathRadius} 0 1,1 ${pathRadius * 2},0 a ${pathRadius},${pathRadius} 0 1,1 -${pathRadius * 2},0`}
          />
        </Defs>
        <SvgText fill="#FF8C00" fontSize={fontSize} fontFamily="Noto Sans Devanagari" fontWeight="500">
          <TextPath href={`#${textId}`} startOffset="0%">
            {text}
          </TextPath>
        </SvgText>
      </Svg>
    </Animated.View>
  );
};

// Sun Glow Component
const SunGlow = ({ size = 240 }) => {
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.sunGlow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale: pulseValue }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,140,0,0.3)', 'rgba(255,140,0,0.2)', 'rgba(255,140,0,0.1)', 'transparent']}
        style={styles.sunGlowGradient}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

const HeroSection = ({ onFindAcharya }) => {
  // Responsive scaling
  const containerSize = Math.min(SCREEN_WIDTH - 40, 400);
  const scale = containerSize / 400;

  return (
    <LinearGradient
      colors={['#FFF8E7', '#FFE4B5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Text Content - Top on Mobile */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Savitara</Text>
          <Text style={styles.subtitle}>आध्यात्मिक मार्गदर्शन का प्रकाश</Text>
          <Text style={styles.description}>
            Connect with experienced Acharyas for authentic spiritual guidance rooted in Hindu
            traditions. Find clarity, peace, and purpose through personalized consultations.
          </Text>
        </View>

        {/* Image with Rotating Circles - Bottom on Mobile */}
        <View style={[styles.imageContainer, { width: containerSize, height: containerSize }]}>
          {/* Sun Glow Background */}
          <SunGlow size={240 * scale} />

          {/* Rotating Sanskrit Circles */}
          <RotatingCircle
            radius={Math.round(180 * scale)}
            duration={30}
            fontSize={Math.max(8, 12 * scale)}
            text="ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥"
            textId="circleInner"
          />
          <RotatingCircle
            radius={Math.round(240 * scale)}
            duration={45}
            fontSize={Math.max(10, 14 * scale)}
            text="ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥"
            textId="circleMiddle"
          />
          <RotatingCircle
            radius={Math.round(300 * scale)}
            duration={60}
            fontSize={Math.max(12, 16 * scale)}
            text="ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥"
            textId="circleOuter"
          />

          {/* Central Hero Image */}
          <View style={[styles.heroImageWrapper, { width: 200 * scale, height: 200 * scale, borderRadius: 100 * scale }]}>
            <Image
              source={require('../../assets/images/hero/hero-image1.png')}
              style={styles.heroImage}
              defaultSource={require('../../assets/icon.png')}
              onError={(e) => {
                console.log('Image load error:', e.nativeEvent.error);
              }}
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: SCREEN_HEIGHT * 0.85,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#8B4513',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FF8C00',
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#5D4037',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 30,
  },
  imageContainer: {
    maxWidth: 400,
    maxHeight: 400,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sunGlow: {
    position: 'absolute',
    borderRadius: 120, // This should probably be half of size, but if size varies... borderRadius should be 50%?
    // Wait, styling in component used "borderRadius: 120".
    // I should change it to '50%'
  },
  sunGlowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 300, // Large enough to be circle
  },
  rotatingCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageWrapper: {
    overflow: 'hidden',
    zIndex: 10,
    elevation: 8,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});

RotatingCircle.propTypes = {
  radius: PropTypes.number.isRequired,
  duration: PropTypes.number.isRequired,
  text: PropTypes.string.isRequired,
  textId: PropTypes.string.isRequired,
};

HeroSection.propTypes = {
  onFindAcharya: PropTypes.func.isRequired,
};

export default HeroSection;
