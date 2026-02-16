import { Box, Typography } from '@mui/material';

// Sanskrit-style brand logo component
const SavitaraBrand = ({ 
  variant = 'default', // 'default', 'white', 'gold', 'gradient'
  size = 'medium', // 'small', 'medium', 'large', 'xlarge'
  withTagline = false,
  sx = {} 
}) => {
  const sizeMap = {
    small: { fontSize: '1.5rem', taglineSize: '0.7rem' },
    medium: { fontSize: '2.5rem', taglineSize: '0.875rem' },
    large: { fontSize: '3.5rem', taglineSize: '1rem' },
    xlarge: { fontSize: '5rem', taglineSize: '1.25rem' },
  };

  const colorMap = {
    default: {
      color: '#FF9933',
      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)',
    },
    white: {
      color: '#FFFFFF',
      textShadow: '2px 2px 8px rgba(0, 0, 0, 0.5)',
    },
    gold: {
      color: '#FFD700',
      textShadow: '2px 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 215, 0, 0.3)',
    },
    gradient: {
      background: 'linear-gradient(135deg, #FF9933 0%, #FFD700 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      textShadow: 'none',
    },
  };

  const { fontSize, taglineSize } = sizeMap[size];
  const colorStyle = colorMap[variant];

  return (
    <Box sx={{ textAlign: 'center', ...sx }}>
      {/* Om Symbol */}
      <Typography
        component="span"
        sx={{
          fontFamily: '"Noto Sans Devanagari", serif',
          fontSize: `calc(${fontSize} * 0.6)`,
          color: variant === 'white' ? '#FFFFFF' : '#FFD700',
          display: 'block',
          marginBottom: '-8px',
          opacity: 0.9,
        }}
      >
        ॐ
      </Typography>
      
      {/* Main Brand Name - Sanskrit Style */}
      <Typography
        component="h1"
        sx={{
          fontFamily: '"Samarkan", "Times New Roman", serif',
          fontSize: fontSize,
          fontWeight: 400,
          letterSpacing: '4px',
          lineHeight: 1.2,
          ...colorStyle,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.02)',
          },
        }}
      >
        Savitara
      </Typography>

      {/* Tagline */}
      {withTagline && (
        <Typography
          component="p"
          sx={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: taglineSize,
            fontWeight: 400,
            letterSpacing: '2px',
            color: variant === 'white' ? 'rgba(255,255,255,0.9)' : '#6B7A90',
            marginTop: '8px',
            textTransform: 'uppercase',
          }}
        >
          Divine Connections • Sacred Services
        </Typography>
      )}

      {/* Decorative Line */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '12px',
          gap: '12px',
        }}
      >
        <Box
          sx={{
            width: '40px',
            height: '2px',
            background: variant === 'white' 
              ? 'linear-gradient(90deg, transparent, #FFD700)' 
              : 'linear-gradient(90deg, transparent, #FF9933)',
          }}
        />
        <Typography
          sx={{
            color: '#FFD700',
            fontSize: '1rem',
          }}
        >
          ✦
        </Typography>
        <Box
          sx={{
            width: '40px',
            height: '2px',
            background: variant === 'white'
              ? 'linear-gradient(90deg, #FFD700, transparent)'
              : 'linear-gradient(90deg, #FF9933, transparent)',
          }}
        />
      </Box>
    </Box>
  );
};

export default SavitaraBrand;