import React from 'react';
import { Box, Typography, Card, CardContent, CardMedia, Button, Rating, Chip, Avatar, IconButton, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import { FaStar, FaMapMarkerAlt, FaClock, FaHeart, FaRegHeart, FaUserCircle, FaComments, FaCalendarCheck } from 'react-icons/fa';

// Acharya Card Component
export const AcharyaCard = ({ 
  acharya, 
  onBook, 
  onViewProfile, 
  onChat,
  onFavorite,
  isFavorite = false,
  variant = 'default' // 'default', 'compact', 'featured'
}) => {
  const {
    id: originalId,
    _id,
    user_id,
    name,
    profileImage: _profileImage,
    image: _image,
    specializations: _specializations,
    specialization: _specialization,
    rating = 0,
    reviewCount = 0,
    experience_years,
    experience: _experience,
    location,
    // Price hidden as per requirement
    price,
    description,
    isVerified: _isVerified,
    is_verified: _is_verified,
    languages,
    isAvailable = true,
  } = acharya;
  
  const id = originalId || _id || user_id;

  // Map backend fields to frontend expected fields if needed
  const profileImage = _profileImage || _image;
  const specializations = _specializations || (_specialization ? (Array.isArray(_specialization) ? _specialization : [_specialization]) : []);
  const experience = experience_years || _experience || 0;
  const isVerified = _isVerified || _is_verified || false;


  const formatLocation = (loc) => {
    if (!loc) return 'Location not available';
    if (typeof loc === 'string') return loc;
    const parts = [loc.city, loc.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not available';
  };

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          sx={{
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 3,
            cursor: 'pointer',
            '&:hover': {
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            },
          }}
          onClick={() => onViewProfile && onViewProfile(id)}
        >
          <Avatar
            src={profileImage}
            alt={name}
            sx={{ width: 60, height: 60, mr: 2 }}
          />
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight={600}>{name}</Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <FaStar color="#FFD700" size={14} />
              <Typography variant="body2" color="text.secondary">
                {rating.toFixed(1)} ({reviewCount})
              </Typography>
            </Box>
          </Box>
        </Card>
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -8 }}
        transition={{ duration: 0.4 }}
      >
        <Card
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF8E1 100%)',
            border: '2px solid #FFD700',
            boxShadow: '0 8px 32px rgba(255, 153, 51, 0.2)',
            '&:hover': {
              boxShadow: '0 16px 48px rgba(255, 153, 51, 0.3)',
            },
          }}
        >
          {/* Featured Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: -30,
              background: 'linear-gradient(135deg, #FF9933 0%, #FFD700 100%)',
              color: '#1A2233',
              padding: '6px 40px',
              fontSize: '0.75rem',
              fontWeight: 700,
              transform: 'rotate(-45deg)',
              zIndex: 10,
            }}
          >
            FEATURED
          </Box>


          {profileImage ? (
            <CardMedia
              component="img"
              height="200"
              image={profileImage}
              alt={name}
              sx={{ objectFit: 'cover' }}
            />
          ) : (
            <Box 
              sx={{ 
                height: 200, 
                bgcolor: '#f5f5f5', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#bdbdbd'
              }}
            >
              <FaUserCircle size={80} />
            </Box>
          )}
          
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                <Typography variant="h6" fontWeight={700} color="#1A2233">
                  {name}
                </Typography>
                {isVerified && (
                  <Chip 
                    label="✓ Verified" 
                    size="small" 
                    sx={{ 
                      backgroundColor: '#34C759', 
                      color: '#FFF',
                      fontWeight: 600,
                      mt: 0.5,
                    }} 
                  />
                )}
              </Box>
              <IconButton onClick={() => onFavorite && onFavorite(id)}>
                {isFavorite ? <FaHeart color="#DC143C" /> : <FaRegHeart color="#6B7A90" />}
              </IconButton>
            </Box>

            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Rating value={rating} precision={0.1} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">
                {rating.toFixed(1)} ({reviewCount} reviews)
              </Typography>
            </Box>

            <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
              {specializations.slice(0, 3).map((spec, idx) => (
                <Chip
                  key={idx}
                  label={spec}
                  size="small"
                  sx={{
                    backgroundColor: '#FFF8E1',
                    color: '#FF9933',
                    fontWeight: 500,
                    border: '1px solid #FF9933',
                  }}
                />
              ))}
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <FaMapMarkerAlt size={12} /> {formatLocation(location)}
                </Typography>
                <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                  <FaClock size={12} /> {experience} years exp
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={1} mt={2}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<FaComments />}
                onClick={(e) => { e.stopPropagation(); onChat && onChat(id); }}
                sx={{ borderRadius: 2 }}
              >
                Chat
              </Button>
              <Button
                variant="contained"
                fullWidth
                startIcon={<FaCalendarCheck />}
                onClick={(e) => { e.stopPropagation(); onBook && onBook(id, 'request'); }}
                disabled={!isAvailable}
                sx={{
                  background: 'linear-gradient(135deg, #FF9933 0%, #FFD700 100%)',
                  color: '#1A2233',
                  fontWeight: 600,
                  borderRadius: 2,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FFD700 0%, #FF9933 100%)',
                  },
                }}
              >
                Request
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)' }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={() => onViewProfile && onViewProfile(id)}
      >
        <Box position="relative">
          {profileImage ? (
            <CardMedia
              component="img"
              height="180"
              image={profileImage}
              alt={name}
              sx={{ objectFit: 'cover' }}
            />
          ) : (
             <Box 
              sx={{ 
                height: 180, 
                bgcolor: '#f5f5f5', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#bdbdbd'
              }}
            >
              <FaUserCircle size={64} />
            </Box>
          )}
          {isVerified && (
            <Chip
              label="✓ Verified"
              size="small"
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: '#34C759',
                color: '#FFF',
                fontWeight: 600,
              }}
            />
          )}
          <IconButton
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onFavorite && onFavorite(id);
            }}
          >
            {isFavorite ? <FaHeart color="#DC143C" size={16} /> : <FaRegHeart color="#6B7A90" size={16} />}
          </IconButton>
        </Box>

        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {name}
          </Typography>

          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <FaStar color="#FFD700" size={16} />
            <Typography variant="body2" fontWeight={500}>
              {rating.toFixed(1)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({reviewCount} reviews)
            </Typography>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            {specializations.slice(0, 2).map((spec, idx) => (
              <Chip
                key={idx}
                label={spec}
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {specializations.length > 2 && (
              <Chip label={`+${specializations.length - 2}`} size="small" variant="outlined" />
            )}
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="body2" color="text.secondary">
              <FaMapMarkerAlt size={10} /> {formatLocation(location)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<FaComments />}
              onClick={(e) => { e.stopPropagation(); onChat && onChat(id); }}
            >
              Chat
            </Button>
            <Button
              variant="contained"
              size="small"
              fullWidth
              startIcon={<FaCalendarCheck />}
              onClick={(e) => { e.stopPropagation(); onBook && onBook(id, 'request'); }}
              disabled={!isAvailable}
              sx={{
                background: 'linear-gradient(135deg, #FF9933 0%, #FFD700 100%)',
                color: '#1A2233',
                fontWeight: 600,
              }}
            >
              Request
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AcharyaCard;