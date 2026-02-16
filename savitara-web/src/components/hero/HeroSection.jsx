import PropTypes from 'prop-types';
import { Box, Typography, Container, useTheme } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

// Keyframes for rotating circles
const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Pulsing glow animation
const pulseGlow = keyframes`
  0%, 100% { 
    opacity: 0.8; 
    transform: translate(-50%, -50%) scale(1);
    filter: blur(60px);
  }
  50% { 
    opacity: 1; 
    transform: translate(-50%, -50%) scale(1.2);
    filter: blur(80px);
  }
`;

// Floating animation for the hero image
const floatAnimation = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

// Rotating circle component for Sanskrit text
const RotatingCircle = styled('div')(({ theme, duration, radius, direction = 'normal' }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: `${radius * 2}px`,
  height: `${radius * 2}px`,
  marginTop: `-${radius}px`,
  marginLeft: `-${radius}px`,
  borderRadius: '50%',
  animation: `${rotate} ${duration}s linear infinite`,
  animationDirection: direction,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 5,
  
  // Make responsive
  [theme.breakpoints.down('md')]: {
    width: `${radius * 1.6}px`,
    height: `${radius * 1.6}px`,
    marginTop: `-${radius * 0.8}px`,
    marginLeft: `-${radius * 0.8}px`,
  },
  [theme.breakpoints.down('sm')]: {
    width: `${radius * 1.2}px`,
    height: `${radius * 1.2}px`,
    marginTop: `-${radius * 0.6}px`,
    marginLeft: `-${radius * 0.6}px`,
  },
}));

// Sun glow effect - Enhanced with vibrant colors and much stronger glow
const SunGlow = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '550px', // Extra large glow
  height: '550px',
  [theme.breakpoints.down('md')]: {
    width: '450px',
    height: '450px',
  },
  [theme.breakpoints.down('sm')]: {
    width: '320px',
    height: '320px',
  },
  background: theme.palette.mode === 'dark' 
    ? 'radial-gradient(circle, rgba(255,140,0,0.9) 0%, rgba(255,69,0,0.7) 25%, rgba(139,0,0,0.5) 50%, transparent 70%)'
    : 'radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(255,165,0,0.7) 25%, rgba(255,140,0,0.5) 50%, transparent 70%)',
  borderRadius: '50%',
  zIndex: 1,
  filter: 'blur(50px)',
  mixBlendMode: theme.palette.mode === 'dark' ? 'screen' : 'multiply',
  animation: `${pulseGlow} 4s ease-in-out infinite`,
}));

// Hero image container
const ImageContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: '650px', 
  height: '650px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  [theme.breakpoints.down('md')]: {
    height: '500px',
    maxWidth: '500px',
  },
  [theme.breakpoints.down('sm')]: {
    height: '380px', // Smaller height for mobile
    maxWidth: '100%',
  },
}));

// Main hero image - Removed border radius and border to allow transparency
const HeroImage = styled('img')(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: 'auto',
  maxWidth: '450px', // Larger image
  [theme.breakpoints.down('md')]: {
    maxWidth: '350px',
  },
  [theme.breakpoints.down('sm')]: {
    maxWidth: '260px',
  },
  objectFit: 'contain', // Changed to contain
  zIndex: 10,
  filter: theme.palette.mode === 'dark'
    ? 'drop-shadow(0 0 30px rgba(255, 140, 0, 0.6)) drop-shadow(0 0 60px rgba(255, 69, 0, 0.4))' // Stronger drop shadow
    : 'drop-shadow(0 10px 40px rgba(255, 140, 0, 0.5)) drop-shadow(0 0 20px rgba(255, 215, 0, 0.4))',
  animation: `${floatAnimation} 4s ease-in-out infinite`, // Floating animation
  mixBlendMode: 'normal', // Allow normal transparency blending
}));

const HeroSection = ({ height = '100vh' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Sanskrit verses - repeated to fill entire circumference
  const repeatText = (text, times) => {
    return new Array(times).fill(text).join(' • ');
  };

  const sanskritTexts = {
    inner: repeatText('ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥', 3),
    middle: repeatText('ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥', 2),
    outer: repeatText('ॐ भूर् भुवः स्वः तत् सवितुर्वरेण्यं भर्गो देवस्य धीमहि धियो यो नः प्रचोदयात्॥', 2),
  };

  return (
    <Box
      sx={{
        minHeight: height,
        display: 'flex',
        alignItems: 'center',
        background: isDark 
          ? 'linear-gradient(135deg, #1a0f00 0%, #2d1810 50%, #1a0f00 100%)'
          : 'linear-gradient(135deg, #FFF8E7 0%, #FFE4B5 50%, #FFDAB9 100%)',
        py: { xs: 4, md: 0 },
        transition: 'background 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark
            ? 'radial-gradient(circle at 20% 50%, rgba(255,140,0,0.08) 0%, transparent 50%)'
            : 'radial-gradient(circle at 80% 50%, rgba(255,215,0,0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Left Side - Text Content */}
          <Box
            sx={{
              flex: { xs: '1', md: '0 0 45%' },
              textAlign: { xs: 'center', md: 'left' },
              order: { xs: 1, md: 1 },
              zIndex: 10,
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4rem' },
                fontWeight: 700,
                color: isDark ? '#FFD700' : '#8B4513',
                mb: 2,
                lineHeight: 1.2,
                textShadow: isDark 
                  ? '0 0 20px rgba(255,215,0,0.4)'
                  : 'none',
                transition: 'color 0.3s ease',
              }}
            >
              Savitara
            </Typography>
            
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '1.25rem', md: '1.75rem', lg: '2rem' },
                fontWeight: 500,
                color: isDark ? '#FFA500' : '#FF8C00',
                mb: 3,
                fontStyle: 'italic',
                textShadow: isDark 
                  ? '0 0 15px rgba(255,165,0,0.3)'
                  : 'none',
                transition: 'color 0.3s ease',
              }}
            >
              आध्यात्मिक मार्गदर्शन का प्रकाश
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.125rem' },
                color: isDark ? '#D4A574' : '#5D4037',
                lineHeight: 1.8,
                mb: 4,
                maxWidth: '500px',
                mx: { xs: 'auto', md: 0 },
                transition: 'color 0.3s ease',
              }}
            >
              Connect with experienced Acharyas for authentic spiritual guidance rooted in Hindu
              traditions. Find clarity, peace, and purpose through personalized consultations that
              honor ancient wisdom and modern life.
            </Typography>
          </Box>

          {/* Right Side - Image with Rotating Sanskrit Circles */}
          <Box
            sx={{
              flex: { xs: '1', md: '0 0 50%' },
              order: { xs: 2, md: 2 },
              width: '100%',
            }}
          >
            <ImageContainer>
              {/* Sun Glow Background */}
              <SunGlow theme={theme} />

              {/* Rotating Sanskrit Circles - All centered at the same point */}
              {/* Inner Circle - radius 120px - INCREASED FONT SIZE */}
              <RotatingCircle radius={120} duration={30}>
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 250 250" 
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 12, overflow: 'visible' }}
                >
                  <defs>
                    <path
                      id="circleInner"
                      d="M 125, 125 m -120, 0 a 120,120 0 1,1 240,0 a 120,120 0 1,1 -240,0"
                    />
                  </defs>
                  <text
                    fill={isDark ? '#FFD700' : '#FF8C00'}
                    fontSize="18px" // INCREASED
                    fontFamily="Noto Sans Devanagari, sans-serif"
                    fontWeight="700" // BOLDER
                    letterSpacing="3px" // SPACED OUT
                    style={{ textShadow: '0 0 5px rgba(255, 140, 0, 0.4)' }} // GLOW
                  >
                    <textPath href="#circleInner" startOffset="0%">
                      {sanskritTexts.inner}
                    </textPath>
                  </text>
                </svg>
              </RotatingCircle>

              {/* Middle Circle - radius 180px - INCREASED FONT SIZE */}
              <RotatingCircle radius={180} duration={48}>
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 380 380" 
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 13, overflow: 'visible' }}
                >
                  <defs>
                    <path
                      id="circleMiddle"
                      d="M 190, 190 m -180, 0 a 180,180 0 1,1 360,0 a 180,180 0 1,1 -360,0"
                    />
                  </defs>
                  <text
                    fill={isDark ? '#FF8C00' : '#D2691E'}
                    fontSize="22px" // INCREASED
                    fontFamily="Noto Sans Devanagari, sans-serif"
                    fontWeight="700" // BOLDER
                    letterSpacing="4px" // SPACED OUT
                    style={{ textShadow: '0 0 8px rgba(255, 120, 0, 0.4)' }} // GLOW
                  >
                    <textPath href="#circleMiddle" startOffset="0%">
                      {sanskritTexts.middle}
                    </textPath>
                  </text>
                </svg>
              </RotatingCircle>

              {/* Outer Circle - radius 250px - INCREASED FONT SIZE */}
              <RotatingCircle radius={250} duration={65}>
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 520 520" 
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 14, overflow: 'visible' }}
                >
                  <defs>
                    <path
                      id="circleOuter"
                      d="M 260, 260 m -240, 0 a 240,240 0 1,1 480,0 a 240,240 0 1,1 -480,0"
                    />
                  </defs>
                  <text
                    fill={isDark ? '#FF4500' : '#8B4513'}
                    fontSize="26px" // INCREASED
                    fontFamily="Noto Sans Devanagari, sans-serif"
                    fontWeight="800" // EXTRA BOLD
                    letterSpacing="5px" // WIDE SPACING
                    style={{ textShadow: '0 0 10px rgba(255, 69, 0, 0.5)' }} // STRONG GLOW
                  >
                    <textPath href="#circleOuter" startOffset="0%">
                      {sanskritTexts.outer}
                    </textPath>
                  </text>
                </svg>
              </RotatingCircle>

              {/* Central Hero Image */}
              <HeroImage
                theme={theme}
                src="/assets/images/hero-image1.png"
                alt="Spiritual Guidance"
                onError={(e) => {
                  // Fallback to placeholder if image not found
                  e.target.src = 'https://via.placeholder.com/300x300/FF8C00/FFFFFF?text=Savitara';
                }}
              />
            </ImageContainer>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

HeroSection.propTypes = {
  height: PropTypes.string,
};

export default HeroSection;
