/**
 * Standardized booking status colors used across the entire app.
 * Keep in sync with admin-savitara-web and savitara-web color schemes.
 */
export const BOOKING_STATUS_COLORS = {
  requested: '#FFA726',       // orange
  confirmed: '#42A5F5',       // blue
  pending_payment: '#FFCA28', // yellow
  paid: '#66BB6A',            // green (payment complete)
  in_progress: '#29B6F6',     // light blue
  completed: '#4CAF50',       // dark green
  cancelled: '#EF5350',       // red
  rejected: '#E53935',        // dark red
  referred: '#AB47BC',        // purple
};

/**
 * Returns the color for a given booking status, with a neutral fallback.
 * @param {string} status
 * @returns {string} hex color
 */
export const getStatusColor = (status) =>
  BOOKING_STATUS_COLORS[status] ?? '#9E9E9E';
