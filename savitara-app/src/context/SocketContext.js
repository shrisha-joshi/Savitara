/**
 * WebSocket Context for Real-time Communication (Mobile)
 * Uses native WebSockets compatible with FastAPI backend
 * Features: Auto-reconnection, offline queue, typing indicators
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import PropTypes from 'prop-types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { API_CONFIG } from '../config/api.config';
import api from '../services/api';

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
      const userJson = await AsyncStorage.getItem('user');
      const userId = userJson ? JSON.parse(userJson)?.id || JSON.parse(userJson)?._id : null;
      const token = await SecureStore.getItemAsync('accessToken');

      if (!token || !userId) {
        console.log('[WS] No token or userId found');
        return null;
      }

      // Convert HTTP URL to WebSocket URL
      let wsUrl = API_CONFIG.baseURL
        .replace('http://', 'ws://')
        .replace('https://', 'wss://')
        .replace(/\/?api\/v1$/, '');

      // Enforce WSS in production
      if (!__DEV__ && wsUrl.startsWith('ws://')) {
        console.warn('[WS] Insecure ws:// not allowed in production, upgrading to wss://');
        wsUrl = wsUrl.replace('ws://', 'wss://');
      }

      let authParam;
      try {
        const ticketRes = await api.post('/auth/ws-ticket');
        const ticket = ticketRes?.data?.data?.ticket;
        if (!ticket) throw new Error('Missing WS ticket');
        authParam = `ticket=${ticket}`;
      } catch (err) {
        if (__DEV__ && token) {
          console.warn('[WS] Ticket fetch failed, falling back to token in dev:', err?.message || err);
          authParam = `token=${token}`;
        } else {
          console.error('[WS] Ticket required for WebSocket connection');
          return null;
        }
      }

      return {
        url: `${wsUrl}/ws/${userId}?${authParam}`,
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
      if (ws?.readyState === WebSocket.OPEN) {
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

  // Helper: remove a user from typing state
  const removeTypingUser = useCallback((userId) => {
    setTypingUsers(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  }, []);

  // Handle incoming WebSocket message
  const handleWsMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[WS] Message received:', data.type);

      const payload = data.data || data;

      switch (data.type) {
        case 'pong':
        case 'connection_established':
          break;

        case 'chat_message':
        case 'new_message':
          setChatMessages(prev => [...prev.slice(-99), payload]);
          break;

        case 'typing_indicator':
          if (payload.is_typing) {
            setTypingUsers(prev => ({
              ...prev,
              [payload.user_id]: {
                conversation_id: payload.conversation_id,
                timestamp: Date.now(),
              },
            }));
            setTimeout(() => removeTypingUser(payload.user_id), 3000);
          } else {
            removeTypingUser(payload.user_id);
          }
          break;

        case 'booking_update':
          setBookingUpdates(prev => [
            ...prev.slice(-10),
            {
              booking_id: payload.booking_id || payload.booking?.id,
              status: payload.status || payload.booking?.status,
              grihasta_id: payload.grihasta_id || payload.booking?.grihasta_id,
              acharya_id: payload.acharya_id || payload.booking?.acharya_id,
              initiator_id: payload.initiator_id,
              timestamp: payload.timestamp,
              received_at: Date.now(),
            },
          ]);
          break;

        case 'payment_required':
          setPaymentNotifications(prev => [
            ...prev.slice(-5),
            { ...payload, received_at: Date.now(), read: false },
          ]);
          setBookingUpdates(prev => [
            ...prev.slice(-10),
            { ...payload, received_at: Date.now() },
          ]);
          break;

        case 'message_read':
          setChatMessages(prev =>
            prev.map(msg =>
              msg.id === payload.message_id || msg._id === payload.message_id
                ? { ...msg, read: true, status: 'read' }
                : msg
            )
          );
          break;

        case 'reaction_added':
        case 'reaction_removed':
          setChatMessages(prev => [...prev.slice(-99), payload]);
          break;

        case 'conversation_updated':
          console.log('[WS] Conversation updated:', payload);
          break;

        default:
          console.log('[WS] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[WS] Error parsing message:', error);
    }
  }, [removeTypingUser]);

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

      ws.onmessage = handleWsMessage;

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
    if (socketRef.current?.readyState === WebSocket.OPEN) {
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
