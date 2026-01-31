import React from 'react';
import { Box, Typography, Card, CardContent, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { 
  FaFire, FaOm, FaHeart, FaHome, FaStar, FaBook, FaCalendarAlt, 
  FaMoon, FaSun, FaPray, FaHandsHelping, FaLeaf
} from 'react-icons/fa';
import { GiTempleGate, GiLotus, GiPrayerBeads, GiIndianPalace } from 'react-icons/gi';

// Icon mapping for services
const serviceIcons = {
  'havan': FaFire,
  'pooja': FaPray,
  'vivaha': FaHeart,
  'grihapravesh': FaHome,
  'namkaran': FaStar,
  'astrology': FaMoon,
  'vastu': GiIndianPalace,
  'upanayanam': GiPrayerBeads,
  'shraddha': FaOm,
  'satyanarayan': GiLotus,
  'ganesh': FaOm,
  'navgraha': FaSun,
  'consultation': FaBook,
  'default': FaPray,
};

// Service Card Component
export const ServiceCard = ({
  service,
  onClick,
  variant = 'default', // 'default', 'icon-only', 'detailed'
}) => {
  const {
    id,
    name,
    icon = 'default',
    description,
    price,
    duration,
    color = '#FF9933',
  } = service;

  const IconComponent = serviceIcons[icon] || serviceIcons.default;

  if (variant === 'icon-only') {
    return (
      <motion.div
        whileHover={{ scale: 1.1, y: -5 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <Box
          onClick={() => onClick && onClick(id)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 2,
          }}
        >
          <Box
            sx={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 1,
              transition: 'all 0.3s ease',
              '&:hover': {
                background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
                boxShadow: `0 8px 24px ${color}40`,
                '& svg': {
                  color: '#FFFFFF',
                },
              },
            }}
          >
            <IconComponent size={28} color={color} />
          </Box>
          <Typography
            variant="body2"
            fontWeight={500}
            textAlign="center"
            sx={{ maxWidth: 80 }}
          >
            {name}
          </Typography>
        </Box>
      </motion.div>
    );
  }

  if (variant === 'detailed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -8 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          onClick={() => onClick && onClick(id)}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            cursor: 'pointer',
            height: '100%',
            background: '#FFFFFF',
            border: '1px solid #E8E8E8',
            '&:hover': {
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
              borderColor: color,
            },
          }}
        >
          <Box
            sx={{
              height: 120,
              background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative Pattern */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0.1,
                background: `repeating-linear-gradient(45deg, ${color}, ${color} 2px, transparent 2px, transparent 10px)`,
              }}
            />
            <IconComponent size={48} color={color} />
          </Box>

          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {description}
            </Typography>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              {price && (
                <Typography variant="h6" color={color} fontWeight={700}>
                  ₹{price}
                </Typography>
              )}
              {duration && (
                <Typography variant="body2" color="text.secondary">
                  {duration}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)' }}
      transition={{ duration: 0.3 }}
    >
      <Card
        onClick={() => onClick && onClick(id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          borderRadius: 3,
          cursor: 'pointer',
          background: '#FFFFFF',
          '&:hover': {
            borderColor: color,
          },
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 2,
          }}
        >
          <IconComponent size={24} color={color} />
        </Box>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {name}
          </Typography>
          {price && (
            <Typography variant="body2" color="text.secondary">
              Starting from ₹{price}
            </Typography>
          )}
        </Box>
        <IconButton size="small">
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              transform: 'rotate(-45deg)',
              color: color,
            }}
          >
            →
          </Box>
        </IconButton>
      </Card>
    </motion.div>
  );
};

// Services Grid Component
export const ServicesGrid = ({ services, onServiceClick, variant = 'icon-only' }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(3, 1fr)',
          sm: 'repeat(4, 1fr)',
          md: 'repeat(6, 1fr)',
        },
        gap: { xs: 2, md: 3 },
      }}
    >
      {services.map((service, index) => (
        <motion.div
          key={service.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <ServiceCard
            service={service}
            onClick={onServiceClick}
            variant={variant}
          />
        </motion.div>
      ))}
    </Box>
  );
};

export default ServiceCard;