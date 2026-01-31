import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';

// Wedding ceremony slideshow images
const slideshowImages = [
  '/images/carousel/image1.jpg',
  '/images/carousel/image2.jpg',
  '/images/carousel/image3.jpg',
  '/images/carousel/image4.jpg',
  '/images/carousel/image5.jpg',
];

const HeroCarousel = ({ 
  interval = 4000,
  height = '500px',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slideshowImages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: height,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {slideshowImages.map((image, index) => (
        <Box
          key={index}
          component="img"
          src={image}
          alt={`Slide ${index + 1}`}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: currentIndex === index ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
            zIndex: currentIndex === index ? 1 : 0,
          }}
        />
      ))}

      {/* Dots Navigation */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
          zIndex: 10,
        }}
      >
        {slideshowImages.map((_, index) => (
          <Box
            key={index}
            onClick={() => setCurrentIndex(index)}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: currentIndex === index 
                ? 'rgba(255, 255, 255, 0.9)' 
                : 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                transform: 'scale(1.2)',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default HeroCarousel;
