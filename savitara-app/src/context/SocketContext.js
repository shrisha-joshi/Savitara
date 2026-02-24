/**
 * WebSocket Context for Real-time Communication (Mobile)
 * Uses native WebSockets compatible with FastAPI backend
 * Features: Auto-reconnection, offline queue, typing indicators
 */
import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api.config';
import { Alert } from 'react-native';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [bookingUpdates, setBookingUpdates] = useState([]);
  const [paymentNotifications, setPaymentNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const offlineQueueRef = useRef([]);
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000; // 1 second
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds

  // Get WebSocket URL from API config
  const getWebSocketUrl = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userId = await AsyncStorage.getItem('user_id');
      
      if (!token || !userId) {
        console.log('[WS] No token or userId found');
        return null;
      }

      // Convert HTTP URL to WebSocket URL
      let wsUrl = API_CONFIG.baseURL
        .replace('http://', 'ws://')
        .replace('https://', 'wss://')
        .replace('/api/v1', '');

      return {
        url: `${wsUrl}/ws/${userId}?token=${token}`,
        userId,
        token,
      };
    } catch (error) {
      console.error('[WS] Error getting WebSocket URL:', error);
      return null;
    }
  }, []);

  // Send heartbeat to keep connection alive
  const startHeartbeat = useCallback((ws) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Process offline queue
  const processOfflineQueue = useCallback(async (ws) => {
    try {
      const queueJson = await AsyncStorage.getItem('ws_offline_queue');
      if (queueJson) {
        const queue = JSON.parse(queueJson);
        console.log(`[WS] Processing ${queue.length} queued messages`);
        
        queue.forEach((msg) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        });

        await AsyncStorage.removeItem('ws_offline_queue');
        offlineQueueRef.current = [];
      }
    } catch (error) {
      console.error('[WS] Error processing offline queue:', error);
    }
  }, []);

  // Add message to offline queue
  const queueMessage = useCallback(async (message) => {
    try {
      offlineQueueRef.current.push(message);
      
      // Limit queue size to 50 messages
      if (offlineQueueRef.current.length > 50) {
        offlineQueueRef.current = offlineQueueRef.current.slice(-50);
      }

      await AsyncStorage.setItem(
        'ws_offline_queue',
        JSON.stringify(offlineQueueRef.current)
      );
    } catch (error) {
      console.error('[WS] Error queueing message:', error);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    const wsConfig = await getWebSocketUrl();
    if (!wsConfig) {
      console.log('[WS] Cannot connect - missing credentials');
      return;
    }

    try {
      console.log('[WS] Connecting to:', wsConfig.url.split('?')[0]); // Don't log token

      const ws = new WebSocket(wsConfig.url);

      ws.onopen = async () => {
        console.log('[WS] Connected successfully');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Start heartbeat
        startHeartbeat(ws);
        
        // Process any queued messages
        await processOfflineQueue(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data.type);

          // Handle different message types
          switch (data.type) {
            case 'pong':
              // Heartbeat response
              break;

            case 'chat_message':
            case 'new_message':
              setChatMessages(prev => [...prev.slice(-99), data.data]);
              break;

            case 'typing_indicator':
              if (data.data.is_typing) {
                setTypingUsers(prev => ({
                  ...prev,
                  [data.data.user_id]: {
                    conversation_id: data.data.conversation_id,
                    timestamp: Date.now(),
                  },
                }));
                
                // Auto-remove typing indicator after 3 seconds
                setTimeout(() => {
                  setTypingUsers(prev => {
                    const newState = { ...prev };
                    delete newState[data.data.user_id];
                    return newState;
                  });
                }, 3000);
              } else {
                setTypingUsers(prev => {
                  const newState = { ...prev };
                  delete newState[data.data.user_id];
                  return newState;
                });
              }
              break;

            case 'booking_update':
              setBookingUpdates(prev => [
                ...prev.slice(-10),
                { ...data.data, received_at: Date.now() },
              ]);
              break;

            case 'payment_required':
              setPaymentNotifications(prev => [
                ...prev.slice(-5),
                { ...data.data, received_at: Date.now(), read: false },
              ]);
              setBookingUpdates(prev => [
                ...prev.slice(-10),
                { ...data.data, received_at: Date.now() },
              ]);
              break;

            case 'message_read':
              // Update message read status
              setChatMessages(prev =>
                prev.map(msg =>
                  msg.id === data.data.message_id
                    ? { ...msg, read: true }
                    : msg
                )
              );
              break;

            case 'conversation_updated':
              // Trigger conversation list refresh
              console.log('[WS] Conversation updated:', data.data);
              break;

            default:
              console.log('[WS] Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnected(false);
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setConnected(false);
        stopHeartbeat();

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          console.log(
            `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        } else {
          console.error('[WS] Max reconnection attempts reached');
          Alert.alert(
            'Connection Lost',
            'Unable to connect to chat. Please check your internet connection and restart the app.',
            [{ text: 'OK' }]
          );
        }
      };

      socketRef.current = ws;
      setSocket(ws);
    } catch (error) {
      console.error('[WS] Connection error:', error);
      setConnected(false);
    }
  }, [getWebSocketUrl, startHeartbeat, stopHeartbeat, processOfflineQueue]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopHeartbeat();
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  }, [stopHeartbeat]);

  // Send message with offline queue support
  const sendMessage = useCallback(async (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.log('[WS] Queueing message for offline delivery');
      await queueMessage(message);
    }
  }, [queueMessage]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((conversationId, isTyping = true) => {
    sendMessage({
      type: 'typing_indicator',
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }, [sendMessage]);

  // Mark payment notification as read
  const markPaymentNotificationRead = useCallback((bookingId) => {
    setPaymentNotifications(prev =>
      prev.map(notif =>
        notif.booking_id === bookingId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  // Clear payment notifications
  const clearPaymentNotifications = useCallback(() => {
    setPaymentNotifications([]);
  }, []);

  // Clear chat messages
  const clearChatMessages = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      sendMessage,
      sendTypingIndicator,
      chatMessages,
      bookingUpdates,
      paymentNotifications,
      typingUsers,
      markPaymentNotificationRead,
      clearPaymentNotifications,
      clearChatMessages,
      reconnect: connect,
      disconnect,
    }),
    [
      socket,
      connected,
      sendMessage,
      sendTypingIndicator,
      chatMessages,
      bookingUpdates,
      paymentNotifications,
      typingUsers,
      markPaymentNotificationRead,
      clearPaymentNotifications,
      clearChatMessages,
      connect,
      disconnect,
    ]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

SocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SocketContext;
