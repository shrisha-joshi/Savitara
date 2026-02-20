/**
 * useOfflineQueue Hook (Web)
 * 
 * React hook for managing offline message queue with automatic network detection
 * and queue draining.
 * 
 * Features:
 * - Automatic offline detection
 * - Queue management
 * - Network status indicator
 * - Queue statistics
 * - Integration with optimistic UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import offlineQueueService from '../services/offline-queue.service';
import api from '../services/api';

export function useOfflineQueue(conversationId) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    pending: 0,
    retrying: 0,
    failed: 0,
  });
  const [isDraining, setIsDraining] = useState(false);
  const sendFunctionRef = useRef(null);

  /**
   * Update queue statistics
   */
  const updateStats = useCallback(async () => {
    try {
      const stats = await offlineQueueService.getStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to update queue stats:', error);
    }
  }, []);

  /**
   * Send function for draining queue
   */
  const sendQueuedMessage = useCallback(async (queuedMessage) => {
    // Extract the message data
    const payload = {
      conversationId: queuedMessage.conversationId,
      content: queuedMessage.content,
      messageType: queuedMessage.messageType,
      receiverId: queuedMessage.receiverId,
      mediaUrl: queuedMessage.mediaUrl,
    };

    // Send via API
    const response = await api.post('/messages', payload);
    return response.data;
  }, []);

  /**
   * Queue a message when offline
   */
  const queueMessage = useCallback(async (message, metadata = {}) => {
    try {
      const queued = await offlineQueueService.queueMessage(message, metadata);
      await updateStats();
      return queued;
    } catch (error) {
      console.error('Failed to queue message:', error);
      throw error;
    }
  }, [updateStats]);

  /**
   * Manually trigger queue drain
   */
  const drainQueue = useCallback(async () => {
    if (!isOnline || isDraining) return;

    setIsDraining(true);
    try {
      const results = await offlineQueueService.drainQueue(sendQueuedMessage);
      await updateStats();
      return results;
    } catch (error) {
      console.error('Failed to drain queue:', error);
      throw error;
    } finally {
      setIsDraining(false);
    }
  }, [isOnline, isDraining, sendQueuedMessage, updateStats]);

  /**
   * Clear the entire queue
   */
  const clearQueue = useCallback(async () => {
    try {
      await offlineQueueService.clearQueue();
      await updateStats();
    } catch (error) {
      console.error('Failed to clear queue:', error);
      throw error;
    }
  }, [updateStats]);

  /**
   * Remove specific message from queue
   */
  const removeMessage = useCallback(async (messageId) => {
    try {
      await offlineQueueService.removeFromQueue(messageId);
      await updateStats();
    } catch (error) {
      console.error('Failed to remove message from queue:', error);
      throw error;
    }
  }, [updateStats]);

  /**
   * Get all queued messages
   */
  const getQueuedMessages = useCallback(async () => {
    try {
      const queue = await offlineQueueService.getQueue();
      
      // Filter by conversation if conversationId provided
      if (conversationId) {
        return queue.filter((msg) => msg.conversationId === conversationId);
      }
      
      return queue;
    } catch (error) {
      console.error('Failed to get queued messages:', error);
      return [];
    }
  }, [conversationId]);

  // Setup network listeners
  useEffect(() => {
    const unsubscribe = offlineQueueService.addListener((status) => {
      setIsOnline(status === 'online');
      
      // Auto-drain queue when coming back online
      if (status === 'online') {
        drainQueue();
      }
    });

    // Initial stats load
    updateStats();

    return () => {
      unsubscribe();
    };
  }, [drainQueue, updateStats]);

  // Store send function ref
  useEffect(() => {
    sendFunctionRef.current = sendQueuedMessage;
  }, [sendQueuedMessage]);

  return {
    // Network state
    isOnline,
    
    // Queue state
    queueStats,
    isDraining,
    
    // Queue operations
    queueMessage,
    drainQueue,
    clearQueue,
    removeMessage,
    getQueuedMessages,
    updateStats,
  };
}

/**
 * Network Status Banner Component
 * Display network status and queue information
 */
export function NetworkStatusBanner({ queueStats, isOnline, isDraining, onRetry }) {
  if (isOnline && queueStats.total === 0) {
    return null;
  }

  return (
    <section
      className={`px-4 py-2 text-sm font-medium text-center ${
        isOnline
          ? 'bg-green-50 text-green-800 border-b border-green-200'
          : 'bg-yellow-50 text-yellow-800 border-b border-yellow-200'
      }`}
      aria-live="polite"
      aria-label="Network status"
    >
      {!isOnline && (
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span>You are offline. Messages will be sent when connection is restored.</span>
        </div>
      )}
      
      {isOnline && queueStats.total > 0 && (
        <div className="flex items-center justify-center gap-2">
          {isDraining ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Sending {queueStats.total} pending message{queueStats.total > 1 ? 's' : ''}...</span>
            </>
          ) : (
            <>
              <span>
                {queueStats.total} message{queueStats.total > 1 ? 's' : ''} waiting to send
              </span>
              <button
                onClick={onRetry}
                className="ml-2 text-green-700 underline hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                aria-label="Retry sending messages"
              >
                Retry now
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

NetworkStatusBanner.propTypes = {
  queueStats: PropTypes.shape({
    total: PropTypes.number,
    pending: PropTypes.number,
    retrying: PropTypes.number,
    failed: PropTypes.number,
  }).isRequired,
  isOnline: PropTypes.bool.isRequired,
  isDraining: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
};

export default useOfflineQueue;
