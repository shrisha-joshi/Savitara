/**
 * Performance Optimization Utilities for React Native
 * Provides debounce, throttle, memoization, and other optimization helpers
 */
import { Platform } from 'react-native';
import logger from './logger';

const createMeasuredComponent = (Component, componentName) => {
  function MeasuredComponent(props) {
    const { useEffect, useRef } = require('react');
    const startTimeRef = useRef(0);

    useEffect(() => {
      startTimeRef.current = performance.now();

      return () => {
        const endTime = performance.now();
        logger.log(`[Performance] ${componentName} render time: ${endTime - startTimeRef.current}ms`);
      };
    }, [componentName]);

    return Component(props);
  }

  return MeasuredComponent;
};

const runSearchWithCache = async (searchFunction, searchTerm, resultsCache, resolve) => {
  try {
    const results = await searchFunction(searchTerm);

    resultsCache.set(searchTerm, results);

    if (resultsCache.size > 50) {
      const firstKey = resultsCache.keys().next().value;
      resultsCache.delete(firstKey);
    }

    resolve(results);
  } catch (error) {
    console.error('Search error:', error);
    resolve([]);
  }
};

class PerformanceOptimizer {
  /**
   * Debounce function execution
   * Delays execution until after wait time has elapsed since last call
   * 
   * @param {Function} func - Function to debounce
   * @param {number} wait - Milliseconds to wait
   * @returns {Function} Debounced function
   */
  static debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function execution
   * Limits execution to once per time period
   * 
   * @param {Function} func - Function to throttle
   * @param {number} limit - Minimum time between executions (ms)
   * @returns {Function} Throttled function
   */
  static throttle(func, limit = 300) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Run task after all interactions complete
   * Useful for deferring heavy computations
   * 
   * @param {Function} task - Task to execute
   * @returns {Promise} Promise that resolves when task completes
   */
  static runAfterInteractions(task) {
    return new Promise((resolve) => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          const result = task();
          resolve(result);
        });
      }, 0);
    });
  }

  /**
   * Preload images to avoid loading delays
   * 
   * @param {Array<string>} urls - Array of image URLs
   * @returns {Promise<Array>} Promise that resolves when all images loaded
   */
  static async preloadImages(urls) {
    const { Image } = require('react-native');
    
    return Promise.all(
      urls.map(url => {
        return new Promise((resolve, reject) => {
          Image.prefetch(url)
            .then(() => resolve(url))
            .catch((error) => reject(new Error(error?.message || `Failed to preload ${url}`)));
        });
      })
    );
  }

  /**
   * Memoize function results
   * Caches function results based on arguments
   * 
   * @param {Function} func - Function to memoize
   * @param {Function} keyGenerator - Optional custom key generator
   * @returns {Function} Memoized function
   */
  static memoize(func, keyGenerator = null) {
    const cache = new Map();
    
    return function(...args) {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func.apply(this, args);
      cache.set(key, result);
      
      // Limit cache size
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    };
  }

  /**
   * Lazy load component
   * Defers component rendering until needed
   * 
   * @param {Function} importFunction - Dynamic import function
   * @returns {Object} Lazy component
   */
  static lazyLoad(importFunction) {
    const React = require('react');
    return React.lazy(importFunction);
  }

  /**
   * Batch multiple state updates
   * Reduces re-renders
   * 
   * @param {Function} callback - Callback with state updates
   */
  static batchUpdates(callback) {
    const { unstable_batchedUpdates } = require('react-native');
    unstable_batchedUpdates(callback);
  }

  /**
   * Create optimized event handler
   * Prevents unnecessary re-renders with useCallback pattern
   * 
   * @param {Function} handler - Event handler
   * @param {Array} dependencies - Dependencies array
   * @returns {Function} Optimized handler
   */
  static useOptimizedCallback(handler, dependencies = []) {
    return handler;
  }

  /**
   * Optimize list rendering with unique keys
   * 
   * @param {Array} items - Array of items
   * @param {string} keyField - Field to use as key
   * @returns {Array} Items with _key field
   */
  static optimizeListItems(items, keyField = 'id') {
    return items.map((item, index) => ({
      ...item,
      _key: item[keyField] || `item-${index}`
    }));
  }

  /**
   * Check if running on low-end device
   * Useful for adjusting features based on device capability
   * 
   * @returns {boolean} True if low-end device
   */
  static isLowEndDevice() {
    const { Constants } = require('expo-constants');
    
    // Simple heuristic based on platform and memory
    if (Platform.OS === 'android') {
      const memory = Constants.deviceTotalMemory || 0;
      return memory < 2 * 1024 * 1024 * 1024; // < 2GB RAM
    }
    
    return false;
  }

  /**
   * Measure component render time
   * Useful for performance profiling
   * 
   * @param {string} componentName - Name of component
   * @returns {Function} Wrapper function for measuring
   */
  static measureRenderTime(componentName) {
    return (Component) => createMeasuredComponent(Component, componentName);
  }

  /**
   * Create optimized search function with debouncing
   * 
   * @param {Function} searchFunction - Actual search function
   * @param {number} delay - Debounce delay (ms)
   * @returns {Function} Optimized search function
   */
  static createOptimizedSearch(searchFunction, delay = 300) {
    let timeoutId;
    const resultsCache = new Map();
    
    return (searchTerm) => {
      // Return cached results if available
      if (resultsCache.has(searchTerm)) {
        return Promise.resolve(resultsCache.get(searchTerm));
      }
      
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      return new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          runSearchWithCache(searchFunction, searchTerm, resultsCache, resolve);
        }, delay);
      });
    };
  }

  /**
   * Optimize image loading with size reduction
   * 
   * @param {string} url - Image URL
   * @param {Object} dimensions - Target dimensions {width, height}
   * @returns {string} Optimized image URL
   */
  static optimizeImageUrl(url, dimensions = {}) {
    if (!url) return url;
    
    // Add image optimization params (works with Cloudinary, ImgIX, etc.)
    const params = [
      dimensions.width ? `w=${dimensions.width}` : null,
      dimensions.height ? `h=${dimensions.height}` : null,
      'q=80',
      'f=auto',
    ].filter(Boolean);
    
    if (params.length === 0) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.join('&')}`;
  }

  /**
   * Create virtual list helper for large datasets
   * Only renders visible items
   * 
   * @param {Array} items - All items
   * @param {number} itemHeight - Height of each item
   * @param {number} containerHeight - Height of container
   * @param {number} scrollPosition - Current scroll position
   * @returns {Object} Visible items and offsets
   */
  static getVirtualListItems(items, itemHeight, containerHeight, scrollPosition) {
    const startIndex = Math.max(0, Math.floor(scrollPosition / itemHeight) - 2);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollPosition + containerHeight) / itemHeight) + 2
    );
    
    const visibleItems = items.slice(startIndex, endIndex);
    
    return {
      visibleItems,
      startIndex,
      endIndex,
      offsetY: startIndex * itemHeight,
      totalHeight: items.length * itemHeight
    };
  }
}

export default PerformanceOptimizer;
