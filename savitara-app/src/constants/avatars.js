/**
 * Avatar utilities: consistent colors and initials for user avatars.
 * Color is deterministic from user ID so the same user always gets the same color.
 */

// 12-color palette with good contrast on white text
const AVATAR_PALETTE = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#4CAF50', '#FF9800', '#795548', '#607D8B',
];

/**
 * Returns a consistent background color derived from the user's ID.
 * The same ID always produces the same color.
 * @param {string} userId
 * @returns {string} hex color
 */
export const getAvatarColor = (userId = '') => {
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // djb2-style hash — fast and well-distributed for short strings
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

/**
 * Returns 1–2 character initials from a display name.
 * "Rajan Sharma" → "RS", "Ananya" → "AN", "" → "?"
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
};
