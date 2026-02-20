import { useState, useCallback, useRef } from 'react';

/**
 * Generate a unique temporary ID
 * @returns {string} Temporary ID
 */
const generateTempId = () => {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * useOptimisticMessages Hook
 * 
 * Provides optimistic UI updates for chat messages with automatic retry
 * and failure handling.
 * 
 * Features:
 * - Immediate local state updates
 * - Server confirmation reconciliation  
 * - Automatic retry with exponential backoff
 * - Failed message queue
 * - Pending/sent/failed status indicators
 * 
 * @param {Object} params
 * @param {Function} params.sendMessageFn - Async function to send message to server
 * @param {Function} params.onMessageConfirmed - Callback when server confirms message
 * @param {number} params.maxRetries - Maximum retry attempts (default: 3)
 */
const useOptimisticMessages = ({
  sendMessageFn,
  onMessageConfirmed,
  maxRetries = 3,
}) => {
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [failedMessages, setFailedMessages] = useState([]);
  const retryTimeoutsRef = useRef({});

  /**
   * Send a message with optimistic UI update
   * 
   * @param {Object} messageData - Message data (content, type, etc.)
   * @param {Object} metadata - Additional metadata (conversationId, etc.)
   * @returns {Promise<Object>} Optimistic message object
   */
  const sendMessage = useCallback(async (messageData, metadata = {}) => {
    // Create optimistic message with temp ID
    const tempId = generateTempId();
    const timestamp = new Date().toISOString();
    
    const optimisticMessage = {
      id: tempId,
      tempId,
      ...messageData,
      ...metadata,
      status: 'sending',
      createdAt: timestamp,
      retryCount: 0,
    };

    // Add to optimistic messages immediately
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);

    try {
      // Send to server
      const serverResponse = await sendMessageFn({
        ...messageData,
        ...metadata,
        tempId,
      });

      // Server confirmed - replace optimistic message
      setOptimisticMessages((prev) =>
        prev.filter((msg) => msg.tempId !== tempId)
      );

      // Notify parent of confirmation
      if (onMessageConfirmed) {
        onMessageConfirmed({
          tempId,
          serverMessage: serverResponse,
        });
      }

      return {
        ...optimisticMessage,
        ...serverResponse,
        status: 'sent',
      };

    } catch (error) {
      console.error('Failed to send message:', error);

      // Mark as failed
      setOptimisticMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, status: 'failed', error: error.message }
            : msg
        )
      );

      // Move to failed queue for manual retry
      setFailedMessages((prev) => [
        ...prev,
        {
          ...optimisticMessage,
          status: 'failed',
          error: error.message,
          retryCount: 0,
        },
      ]);

      throw error;
    }
  }, [sendMessageFn, onMessageConfirmed]);

  /**
   * Retry a failed message
   * 
   * @param {string} tempId - Temporary message ID
   * @param {Object} messageData - Original message data
   * @param {Object} metadata - Original metadata
   */
  const retryMessage = useCallback(async (tempId, messageData, metadata = {}) => {
    const failedMessage = failedMessages.find((msg) => msg.tempId === tempId);
    
    if (!failedMessage) {
      console.warn('Failed message not found:', tempId);
      return;
    }

    // Check retry limit
    if (failedMessage.retryCount >= maxRetries) {
      console.error('Max retries exceeded for message:', tempId);
      return;
    }

    // Calculate backoff delay (exponential: 1s, 2s, 4s, 8s...)
    const retryDelay = Math.min(1000 * Math.pow(2, failedMessage.retryCount), 30000);

    // Update retry count
    setFailedMessages((prev) =>
      prev.map((msg) =>
        msg.tempId === tempId
          ? { ...msg, status: 'retrying', retryCount: msg.retryCount + 1 }
          : msg
      )
    );

    // Wait for backoff delay
    await new Promise((resolve) => {
      retryTimeoutsRef.current[tempId] = setTimeout(resolve, retryDelay);
    });

    try {
      // Retry send
      const serverResponse = await sendMessageFn({
        ...messageData,
        ...metadata,
        tempId,
      });

      // Success - remove from failed queue
      setFailedMessages((prev) =>
        prev.filter((msg) => msg.tempId !== tempId)
      );

      // Notify parent
      if (onMessageConfirmed) {
        onMessageConfirmed({
          tempId,
          serverMessage: serverResponse,
        });
      }

      // Clear retry timeout
      if (retryTimeoutsRef.current[tempId]) {
        clearTimeout(retryTimeoutsRef.current[tempId]);
        delete retryTimeoutsRef.current[tempId];
      }

      return {
        ...failedMessage,
        ...serverResponse,
        status: 'sent',
      };

    } catch (error) {
      console.error('Retry failed:', error);

      // Check if we should auto-retry
      if (failedMessage.retryCount + 1 < maxRetries) {
        // Schedule another retry
        setTimeout(() => {
          retryMessage(tempId, messageData, metadata);
        }, 100);
      } else {
        // Max retries reached - mark as permanently failed
        setFailedMessages((prev) =>
          prev.map((msg) =>
            msg.tempId === tempId
              ? { ...msg, status: 'failed', error: 'Max retries exceeded' }
              : msg
          )
        );
      }

      throw error;
    }
  }, [failedMessages, maxRetries, sendMessageFn, onMessageConfirmed]);

  /**
   * Manually retry a specific failed message
   * 
   * @param {string} tempId - Temporary message ID
   */
  const manualRetry = useCallback(async (tempId) => {
    const failedMessage = failedMessages.find((msg) => msg.tempId === tempId);
    
    if (!failedMessage) return;

    // Extract original data
    const { content, message_type, media_url, conversation_id, receiver_id } = failedMessage;
    
    const messageData = {
      content,
      message_type,
      media_url,
    };

    const metadata = {
      conversation_id,
      receiver_id,
    };

    await retryMessage(tempId, messageData, metadata);
  }, [failedMessages, retryMessage]);

  /**
   * Delete a failed message permanently
   * 
   * @param {string} tempId - Temporary message ID
   */
  const deleteFailed = useCallback((tempId) => {
    setFailedMessages((prev) =>
      prev.filter((msg) => msg.tempId !== tempId)
    );
    setOptimisticMessages((prev) =>
      prev.filter((msg) => msg.tempId !== tempId)
    );

    // Clear any pending retries
    if (retryTimeoutsRef.current[tempId]) {
      clearTimeout(retryTimeoutsRef.current[tempId]);
      delete retryTimeoutsRef.current[tempId];
    }
  }, []);

  /**
   * Clear all failed messages
   */
  const clearAllFailed = useCallback(() => {
    // Clear all retry timeouts
    Object.keys(retryTimeoutsRef.current).forEach((tempId) => {
      clearTimeout(retryTimeoutsRef.current[tempId]);
    });
    retryTimeoutsRef.current = {};

    setFailedMessages([]);
    setOptimisticMessages((prev) =>
      prev.filter((msg) => msg.status !== 'failed')
    );
  }, []);

  /**
   * Get combined status of pending operations
   */
  const getStatus = useCallback(() => {
    const sending = optimisticMessages.filter((msg) => msg.status === 'sending').length;
    const failed = failedMessages.length;
    const retrying = failedMessages.filter((msg) => msg.status === 'retrying').length;

    return {
      sending,
      failed,
      retrying,
      hasErrors: failed > 0,
      isProcessing: sending > 0 || retrying > 0,
    };
  }, [optimisticMessages, failedMessages]);

  /**
   * Confirm a message (called when server broadcast is received)
   * 
   * @param {string} tempId - Temporary ID
   * @param {Object} serverMessage - Server message object
   */
  const confirmMessage = useCallback((tempId, serverMessage) => {
    setOptimisticMessages((prev) =>
      prev.filter((msg) => msg.tempId !== tempId)
    );

    if (onMessageConfirmed) {
      onMessageConfirmed({ tempId, serverMessage });
    }
  }, [onMessageConfirmed]);

  return {
    // State
    optimisticMessages,
    failedMessages,
    
    // Actions
    sendMessage,
    retryMessage: manualRetry,
    deleteFailed,
    clearAllFailed,
    confirmMessage,
    
    // Status
    getStatus,
  };
};

export default useOptimisticMessages;
