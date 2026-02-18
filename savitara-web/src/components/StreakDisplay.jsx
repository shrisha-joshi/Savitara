import { Box, Typography, Paper, Tooltip, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { FaFire } from 'react-icons/fa';

/**
 * StreakDisplay Component
 * Shows user's current streak with visual flair
 * 
 * Usage:
 * <StreakDisplay streak={7} goal={30} />
 */

function StreakDisplay({ 
  streak = 0, 
  goal = 30, 
  variant = 'full', // 'full' | 'compact' | 'minimal'
}) {
  const progress = Math.min((streak / goal) * 100, 100);
  
  // Determine streak tier
  const getStreakTier = (days) => {
    if (days >= 30) return { name: 'Legendary', color: '#9B59B6', icon: '👑' };
    if (days >= 14) return { name: 'Elite', color: '#FFD700', icon: '⭐' };
    if (days >= 7) return { name: 'Committed', color: '#34C759', icon: '💪' };
    if (days >= 3) return { name: 'Getting Started', color: '#007AFF', icon: '🌱' };
    return { name: 'Beginner', color: '#6B7A90', icon: '🔰' };
  };

  const tier = getStreakTier(streak);

  // Minimal variant - just icon and number
  if (variant === 'minimal') {
    return (
      <Tooltip title={`${streak}-day streak! Keep it going!`} arrow>
        <Box display="inline-flex" alignItems="center" gap={0.5}>
          <motion.div
            animate={{ 
              scale: streak > 0 ? [1, 1.2, 1] : 1,
            }}
            transition={{ 
              duration: 0.5,
              repeat: streak > 0 ? Infinity : 0,
              repeatDelay: 2,
            }}
          >
            <FaFire color={streak > 0 ? '#FF6B35' : '#CCC'} size={20} />
          </motion.div>
          <Typography fontWeight={600} color={streak > 0 ? '#FF6B35' : 'text.secondary'}>
            {streak}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  // Compact variant - horizontal layout
  if (variant === 'compact') {
    return (
      <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <motion.div
          animate={{ 
            scale: [1, 1.15, 1],
            rotate: [0, -10, 10, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        >
          <FaFire color="#FF6B35" size={32} />
        </motion.div>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700}>
            {streak} Day Streak!
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {goal - streak} days to {tier.name} status
          </Typography>
        </Box>
      </Paper>
    );
  }

  // Full variant - detailed card
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${tier.color}15 0%, ${tier.color}05 100%)`,
          border: `2px solid ${tier.color}30`,
          borderRadius: 3,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, -15, 15, 0],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              >
                <FaFire color="#FF6B35" size={36} />
              </motion.div>
              <Typography variant="h3" fontWeight={700} color={tier.color}>
                {streak}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
                days
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Current Streak
            </Typography>
          </Box>
          
          <Tooltip title={`${tier.name} Tier`} arrow>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                bgcolor: `${tier.color}20`,
                border: `1px solid ${tier.color}`,
              }}
            >
              <Typography fontSize={16}>{tier.icon}</Typography>
              <Typography variant="caption" fontWeight={600} color={tier.color}>
                {tier.name}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">
              Progress to next milestone
            </Typography>
            <Typography variant="caption" fontWeight={600} color={tier.color}>
              {streak}/{goal} days
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: `${tier.color}20`,
              '& .MuiLinearProgress-bar': {
                bgcolor: tier.color,
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {/* Motivational message */}
        <Box mt={2}>
          {streak === 0 && (
            <Typography variant="body2" color="text.secondary">
              🌟 Start your streak today! Book a consultation to begin.
            </Typography>
          )}
          {streak >= 1 && streak < 3 && (
            <Typography variant="body2" color="text.secondary">
              💪 Great start! Keep the momentum going!
            </Typography>
          )}
          {streak >= 3 && streak < 7 && (
            <Typography variant="body2" color="text.secondary">
              🔥 You're on fire! {7 - streak} more days to unlock Committed tier.
            </Typography>
          )}
          {streak >= 7 && streak < 14 && (
            <Typography variant="body2" color="text.secondary">
              ⭐ Amazing consistency! {14 - streak} days to Elite status.
            </Typography>
          )}
          {streak >= 14 && streak < 30 && (
            <Typography variant="body2" color="text.secondary">
              👑 Impressive dedication! {30 - streak} days to Legendary tier!
            </Typography>
          )}
          {streak >= 30 && (
            <Typography variant="body2" fontWeight={600} color={tier.color}>
              🏆 LEGENDARY STREAK! You're an inspiration to all seekers!
            </Typography>
          )}
        </Box>
      </Paper>
    </motion.div>
  );
}

/**
 * StreakCalendar Component (Mini version)
 * Shows last 7 days with check marks
 */
export function StreakCalendar({ activeDays = [] }) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      active: activeDays.includes(date.toISOString().split('T')[0]),
    };
  });

  return (
    <Box display="flex" gap={0.5}>
      {last7Days.map((day) => (
        <Tooltip key={`${day.day}-${day.date}`} title={`${day.day} ${day.date}`} arrow>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: day.active ? '#34C759' : '#E5E5E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 2,
              },
            }}
          >
            {day.active ? (
              <motion.div
 initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              >
                <Typography color="white" fontWeight={700}>✓</Typography>
              </motion.div>
            ) : (
              <Typography color="text.secondary" fontSize={12}>{day.day[0]}</Typography>
            )}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

StreakDisplay.propTypes = {
  streak: PropTypes.number,
  goal: PropTypes.number,
  variant: PropTypes.oneOf(['full', 'compact', 'minimal']),
};

StreakCalendar.propTypes = {
  activeDays: PropTypes.arrayOf(PropTypes.string),
};

export default StreakDisplay;
