import { useEffect } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';

/**
 * ConfettiCelebration Component
 * Triggers confetti animation for celebration moments
 * 
 * Usage:
 * <ConfettiCelebration 
 *   trigger={showConfetti} 
 *   type="success" 
 *   duration={3000}
 * />
 */

const CONFETTI_CONFIGS = {
  success: {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#34C759', '#FFD700', '#FF9933', '#FFFFFF'],
  },
  celebration: {
    particleCount: 150,
    spread: 90,
    origin: { y: 0.5 },
    colors: ['#FF6B35', '#FFD700', '#34C759', '#007AFF', '#FF3B30'],
    ticks: 200,
  },
  subtle: {
    particleCount: 50,
    spread: 50,
    origin: { y: 0.7 },
    colors: ['#FFD700', '#FF9933'],
    ticks: 150,
  },
  fireworks: {
    particleCount: 80,
    spread: 360,
    startVelocity: 30,
    decay: 0.9,
    scalar: 1.2,
    colors: ['#FFD700', '#FF6B35', '#34C759', '#007AFF'],
  },
};

function ConfettiCelebration({ 
  trigger = false, 
  type = 'success',
  duration = 3000,
  onComplete,
}) {
  useEffect(() => {
    if (!trigger) return;

    const config = CONFETTI_CONFIGS[type] || CONFETTI_CONFIGS.success;
    
    // Single burst
    if (type !== 'fireworks') {
      confetti({
        ...config,
        disableForReducedMotion: true,
      });
      
      if (onComplete) {
        setTimeout(onComplete, duration);
      }
      return;
    }

    // Fireworks effect - multiple bursts
    const count = 5;
    const interval = duration / count;
    let burstCount = 0;

    const fireworksInterval = setInterval(() => {
      confetti({
        ...config,
        origin: {
          x: Math.random() * 0.6 + 0.2, // Random x between 0.2 and 0.8
          y: Math.random() * 0.4 + 0.3, // Random y between 0.3 and 0.7
        },
        disableForReducedMotion: true,
      });

      burstCount++;
      if (burstCount >= count) {
        clearInterval(fireworksInterval);
        if (onComplete) {
          setTimeout(onComplete, 500);
        }
      }
    }, interval);

    return () => clearInterval(fireworksInterval);
  }, [trigger, type, duration, onComplete]);

  return null; // This component doesn't render anything
}

ConfettiCelebration.propTypes = {
  trigger: PropTypes.bool,
  type: PropTypes.oneOf(['success', 'celebration', 'subtle', 'fireworks']),
  duration: PropTypes.number,
  onComplete: PropTypes.func,
};

export default ConfettiCelebration;
