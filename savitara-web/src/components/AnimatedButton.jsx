import { motion } from 'framer-motion';
import { Button } from '@mui/material';

/**
 * AnimatedButton Component
 * Button with delightful microinteractions
 * 
 * Usage:
 * <AnimatedButton variant="contained" animation="bounce" onClick={handleClick}>
 *   Click Me
 * </AnimatedButton>
 */

const ANIMATION_VARIANTS = {
  // Gentle bounce on hover
  bounce: {
    hover: { scale: 1.05, transition: { type: 'spring', stiffness: 400, damping: 10 } },
    tap: { scale: 0.95 },
  },
  
  // Slide up slightly
  lift: {
    hover: { y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } },
    tap: { y: 0 },
  },
  
  // Pulse effect
  pulse: {
    hover: { 
      scale: [1, 1.08, 1.05],
      transition: { 
        duration: 0.6,
        repeat: Infinity,
        repeatType: 'reverse',
      }
    },
    tap: { scale: 0.95 },
  },
  
  // Glow effect (shadow expansion)
  glow: {
    hover: { 
      boxShadow: '0px 0px 20px rgba(255, 107, 53, 0.6)',
      transition: { duration: 0.3 }
    },
    tap: { scale: 0.98 },
  },
  
  // Rotate slightly
  tilt: {
    hover: { rotate: 2, scale: 1.05, transition: { duration: 0.2 } },
    tap: { rotate: 0, scale: 0.95 },
  },
  
  // Shake (for errors or attention)
  shake: {
    hover: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.5 }
    },
    tap: { scale: 0.95 },
  },
};

export default function AnimatedButton({ 
  children, 
  animation = 'bounce',
  disabled = false,
  sx = {},
  ...buttonProps 
}) {
  const variant = ANIMATION_VARIANTS[animation] || ANIMATION_VARIANTS.bounce;

  return (
    <motion.div
      whileHover={!disabled ? variant.hover : undefined}
      whileTap={!disabled ? variant.tap : undefined}
      style={{ display: 'inline-block', width: buttonProps.fullWidth ? '100%' : 'auto' }}
    >
      <Button
        {...buttonProps}
        disabled={disabled}
        sx={{
          ...sx,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        {children}
      </Button>
    </motion.div>
  );
}

/**
 * Quick presets for common use cases
 */
export const PrimaryActionButton = ({ children, ...props }) => (
  <AnimatedButton animation="lift" variant="contained" color="primary" {...props}>
    {children}
  </AnimatedButton>
);

export const DangerButton = ({ children, ...props }) => (
  <AnimatedButton animation="shake" variant="outlined" color="error" {...props}>
    {children}
  </AnimatedButton>
);

export const SuccessButton = ({ children, ...props }) => (
  <AnimatedButton animation="bounce" variant="contained" color="success" {...props}>
    {children}
  </AnimatedButton>
);
