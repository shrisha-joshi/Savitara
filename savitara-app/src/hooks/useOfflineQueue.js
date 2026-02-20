/**
 * useOfflineQueue Hook (React Native)
 * 
 * React hook for managing offline message queue with automatic network detection
 * and queue draining.
 * 
 * Features:
 * - NetInfo integration for offline detection
 * - Queue management with AsyncStorage
 * - Network status indicator
 * - Queue statistics
 * - Integration with optimistic UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import offlineQueueService from '../services/offline-queue.service';
import api from '../services/api';

export function useOfflineQueue(conversationId) {
  const [isOnline, setIsOnline] = useState(true);
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

    // Get initial network state
    offlineQueueService.getNetworkState().then((state) => {
      setIsOnline(state.isOnline);
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

export default useOfflineQueue;
