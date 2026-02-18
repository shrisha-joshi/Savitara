/**
 * Personalization utilities for Savitara
 * Smart greetings, recommendations, and contextual content
 */

/**
 * Get time-based greeting
 * @param {string} name - User's name
 * @param {string} language - Optional language code (default: 'en')
 * @returns {object} { greeting, emoji, message }
 */
export const getTimeBasedGreeting = (name = 'Guest') => {
  const hour = new Date().getHours();
  const firstName = name?.split(' ')[0] || name;

  // Morning: 4 AM - 11:59 AM
  if (hour >= 4 && hour < 12) {
    return {
      greeting: `Suprabhat, ${firstName}! 🌅`,
      emoji: '🌅',
      message: 'May your day be filled with divine blessings.',
      timeOfDay: 'morning',
    };
  }

  // Afternoon: 12 PM - 4:59 PM
  if (hour >= 12 && hour < 17) {
    return {
      greeting: `Namaste, ${firstName}! 🙏`,
      emoji: '🙏',
      message: 'Hope your day is going well.',
      timeOfDay: 'afternoon',
    };
  }

  // Evening: 5 PM - 7:59 PM
  if (hour >= 17 && hour < 20) {
    return {
      greeting: `Good Evening, ${firstName}! 🌆`,
      emoji: '🌆',
      message: 'Winding down from a productive day?',
      timeOfDay: 'evening',
    };
  }

  // Night: 8 PM - 3:59 AM
  return {
    greeting: `Shubh Ratri, ${firstName}! 🌙`,
    emoji: '🌙',
    message: 'Rest well and prepare for tomorrow.',
    timeOfDay: 'night',
  };
};

/**
 * Get contextualized greeting based on user activity
 * @param {object} user - User object with activity data
 * @returns {string} Personalized message
 */
export const getContextualGreeting = (user) => {
  const { total_bookings, last_booking_date, role, streak_days } = user;

  // New user (no bookings)
  if (!total_bookings || total_bookings === 0) {
    return role === 'acharya'
      ? 'Welcome! Complete your profile to start receiving booking requests.'
      : 'Welcome to Savitara! Find your perfect spiritual guide and begin your journey.';
  }

  // Returning user with streak
  if (streak_days && streak_days >= 7) {
    return `🔥 Amazing ${streak_days}-day streak! Your spiritual journey is inspiring.`;
  }

  // User with many bookings
  if (total_bookings >= 10) {
    return `You've completed ${total_bookings} consultations! Your dedication is commendable. 🙏`;
  }

  // Recent booking
  if (last_booking_date) {
    const lastBookingTime = new Date(last_booking_date).getTime();
    const daysSinceLastBooking = Math.floor(
      (Date.now() - lastBookingTime) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastBooking < 7) {
      return 'Your recent consultation was wonderful! Ready for the next step?';
    }

    if (daysSinceLastBooking >= 30) {
      return 'We missed you! Reconnect with your spiritual practice today.';
    }
  }

  // Default
  return 'Your spiritual journey continues today.';
};

/**
 * Get Acharya recommendations based on user history
 * @param {array} pastBookings - User's past bookings
 * @param {array} allAcharyas - Available Acharyas
 * @returns {array} Recommended Acharyas
 */
export const getAcharyaRecommendations = (pastBookings = [], allAcharyas = []) => {
  if (!pastBookings.length) {
    // New user - recommend top-rated Acharyas
    return allAcharyas
      .filter(a => a.rating >= 4.5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
  }

  // Get specializations from past bookings
  const preferredSpecializations = pastBookings
    .flatMap(b => b.acharya?.specializations || [])
    .reduce((acc, spec) => {
      acc[spec] = (acc[spec] || 0) + 1;
      return acc;
    }, {});

  // Get most common specialization
  const topSpecialization = Object.keys(preferredSpecializations).sort(
    (a, b) => preferredSpecializations[b] - preferredSpecializations[a]
  )[0];

  // Recommend Acharyas with similar specializations, but not previously booked
  const bookedAcharyaIds = new Set(pastBookings.map(b => b.acharya_id || b.acharya?._id));
  
  return allAcharyas
    .filter(a => 
      !bookedAcharyaIds.has(a._id || a.id) &&
      a.specializations?.includes(topSpecialization)
    )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
};

/**
 * Get suggested Poojas based on upcoming Hindu calendar events
 * @param {object} panchangaData - Today's Panchanga data
 * @returns {array} Suggested Poojas
 */
export const getSuggestedPoojas = (panchangaData) => {
  const suggestions = [];
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Monday - Shiva Poojas
  if (dayOfWeek === 1) {
    suggestions.push({
      name: 'Rudrabhishek',
      reason: 'Today is Monday - auspicious for Lord Shiva worship',
      icon: '🔱',
    });
  }

  // Friday - Lakshmi/Durga Poojas
  if (dayOfWeek === 5) {
    suggestions.push({
      name: 'Lakshmi Pooja',
      reason: 'Today is Friday - auspicious for Goddess Lakshmi',
      icon: '🪔',
    });
  }

  // Saturday - Hanuman/Shani Poojas
  if (dayOfWeek === 6) {
    suggestions.push({
      name: 'Hanuman Chalisa Path',
      reason: 'Today is Saturday - ideal for Lord Hanuman worship',
      icon: '🙏',
    });
  }

  // Check for specific tithis from Panchanga
  if (panchangaData?.tithi?.toLowerCase().includes('ekadashi')) {
    suggestions.push({
      name: 'Vishnu Pooja',
      reason: `Today is ${panchangaData.tithi} - highly auspicious for Lord Vishnu`,
      icon: '🕉️',
    });
  }

  if (panchangaData?.tithi?.toLowerCase().includes('amavasya')) {
    suggestions.push({
      name: 'Pitru Tarpan',
      reason: 'Today is Amavasya - ideal for ancestor worship',
      icon: '🕉️',
    });
  }

  if (panchangaData?.tithi?.toLowerCase().includes('purnima')) {
    suggestions.push({
      name: 'Satyanarayan Pooja',
      reason: 'Today is Purnima (Full Moon) - auspicious for Satyanarayan Katha',
      icon: '🌕',
    });
  }

  return suggestions.length > 0 ? suggestions : [
    {
      name: 'Daily Sandhya Aarti',
      reason: 'Start or end your day with divine blessings',
      icon: '🪔',
    }
  ];
};

/**
 * Generate motivational milestone messages
 * @param {number} totalBookings - User's total bookings
 * @returns {object} Milestone info
 */
export const getMilestoneMessage = (totalBookings) => {
  const milestones = [
    { count: 1, message: '🎉 Your first spiritual consultation! This is the beginning of a beautiful journey.', badge: 'First Step' },
    { count: 5, message: '🌟 5 consultations completed! You\'re building a strong spiritual practice.', badge: 'Dedicated Seeker' },
    { count: 10, message: '🏆 10 consultations! Your commitment to growth is inspiring.', badge: 'Spiritual Warrior' },
    { count: 25, message: '💎 25 consultations! You\'re a true devotee on the path.', badge: 'Enlightened Soul' },
    { count: 50, message: '👑 50 consultations! Your dedication has reached new heights.', badge: 'Spiritual Master' },
    { count: 100, message: '🕉️ 100 consultations! You are an inspiration to all seekers.', badge: 'Divine Guide' },
  ];

  return milestones.find(m => m.count === totalBookings) || null;
};

/**
 * Get smart notification message based on user inactivity
 * @param {number} daysSinceLastLogin - Days since user last logged in
 * @returns {string} Notification message
 */
export const getRetentionMessage = (daysSinceLastLogin) => {
  if (daysSinceLastLogin < 7) return null;
  
  if (daysSinceLastLogin >= 30) {
    return 'We missed you! 🙏 Come back and continue your spiritual journey. Special offers await!';
  }
  
  if (daysSinceLastLogin >= 14) {
    return 'It\'s been a while! Reconnect with your spiritual practice today.';
  }
  
  return 'Your spiritual guides are waiting! Book a consultation today.';
};

export default {
  getTimeBasedGreeting,
  getContextualGreeting,
  getAcharyaRecommendations,
  getSuggestedPoojas,
  getMilestoneMessage,
  getRetentionMessage,
};
