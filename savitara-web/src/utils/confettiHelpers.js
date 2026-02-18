/**
 * Confetti helper functions
 * Separated from component for Fast Refresh compatibility
 */
import confetti from 'canvas-confetti';

export const triggerConfetti = (type = 'success') => {
  const configs = {
    success: {
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#4caf50', '#81c784', '#fff'],
    },
    achievement: {
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#ffeb3b', '#fff'],
    },
    milestone: {
      particleCount: 200,
      spread: 120,
      startVelocity: 45,
      origin: { y: 0.4 },
      colors: ['#ff4081', '#f50057', '#fff'],
    },
    spiritual: {
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#ff9800', '#ff5722', '#ffeb3b', '#fff'],
      shapes: ['circle', 'square'],
    },
  };

  const config = configs[type] || configs.success;
  confetti(config);
};

export const triggerSpiritualConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    colors: ['#ff9800', '#ff5722', '#ffeb3b', '#F97316'],
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};
