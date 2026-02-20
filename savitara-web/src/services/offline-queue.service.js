/**
 * Offline Message Queue Service (Web)
 * 
 * Manages message queue for offline/network failure scenarios using IndexedDB.
 * Provides automatic retry with exponential backoff and deduplication.
 * 
 * Features:
 * - IndexedDB persistence for reliable storage
 * - Automatic network detection
 * - Queue draining on reconnection
 * - Exponential backoff retry
 * - Message deduplication
 * - Queue statistics and monitoring
 */

const DB_NAME = 'savitara_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_messages';
const MAX_QUEUE_SIZE = 1000;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms

class OfflineQueueService {
  db = null;
  isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  isDraining = false;
  listeners = new Set();
  retryTimeouts = new Map();
  
  constructor() {
    this._init();
    this.setupNetworkListeners();
  }

  _init() {
    this.initDB().catch(err => {
      console.error('[OfflineQueue] Failed to init DB:', err);
    });
  }

  /**
   * Initialize IndexedDB
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for pending messages
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: false,
          });

          // Indexes for efficient queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('retryCount', 'retryCount', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Setup network online/offline listeners
   */
  setupNetworkListeners() {
    globalThis.addEventListener('online', () => {
      console.log('Network: Online');
      this.isOnline = true;
      this.notifyListeners('online');
      this.drainQueue();
    });

    globalThis.addEventListener('offline', () => {
      console.log('Network: Offline');
      this.isOnline = false;
      this.notifyListeners('offline');
    });

    // Also check via periodic ping to backend
    this.startConnectivityCheck();
  }

  /**
   * Periodic connectivity check (more reliable than navigator.onLine)
   */
  startConnectivityCheck() {
    setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('/api/v1/health', {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!this.isOnline) {
          this.isOnline = true;
          this.notifyListeners('online');
          this.drainQueue();
        }
      } catch {
        if (this.isOnline) {
          this.isOnline = false;
          this.notifyListeners('offline');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add a listener for network status changes
   * 
   * @param {Function} callback - Callback function (status: 'online' | 'offline')
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
   * Queue a message for later sending
   * 
   * @param {Object} message - Message data
   * @param {string} message.tempId - Temporary message ID
   * @param {string} message.conversationId - Conversation ID
   * @param {string} message.content - Message content
   * @param {string} message.messageType - Message type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async queueMessage(message, metadata = {}) {
    if (!this.db) await this.initDB();

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

    // Check queue size limit
    const currentSize = await this.getQueueSize();
    if (currentSize >= MAX_QUEUE_SIZE) {
      throw new Error('Queue size limit reached');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(queueItem);

      request.onsuccess = () => {
        console.log('Message queued:', queueItem.id);
        resolve(queueItem);
      };

      request.onerror = () => {
        console.error('Failed to queue message:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending messages from queue
   * 
   * @returns {Promise<Array>} Array of queued messages
   */
  async getQueue() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Failed to get queue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get queue size
   */
  async getQueueSize() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a message from the queue
   * 
   * @param {string} messageId - Message ID to remove
   */
  async removeFromQueue(messageId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(messageId);

      request.onsuccess = () => {
        console.log('Message removed from queue:', messageId);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to remove from queue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update message status in queue
   */
  async updateMessageStatus(messageId, status, additionalData = {}) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(messageId);

      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (!message) {
          reject(new Error('Message not found in queue'));
          return;
        }

        const updatedMessage = {
          ...message,
          status,
          ...additionalData,
        };

        const putRequest = store.put(updatedMessage);

        putRequest.onsuccess = () => resolve(updatedMessage);
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Clear all messages from queue
   */
  async clearQueue() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('Queue cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear queue:', request.error);
        reject(request.error);
      };
    });
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

    if (!this.isOnline) {
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
      const queue = await this.getQueue();
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

      if (!this.isOnline) return;

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
    const queue = await this.getQueue();

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
}

// Singleton instance
const offlineQueueService = new OfflineQueueService();

export default offlineQueueService;
