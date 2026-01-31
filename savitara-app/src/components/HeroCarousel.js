import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 400;
const AUTOPLAY_INTERVAL = 4000;

// Simple slideshow images - Your beautiful wedding ceremony photos
const slideshowImages = [
  require('../../assets/images/carousel/image1.jpg'),
  require('../../assets/images/carousel/image2.jpg'),
  require('../../assets/images/carousel/image3.jpg'),
  require('../../assets/images/carousel/image4.jpg'),
  require('../../assets/images/carousel/image5.jpg'),
];

const HeroCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slideshowImages.length);
    }, AUTOPLAY_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      {slideshowImages.map((image, index) => (
        <Image
          key={index}
          source={image}
          style={[
            styles.image,
            {
              opacity: currentIndex === index ? 1 : 0,
              zIndex: currentIndex === index ? 1 : 0,
            },
          ]}
          resizeMode="cover"
        />
      ))}

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {slideshowImages.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setCurrentIndex(index)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: currentIndex === index 
                    ? 'rgba(255, 255, 255, 0.9)' 
                    : 'rgba(255, 255, 255, 0.4)',
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    top: 0,
    left: 0,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});

export default HeroCarousel;
