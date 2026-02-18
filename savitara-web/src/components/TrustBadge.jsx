import { Chip, Tooltip, Box, Typography } from '@mui/material';
import { FaCheckCircle, FaShieldAlt, FaLock, FaStar, FaAward } from 'react-icons/fa';

/**
 * TrustBadge Component
 * Displays trust signals to users (verification, security, ratings, etc.)
 * 
 * Usage:
 * <TrustBadge type="verified" size="small" />
 * <TrustBadge type="kyc-verified" size="medium" showTooltip />
 */

const BADGE_TYPES = {
  verified: {
    label: 'Verified',
    icon: FaCheckCircle,
    color: '#34C759',
    bgColor: '#E8F8ED',
    tooltip: 'This Acharya has been verified by Savitara. Identity, qualifications, and background checked.',
  },
  'kyc-verified': {
    label: 'KYC Verified',
    icon: FaShieldAlt,
    color: '#007AFF',
    bgColor: '#E5F1FF',
    tooltip: 'KYC (Know Your Customer) verification completed. Government ID verified.',
  },
  'top-rated': {
    label: 'Top Rated',
    icon: FaStar,
    color: '#FFD700',
    bgColor: '#FFF8E1',
    tooltip: 'Consistently high ratings from users. Maintained 4.5+ stars with 50+ reviews.',
  },
  'elite-acharya': {
    label: 'Elite Acharya',
    icon: FaAward,
    color: '#9B59B6',
    bgColor: '#F4ECFC',
    tooltip: 'Top 10% of Acharyas. Over 100 completed consultations with 4.8+ rating.',
  },
  secure: {
    label: 'Secure and Encrypted',
    icon: FaLock,
    color: '#22C55E',
    bgColor: '#E8F8ED',
    tooltip: 'Your conversations and payment details are end-to-end encrypted.',
  },
  'privacy-protected': {
    label: 'Privacy Protected',
    icon: FaShieldAlt,
    color: '#6366F1',
    bgColor: '#EEF2FF',
    tooltip: 'Your personal information is never shared without your consent. GDPR compliant.',
  },
};

export default function TrustBadge({ 
  type = 'verified', 
  size = 'small',
  showTooltip = true,
  variant = 'chip', // 'chip' or 'inline' or 'banner'
}) {
  const badge = BADGE_TYPES[type];
  
  if (!badge) {
    console.warn(`TrustBadge: Unknown type "${type}". Valid types: ${Object.keys(BADGE_TYPES).join(', ')}`);
    return null;
  }

  const Icon = badge.icon;
  
  // Size mappings
  const sizes = {
    small: { fontSize: 12, iconSize: 14, px: 1, py: 0.5 },
    medium: { fontSize: 14, iconSize: 16, px: 1.5, py: 0.75 },
    large: { fontSize: 16, iconSize: 18, px: 2, py: 1 },
  };
  const sizeConfig = sizes[size] || sizes.small;

  // Chip variant (default)
  if (variant === 'chip') {
    const chipContent = (
      <Chip
        icon={<Icon style={{ color: badge.color }} />}
        label={badge.label}
        size={size}
        sx={{
          backgroundColor: badge.bgColor,
          color: badge.color,
          fontWeight: 600,
          fontSize: sizeConfig.fontSize,
          border: `1px solid ${badge.color}`,
          '& .MuiChip-icon': {
            color: badge.color,
            fontSize: sizeConfig.iconSize,
          },
        }}
      />
    );

    return showTooltip ? (
      <Tooltip title={badge.tooltip} arrow placement="top">
        {chipContent}
      </Tooltip>
    ) : chipContent;
  }

  // Inline variant (icon + text)
  if (variant === 'inline') {
    const inlineContent = (
      <Box display="flex" alignItems="center" gap={0.5}>
        <Icon size={sizeConfig.iconSize} color={badge.color} />
        <Typography fontSize={sizeConfig.fontSize} fontWeight={600} color={badge.color}>
          {badge.label}
        </Typography>
      </Box>
    );

    return showTooltip ? (
      <Tooltip title={badge.tooltip} arrow placement="top">
        <Box display="inline-flex">{inlineContent}</Box>
      </Tooltip>
    ) : inlineContent;
  }

  // Banner variant (full-width info box)
  if (variant === 'banner') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: badge.bgColor,
          border: `1px solid ${badge.color}`,
        }}
      >
        <Icon size={24} color={badge.color} />
        <Box>
          <Typography fontSize={14} fontWeight={600} color={badge.color}>
            {badge.label}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            {badge.tooltip}
          </Typography>
        </Box>
      </Box>
    );
  }

  return null;
}

/**
 * TrustBadgeGroup - Display multiple trust badges in a row
 */
export function TrustBadgeGroup({ badges = [], size = 'small', showTooltip = true, variant = 'chip', spacing = 1 }) {
  return (
    <Box display="flex" flexWrap="wrap" gap={spacing}>
      {badges.map((type, index) => (
        <TrustBadge 
          key={`${type}-${index}`}
          type={type} 
          size={size} 
          showTooltip={showTooltip}
          variant={variant}
        />
      ))}
    </Box>
  );
}
