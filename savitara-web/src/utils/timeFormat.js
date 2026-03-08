import { format, formatDistanceToNow, isThisWeek, isThisYear, isToday, isYesterday } from 'date-fns';

const _DEFAULT_TIME_OPTS = { hour: '2-digit', minute: '2-digit' };

/**
 * Format a UTC ISO timestamp as a time string in the given IANA timezone.
 * Falls back to the device timezone when none is supplied.
 */
export function formatLocalTime(isoString, userTimezone, opts = _DEFAULT_TIME_OPTS) {
  if (!isoString) return '';
  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: tz }).format(new Date(isoString));
}

/**
 * Format message timestamp with smart relative/absolute formatting
 * @param {string|Date} timestamp - The message timestamp
 * @param {boolean} short - Whether to use short format
 * @returns {string} Formatted time string
 */
export const formatMessageTime = (timestamp, short = false) => {
  if (!timestamp) return '';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (short) {
    // For inline message timestamps
    return format(date, 'HH:mm');
  }
  
  // Smart formatting based on recency
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  if (isThisWeek(date)) {
    return format(date, 'EEEE'); // Day name (e.g., "Monday")
  }
  
  if (isThisYear(date)) {
    return format(date, 'MMM d'); // e.g., "Jan 15"
  }
  
  return format(date, 'MMM d, yyyy'); // e.g., "Jan 15, 2023"
};

/**
 * Get a concise relative time for conversation list
 * @param {string|Date} timestamp 
 * @returns {string}
 */
export const getConversationTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m`;
  if (diffInHours < 24) return `${diffInHours}h`;
  if (diffInDays < 7) return `${diffInDays}d`;
  if (diffInDays < 365) return format(date, 'MMM d');
  
  return format(date, 'MMM yyyy');
};
