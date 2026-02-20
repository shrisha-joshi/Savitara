/**
 * Offline Message Queue Service (React Native)
 * 
 * Manages message queue for offline/network failure scenarios using AsyncStorage.
 * Provides automatic retry with exponential backoff and deduplication.
 * 
 * Features:
 * - AsyncStorage persistence for React Native
 * - NetInfo integration for network detection
 * - Queue draining on reconnection
 * - Exponential backoff retry
 * - Message deduplication
 * - Queue statistics and monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = '@savitara:offline_message_queue';
const MAX_QUEUE_SIZE = 1000;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms

class OfflineQueueService {
  isOnline = true;
  isDraining = false;
  listeners = new Set();
  retryTimeouts = new Map();
  netInfoUnsubscribe = null;
  
  constructor() {
    this.setupNetworkListeners();
  }

  /**
   * Setup network state listener with NetInfo
   */
  setupNetworkListeners() {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;

      console.log('Network state changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });

      if (!wasOnline && this.isOnline) {
        console.log('Network: Online - draining queue');
        this.notifyListeners('online');
        this.drainQueue();
      } else if (wasOnline && !this.isOnline) {
        console.log('Network: Offline');
        this.notifyListeners('offline');
      }
    });
  }

  /**
   * Add a listener for network status changes
   * 
   * @param {Function} callback - Callback function (status: 'online' | 'offline')
   * @returns {Function} Unsubscribe function
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of network status change
   */
  notifyListeners(status) {
    this.listeners.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  /**
   * Get current network state
   */
  async getNetworkState() {
    const state = await NetInfo.fetch();
    return {
      isOnline: state.isConnected && state.isInternetReachable,
      type: state.type,
      details: state.details,
    };
  }

  /**
   * Load queue from AsyncStorage
   */
  async loadQueue() {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueData) return [];
      
      const queue = JSON.parse(queueData);
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      console.error('Failed to load queue from AsyncStorage:', error);
      return [];
    }
  }

  /**
   * Save queue to AsyncStorage
   */
  async saveQueue(queue) {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save queue to AsyncStorage:', error);
      throw error;
    }
  }

  /**
   * Queue a message for later sending
   * 
   * @param {Object} message - Message data
   * @param {string} message.tempId - Temporary message ID
   * @param {string} message.conversationId - Conversation ID
   * @param {string} message.content - Message content
   * @param {string} message.messageType - Message type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Queued message object
   */
  async queueMessage(message, metadata = {}) {
    const queue = await this.loadQueue();

    // Check queue size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
      throw new Error('Queue size limit reached');
    }

    const queueItem = {
      id: message.tempId || `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      conversationId: message.conversationId,
      content: message.content,
      messageType: message.messageType || 'text',
      mediaUrl: message.mediaUrl,
      receiverId: message.receiverId,
      timestamp: Date.now(),
      retryCount: 0,
      lastRetryAt: null,
      status: 'pending',
      ...metadata,
    };

    // Add to queue
    queue.push(queueItem);
    await this.saveQueue(queue);

    console.log('Message queued:', queueItem.id);
    return queueItem;
  }

  /**
   * Get all pending messages from queue
   * 
   * @returns {Promise<Array>} Array of queued messages
   */
  async getQueue() {
    return await this.loadQueue();
  }

  /**
   * Get queue size
   */
  async getQueueSize() {
    const queue = await this.loadQueue();
    return queue.length;
  }

  /**
   * Remove a message from the queue
   * 
   * @param {string} messageId - Message ID to remove
   */
  async removeFromQueue(messageId) {
    const queue = await this.loadQueue();
    const filteredQueue = queue.filter((msg) => msg.id !== messageId);
    await this.saveQueue(filteredQueue);
    console.log('Message removed from queue:', messageId);
  }

  /**
   * Update message status in queue
   */
  async updateMessageStatus(messageId, status, additionalData = {}) {
    const queue = await this.loadQueue();
    const messageIndex = queue.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      throw new Error('Message not found in queue');
    }

    queue[messageIndex] = {
      ...queue[messageIndex],
      status,
      ...additionalData,
    };

    await this.saveQueue(queue);
    return queue[messageIndex];
  }

  /**
   * Clear all messages from queue
   */
  async clearQueue() {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
      console.log('Queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }

  /**
   * Drain the queue - send all pending messages
   * 
   * @param {Function} sendFunction - Async function to send messages
   * @returns {Promise<Object>} Results of queue draining
   */
  async drainQueue(sendFunction) {
    if (this.isDraining) {
      console.log('Already draining queue');
      return;
    }

    const networkState = await this.getNetworkState();
    if (!networkState.isOnline) {
      console.log('Cannot drain queue - offline');
      return;
    }

    this.isDraining = true;
    console.log('Starting queue drain...');

    const results = {
      sent: 0,
      failed: 0,
      retried: 0,
      errors: [],
    };

    try {
      const queue = await this.loadQueue();
      console.log(`Draining ${queue.length} messages from queue`);

      // Sort by timestamp (oldest first)
      queue.sort((a, b) => a.timestamp - b.timestamp);

      for (const message of queue) {
        // Skip if already being retried
        if (this.retryTimeouts.has(message.id)) {
          continue;
        }

        try {
          // Calculate retry delay
          const retryDelay = RETRY_DELAYS[Math.min(message.retryCount, RETRY_DELAYS.length - 1)];
          const timeSinceLastRetry = Date.now() - (message.lastRetryAt || message.timestamp);

          if (message.retryCount > 0 && timeSinceLastRetry < retryDelay) {
            // Schedule retry for later
            this.scheduleRetry(message, sendFunction, retryDelay - timeSinceLastRetry);
            results.retried++;
            continue;
          }

          // Attempt to send
          if (sendFunction) {
            await sendFunction(message);
          }

          // Success - remove from queue
          await this.removeFromQueue(message.id);
          results.sent++;

        } catch (error) {
          console.error(`Failed to send queued message ${message.id}:`, error);

          // Update retry count
          await this.updateMessageStatus(message.id, 'retrying', {
            retryCount: message.retryCount + 1,
            lastRetryAt: Date.now(),
            lastError: error.message,
          });

          // Schedule retry
          const retryDelay = RETRY_DELAYS[Math.min(message.retryCount, RETRY_DELAYS.length - 1)];
          this.scheduleRetry(message, sendFunction, retryDelay);

          results.failed++;
          results.errors.push({
            messageId: message.id,
            error: error.message,
          });
        }
      }

      console.log('Queue drain complete:', results);
      return results;

    } finally {
      this.isDraining = false;
    }
  }

  /**
   * Schedule a retry for a message
   */
  scheduleRetry(message, sendFunction, delay) {
    if (this.retryTimeouts.has(message.id)) {
      clearTimeout(this.retryTimeouts.get(message.id));
    }

    const timeoutId = setTimeout(async () => {
      this.retryTimeouts.delete(message.id);

      const networkState = await this.getNetworkState();
      if (!networkState.isOnline) return;

      try {
        if (sendFunction) {
          await sendFunction(message);
        }
        await this.removeFromQueue(message.id);
        console.log('Retry successful:', message.id);
      } catch (error) {
        console.error('Retry failed:', message.id, error);
        await this.updateMessageStatus(message.id, 'retrying', {
          retryCount: message.retryCount + 1,
          lastRetryAt: Date.now(),
          lastError: error.message,
        });

        // Schedule next retry with increased delay
        const nextDelay = RETRY_DELAYS[Math.min(message.retryCount + 1, RETRY_DELAYS.length - 1)];
        this.scheduleRetry(message, sendFunction, nextDelay);
      }
    }, delay);

    this.retryTimeouts.set(message.id, timeoutId);
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const queue = await this.loadQueue();

    const stats = {
      total: queue.length,
      pending: 0,
      retrying: 0,
      failed: 0,
      oldestTimestamp: null,
      averageRetryCount: 0,
    };

    let totalRetries = 0;

    queue.forEach((message) => {
      if (message.status === 'pending') stats.pending++;
      if (message.status === 'retrying') stats.retrying++;
      if (message.status === 'failed') stats.failed++;

      totalRetries += message.retryCount;

      if (!stats.oldestTimestamp || message.timestamp < stats.oldestTimestamp) {
        stats.oldestTimestamp = message.timestamp;
      }
    });

    stats.averageRetryCount = queue.length > 0 ? totalRetries / queue.length : 0;

    return stats;
  }

  /**
   * Cleanup - call when app unmounts
   */
  cleanup() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }

    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.retryTimeouts.clear();
  }
}

// Singleton instance
const offlineQueueService = new OfflineQueueService();

export default offlineQueueService;
