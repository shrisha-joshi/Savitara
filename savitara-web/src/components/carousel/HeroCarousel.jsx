import React, { useState, useEffect } from 'react';
import Slider from 'react-slick';
import { Box, Typography, Button, Container, IconButton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronLeft, FaChevronRight, FaPlay, FaPause } from 'react-icons/fa';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Hero Carousel Slides Data - Using verified Unsplash images for authentic Brahmin culture
const defaultSlides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1582510003544-4b003b9835f5?auto=format&fit=crop&w=1920&q=80',
    title: 'Experience Divine Blessings',
    subtitle: 'Connect with verified Acharyas for authentic Vedic rituals',
    cta: { text: 'Find Acharya', link: '/search' },
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3))',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1623836376842-1e9671d49265?auto=format&fit=crop&w=1920&q=80',
    title: 'Powerful Homa & Yajna',
    subtitle: 'Ancient fire rituals performed with strict adherence to scriptures',
    cta: { text: 'Explore Services', link: '/search?service=homa' },
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2))',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1604904612715-47bf9d9bc664?auto=format&fit=crop&w=1920&q=80',
    title: 'Sacred Vivaha Sanskar',
    subtitle: 'Traditional matrimonial ceremonies for a blessed union',
    cta: { text: 'Plan Wedding', link: '/search?service=vivaha' },
    overlay: 'rgba(26, 34, 51, 0.5)',
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1596282869904-44161b36c449?auto=format&fit=crop&w=1920&q=80',
    title: 'Spiritual Consultation',
    subtitle: 'Guidance from experienced Purohits and Astrologers',
    cta: { text: 'Book Now', link: '/search?service=consultation' },
    overlay: 'linear-gradient(135deg, rgba(139, 69, 19, 0.6), rgba(218, 165, 32, 0.4))',
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1606216794074-735e56336c7a?auto=format&fit=crop&w=1920&q=80',
    title: 'Vedic Learning',
    subtitle: 'Preserving our heritage through education and practice',
    cta: { text: 'Learn More', link: '/search?service=education' },
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
];

// Custom Arrow Components
const CustomPrevArrow = ({ onClick }) => (
  <IconButton
    onClick={onClick}
    sx={{
      position: 'absolute',
      left: { xs: 10, md: 30 },
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      color: '#FFFFFF',
      width: { xs: 40, md: 56 },
      height: { xs: 40, md: 56 },
      '&:hover': {
        backgroundColor: 'rgba(255, 153, 51, 0.8)',
        transform: 'translateY(-50%) scale(1.1)',
      },
      transition: 'all 0.3s ease',
    }}
  >
    <FaChevronLeft size={24} />
  </IconButton>
);

const CustomNextArrow = ({ onClick }) => (
  <IconButton
    onClick={onClick}
    sx={{
      position: 'absolute',
      right: { xs: 10, md: 30 },
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      color: '#FFFFFF',
      width: { xs: 40, md: 56 },
      height: { xs: 40, md: 56 },
      '&:hover': {
        backgroundColor: 'rgba(255, 153, 51, 0.8)',
        transform: 'translateY(-50%) scale(1.1)',
      },
      transition: 'all 0.3s ease',
    }}
  >
    <FaChevronRight size={24} />
  </IconButton>
);

const HeroCarousel = ({ 
  slides = defaultSlides, 
  autoplaySpeed = 5000,
  height = '100vh',
  onSlideClick
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sliderRef, setSliderRef] = useState(null);

  const settings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: isPlaying,
    autoplaySpeed: autoplaySpeed,
    pauseOnHover: true,
    fade: true,
    cssEase: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    beforeChange: (current, next) => setCurrentSlide(next),
    prevArrow: <CustomPrevArrow />,
    nextArrow: <CustomNextArrow />,
    appendDots: dots => (
      <Box
        sx={{
          position: 'absolute',
          bottom: 40,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          '& ul': {
            display: 'flex',
            gap: '12px',
            padding: 0,
            margin: 0,
            listStyle: 'none',
          },
        }}
      >
        <ul>{dots}</ul>
      </Box>
    ),
    customPaging: (i) => (
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: i === currentSlide 
            ? 'rgba(255, 215, 0, 0.9)' 
            : 'rgba(255, 255, 255, 0.4)',
          border: i === currentSlide ? '2px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.3)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: i === currentSlide 
              ? 'rgba(255, 215, 0, 1)' 
              : 'rgba(255, 255, 255, 0.6)',
            transform: 'scale(1.2)',
          },
        }}
      />
    ),
  };

  const toggleAutoplay = () => {
    setIsPlaying(!isPlaying);
    if (sliderRef) {
      isPlaying ? sliderRef.slickPause() : sliderRef.slickPlay();
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        height: height,
        overflow: 'hidden',
        marginTop: 0, 
        marginBottom: 0,
        '& .slick-slider, & .slick-list, & .slick-track': {
          height: '100%',
        },
        '& .slick-slide > div': {
          height: '100%',
        },
      }}
    >
      <Slider ref={setSliderRef} {...settings}>
        {slides.map((slide, index) => (
          <Box key={slide.id} sx={{ height: '100%' }}>
            <Box
              sx={{
                height: '100%',
                position: 'relative',
                backgroundImage: `url(${slide.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                cursor: onSlideClick ? 'pointer' : 'default',
              }}
              onClick={() => onSlideClick && onSlideClick(slide)}
            >
              {/* Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: slide.overlay,
                }}
              />

              {/* Content */}
              <Container
                maxWidth="lg"
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 5,
                }}
              >
                <AnimatePresence mode="wait">
                  {currentSlide === index && (
                    <motion.div
                      key={slide.id}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ maxWidth: '700px' }}
                    >
                      {/* Sanskrit Om Symbol */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                      >
                        <Typography
                          sx={{
                            fontFamily: '"Noto Sans Devanagari", serif',
                            fontSize: { xs: '2rem', md: '3rem' },
                            color: '#FFD700',
                            marginBottom: 1,
                            textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                          }}
                        >
                          ॐ
                        </Typography>
                      </motion.div>

                      {/* Title */}
                      <Typography
                        variant="h1"
                        sx={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem', lg: '4rem' },
                          fontWeight: 700,
                          color: '#FFFFFF',
                          lineHeight: 1.2,
                          marginBottom: 2,
                          textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        {slide.title}
                      </Typography>

                      {/* Subtitle */}
                      <Typography
                        variant="h5"
                        sx={{
                          fontFamily: '"Inter", sans-serif',
                          fontSize: { xs: '1rem', md: '1.25rem' },
                          fontWeight: 400,
                          color: 'rgba(255, 255, 255, 0.9)',
                          lineHeight: 1.6,
                          marginBottom: 4,
                          maxWidth: '600px',
                        }}
                      >
                        {slide.subtitle}
                      </Typography>

                      {/* CTA Button */}
                      {slide.cta && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4, duration: 0.5 }}
                        >
                          <Button
                            variant="contained"
                            size="large"
                            href={slide.cta.link}
                            sx={{
                              background: 'linear-gradient(135deg, #FF9933 0%, #FFD700 100%)',
                              color: '#1A2233',
                              fontWeight: 600,
                              fontSize: { xs: '1rem', md: '1.125rem' },
                              padding: { xs: '12px 28px', md: '16px 40px' },
                              borderRadius: '50px',
                              boxShadow: '0 8px 32px rgba(255, 153, 51, 0.4)',
                              textTransform: 'none',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #FFD700 0%, #FF9933 100%)',
                                transform: 'translateY(-3px)',
                                boxShadow: '0 12px 40px rgba(255, 215, 0, 0.5)',
                              },
                              transition: 'all 0.3s ease',
                            }}
                          >
                            {slide.cta.text}
                          </Button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Container>
            </Box>
          </Box>
        ))}
      </Slider>

      {/* Play/Pause Button */}
      <IconButton
        onClick={toggleAutoplay}
        sx={{
          position: 'absolute',
          bottom: 40,
          right: 30,
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: 'rgba(255, 153, 51, 0.8)',
          },
        }}
      >
        {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} />}
      </IconButton>

      {/* Decorative Bottom Border */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #FF9933 0%, #FFD700 50%, #FF9933 100%)',
        }}
      />
    </Box>
  );
};

export default HeroCarousel;