/**
 * Offline Service for React Native App
 * Handles offline data caching and sync
 */
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'offline_request_queue';
const CACHE_PREFIX = 'cache:';

class OfflineService {
  constructor() {
    this.isOnline = true;
    this.queue = [];
    this.listeners = [];
    
    this.init();
  }

  init() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline));
      
      // Process queue when coming back online
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }
    });
    
    // Load queue from storage
    this.loadQueue();
  }

  async loadQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (queueJson) {
        this.queue = JSON.parse(queueJson);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  }

  async saveQueue() {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  async queueRequest(requestFn, metadata = {}) {
    if (this.isOnline) {
      // If online, execute immediately
      return await requestFn();
    } else {
      // If offline, add to queue
      const request = {
        id: Date.now(),
        requestFn: requestFn.toString(),
        metadata,
        timestamp: new Date().toISOString(),
      };
      
      this.queue.push(request);
      await this.saveQueue();
      
      throw new Error('Request queued for offline processing');
    }
  }

  async processQueue() {
    console.log(`Processing ${this.queue.length} offline requests...`);
    
    const processed = [];
    const failed = [];
    
    for (const request of this.queue) {
      try {
        // Note: In production, you'd need a way to serialize/deserialize functions
        // For now, this is a simplified version
        console.log('Processing queued request:', request.metadata);
        processed.push(request.id);
      } catch (error) {
        console.error('Failed to process queued request:', error);
        failed.push(request.id);
      }
    }
    
    // Remove processed requests from queue
    this.queue = this.queue.filter(r => !processed.includes(r.id));
    await this.saveQueue();
    
    console.log(`Processed ${processed.length} requests, ${failed.length} failed`);
  }

  addNetworkListener(callback) {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  getNetworkStatus() {
    return this.isOnline;
  }

  // Cache management
  async cacheData(key, data, ttl = 3600000) { // Default 1 hour TTL
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await AsyncStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  async getCachedData(key) {
    try {
      const cacheJson = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!cacheJson) return null;
      
      const cacheItem = JSON.parse(cacheJson);
      
      // Check if cache is expired
      if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      
      return cacheItem.data;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async clearExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      for (const key of cacheKeys) {
        const cacheJson = await AsyncStorage.getItem(key);
        if (cacheJson) {
          const cacheItem = JSON.parse(cacheJson);
          if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }
}

export default new OfflineService();
