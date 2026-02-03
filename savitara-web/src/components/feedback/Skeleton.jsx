import React from 'react';
import { colors, borderRadius } from '../../theme/tokens';

const Skeleton = ({ width, height, variant = 'rect', className = '' }) => {
  
  const styles = {
    width: width || '100%',
    height: height || '20px',
    backgroundColor: '#E5E7EB', // matching tailwind gray-200
    borderRadius: variant === 'circle' ? '9999px' : '4px',
  };

  return (
    <div 
      className={`skeleton-pulse ${className}`} 
      style={styles}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .skeleton-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
    </div>
  );
};

export default Skeleton;
