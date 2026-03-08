/**
 * Timezone-aware date/time formatting utilities.
 *
 * Uses the built-in Intl.DateTimeFormat API so no extra packages are required.
 * Falls back to 'Asia/Kolkata' (IST) when no timezone is specified — appropriate
 * for the majority of Savitara users.
 */

const DEFAULT_TZ = 'Asia/Kolkata';

/**
 * Format an ISO date-time string in the given IANA timezone.
 *
 * @param {string|Date} isoString - UTC ISO-8601 string (e.g. "2024-01-15T10:30:00Z")
 * @param {string} [timezone]     - IANA tz name (e.g. "Asia/Kolkata"). Falls back to IST.
 * @param {object} [options]      - Intl.DateTimeFormat options. Defaults to time display.
 * @returns {string}
 */
export function formatLocalTime(isoString, timezone, options) {
  if (!isoString) return '';
  const tz = timezone || DEFAULT_TZ;
  const fmt = options || {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...fmt }).format(
      new Date(isoString)
    );
  } catch {
    // Intl may throw for unsupported timezones on some devices
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TZ,
      ...fmt,
    }).format(new Date(isoString));
  }
}

/**
 * Format an ISO date-time string as a localised date.
 *
 * @param {string|Date} isoString
 * @param {string} [timezone]
 * @returns {string}  e.g. "Mon, 15 Jan 2024"
 */
export function formatLocalDate(isoString, timezone) {
  return formatLocalTime(isoString, timezone, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Return a relative time label ("just now", "5m ago", "Yesterday", etc.).
 * Uses the given timezone for date boundary comparisons (midnight).
 *
 * @param {string|Date} isoString
 * @param {string}      [timezone]
 * @returns {string}
 */
export function getRelativeTime(isoString, timezone) {
  if (!isoString) return '';
  const tz = timezone || DEFAULT_TZ;
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';

  if (diffDays < 7) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      weekday: 'short',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
  }).format(date);
}
