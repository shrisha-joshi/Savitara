import React from 'react';
import PropTypes from 'prop-types';
import { colors, typography, spacing } from '../../theme/tokens';
// Fallback icon removed as unused

const EmptyState = ({ message = "No records found.", description = "The Gods are waiting for your action." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background,
      textAlign: 'center',
      minHeight: '200px'
    }}>
      <div style={{
        width: '100px',
        height: '100px',
        backgroundColor: colors.surface,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.l,
        fontSize: '40px'
      }}>
         {/* Placeholder illustration */}
         <span>🌤️</span>
      </div>
      <h3 style={{
        margin: `0 0 ${spacing.s} 0`,
        color: colors.textPrimary,
        fontSize: typography.size.l
      }}>{message}</h3>
      <p style={{
        margin: 0,
        color: colors.textSecondary,
        fontSize: typography.size.m
      }}>{description}</p>
    </div>
  );
};

export default EmptyState;


EmptyState.propTypes = {
  message: PropTypes.string,
  description: PropTypes.string
};

