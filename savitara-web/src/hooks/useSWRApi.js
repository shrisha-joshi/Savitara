import useSWR from 'swr';
import api from '../services/api';

/**
 * Custom SWR hook for API requests with authentication
 * @param {string|null} url - API endpoint to fetch from (null disables the request)
 * @param {object} options - SWR configuration options
 * @returns {object} - SWR response { data, error, isLoading, mutate }
 * 
 * Usage:
 * const { data, error, isLoading } = useSWRApi('/bookings/my');
 * 
 * Benefits:
 * - Automatic caching (shows cached data instantly)
 * - Revalidation on focus
 * - Automatic retries
 * - Deduplication of requests
 */
const useSWRApi = (url, options = {}) => {
  // Fetcher function that uses our authenticated API client
  const fetcher = async (endpoint) => {
    const response = await api.get(endpoint);
    return response.data;
  };

  // Default SWR options optimized for Savitara
  const defaultOptions = {
    revalidateOnFocus: true,       // Refresh when user returns to tab
    revalidateOnReconnect: true,   // Refresh when internet reconnects
    dedupingInterval: 2000,        // Dedupe requests within 2 seconds
    errorRetryCount: 3,            // Retry failed requests 3 times
    errorRetryInterval: 5000,      // Wait 5s between retries
    ...options,
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    url, 
    fetcher, 
    defaultOptions
  );

  return {
    data,
    error,
    isLoading,
    isValidating, // True when revalidating in background
    mutate,       // Manually trigger refetch or update cache
  };
};

export default useSWRApi;
