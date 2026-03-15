import PropTypes from 'prop-types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';

// ── Module-level WS message state updater to avoid deep function nesting ──
function applyWsMarkRead(messages, messageId, readAt) {
  return messages.map(msg => {
    if ((msg.id || msg._id) !== messageId) return msg;
    return { ...msg, status: 'read', read_at: readAt || new Date().toISOString() };
  });
}

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const OFFLINE_QUEUE_KEY = 'savitara_offline_messages';
const MAX_QUEUE_SIZE = 50;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingIndicators, setTypingIndicators] = useState({});
  const [bookingUpdates, setBookingUpdates] = useState([]);
  const [paymentNotifications, setPaymentNotifications] = useState([]);
  const [offlineQueue, setOfflineQueue] = useState([]);
  
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const connectingRef = useRef(false);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (saved) {
        const queue = JSON.parse(saved);
        setOfflineQueue(queue);
      }
    } catch (err) {
      console.error('Failed to load offline queue:', err);
    }
  }, []);

  // Save offline queue to localStorage whenever it changes
  useEffect(() => {
    if (offlineQueue.length > 0) {
      try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue.slice(0, MAX_QUEUE_SIZE)));
      } catch (err) {
        console.error('Failed to save offline queue:', err);
      }
    }
  }, [offlineQueue]);

  // Start heartbeat to keep connection alive
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

  // Handle typing indicator with auto-clear
  const handleTypingIndicator = useCallback((data) => {
    const fromId = data.sender_id || data.user_id;
    if (fromId) {
      setTypingIndicators(prev => ({ ...prev, [fromId]: { isTyping: data.is_typing, at: Date.now() } }));
      // auto-clear typing after 5s
      setTimeout(() => {
        setTypingIndicators(prev => {
          const clone = { ...prev };
          delete clone[fromId];
          return clone;
        });
      }, 5000);
    }
  }, []);

  // Handle payment required notifications
  const handlePaymentRequired = useCallback((data) => {
    setPaymentNotifications(prev => [...prev.slice(-5), { ...data, received_at: Date.now(), read: false }]);
    setBookingUpdates(prev => [...prev.slice(-10), { ...data, received_at: Date.now() }]);
    
    // Show browser notification if permitted
    if ('Notification' in globalThis && Notification.permission === 'granted') {
      new Notification('Booking Approved!', {
        body: `Amount: ₹${data.amount}. Please complete payment.`,
        icon: '/logo.png',
        tag: `payment-${data.booking_id}`
      });
    }
  }, []);

  // Upgrade message delivery status (sent → delivered → read). Never downgrade.
  const handleDeliveryStatus = useCallback((data) => {
    const statusOrder = { sending: 0, sent: 1, delivered: 2, read: 3 };
    const newRank = statusOrder[data.status] ?? -1;
    setMessages(prev => prev.map(msg => {
      const msgId = msg.id || msg._id || msg.message_id;
      if (!msgId || msgId !== data.message_id) return msg;
      const currentRank = statusOrder[msg.status] ?? -1;
      return newRank > currentRank ? { ...msg, status: data.status } : msg;
    }));
  }, []);

  // WebSocket message handler — defined at component level to avoid 4+ function nesting in connect
  const handleWsMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      // Do NOT log message content — may contain private chat data

      if (data.type === 'new_message') {
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'message_read') {
        setMessages(prev => applyWsMarkRead(prev, data.message_id || data.id, data.read_at));
      } else if (data.type === 'pong') {
        // heartbeat response; no-op
      } else if (data.type === 'typing_indicator') {
        handleTypingIndicator(data);
      } else if (data.type === 'payment_required') {
        handlePaymentRequired(data);
      } else if (data.type === 'booking_update') {
        const normalized = {
          booking_id: data.booking_id || data.booking?.id,
          status: data.status || data.booking?.status,
          grihasta_id: data.grihasta_id || data.booking?.grihasta_id,
          acharya_id: data.acharya_id || data.booking?.acharya_id,
          initiator_id: data.initiator_id,
          timestamp: data.timestamp,
          received_at: Date.now(),
        };
        setBookingUpdates(prev => [...prev.slice(-10), normalized]);
      } else if (data.type === 'delivery_status') {
        handleDeliveryStatus(data);
      }
    } catch (err) {
      console.error('WS Parse Error:', err);
    }
  }, [handleTypingIndicator, handlePaymentRequired, handleDeliveryStatus]);

  const connect = useCallback(async () => {
    if (!user || !token || socket?.readyState === WebSocket.OPEN || connectingRef.current) return;

    if (socket) {
      socket.close();
    }

    connectingRef.current = true;
    setIsConnecting(true);

    // Determine WS protocol and host dynamically
    const isSecure = globalThis.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    
    // Get WebSocket host from environment or derive from current location
    const fallbackApiUrl = import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '';
    const apiBaseUrl = import.meta.env.VITE_BACKEND_API_URL || fallbackApiUrl;
    
    let wsHost = import.meta.env.VITE_BACKEND_WS_HOST;
    if (!wsHost) {
      // derive wsHost from apiBaseUrl, stripping protocol and "/api/v1" or other paths
      wsHost = apiBaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }

    // In local development, skip ws-ticket endpoint to avoid noisy 503s when Redis is unavailable.
    // In non-DEV environments, require short-lived ticket auth.
    let wsAuthParam;
    if (import.meta.env.DEV) {
      wsAuthParam = `token=${encodeURIComponent(token)}`;
    } else {
      try {
        const ticketRes = await fetch(`${apiBaseUrl}/auth/ws-ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: '{}',
        });
        if (!ticketRes.ok) throw new Error(`HTTP ${ticketRes.status}`);
        const ticketData = await ticketRes.json();
        const ticket = ticketData?.data?.ticket;
        if (!ticket) throw new Error('No ticket in response');
        wsAuthParam = `ticket=${ticket}`;
      } catch (err) {
        console.error('[WS] Ticket required outside development. Aborting connection:', err);
        setIsConnecting(false);
        connectingRef.current = false;
        return;
      }
    }
    
    const wsUrl = `${protocol}//${wsHost}/ws/${user.id}?${wsAuthParam}`;

    logger.log('[WS] Connecting to:', `${protocol}//${wsHost}/ws/${user.id}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      logger.log('[WS] Connected successfully');
      setIsConnected(true);
      setIsConnecting(false);
      connectingRef.current = false;
      reconnectAttemptsRef.current = 0; // Reset reconnect counter
      setSocket(ws);
      
      // Clear any pending reconnects
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Start heartbeat
      startHeartbeat(ws);
      
      // Send any queued messages
      if (offlineQueue.length > 0) {
        logger.log(`[WS] Sending ${offlineQueue.length} queued messages`);
        const newRemaining = [];
        for (const msg of offlineQueue) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            } else {
              newRemaining.push(msg);
            }
          } catch (err) {
            console.error('Failed to send queued message via WS:', err);
            newRemaining.push(msg);
          }
        }
        setOfflineQueue(newRemaining);
        if (newRemaining.length === 0) {
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
        } else {
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newRemaining));
        }
      }
    };

    ws.onmessage = handleWsMessage;

    ws.onclose = (event) => {
      logger.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      setIsConnecting(false);
      connectingRef.current = false;
      setSocket(null);
      stopHeartbeat();

      // Exponential backoff reconnection (avoid if intentional closure code 1000)
      if (user && token && event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        logger.log(
          `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`
        );
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WS] Max reconnection attempts reached');
        
        // Notify user of connection failure
        globalThis.dispatchEvent(new CustomEvent('websocket_failed', {
          detail: { message: 'Unable to connect to chat. Please refresh the page.' }
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      // Let onclose handle reconnection
    };

  }, [user, token, socket, offlineQueue, startHeartbeat, stopHeartbeat, handleWsMessage]);

  useEffect(() => {
    if (user && token) {
      connect();
    }
    return () => {
      if (socket) socket.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      stopHeartbeat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]); // Removed connect from deps to prevent recursive updates

  const sendMessage = useCallback((receiverId, content) => {
    // We use REST API for sending to ensure persistence and validation
    // WebSocket is used for real-time updates and typing indicators
    if (socket?.readyState === WebSocket.OPEN) {
      // Can be extended for typing indicators
      logger.log('WebSocket ready for real-time features');
    }
  }, [socket]);

  const queueMessage = useCallback((messageData) => {
    setOfflineQueue(prev => [...prev, { ...messageData, timestamp: Date.now() }]);
  }, []);

  const sendTypingIndicator = useCallback((receiverId, isTyping) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'typing_indicator',
        receiver_id: receiverId,
        is_typing: isTyping
      }));
    }
  }, [socket]);

  const markPaymentNotificationRead = useCallback((bookingId) => {
    setPaymentNotifications(prev => 
      prev.map(notif => 
        notif.booking_id === bookingId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const clearPaymentNotifications = useCallback(() => {
    setPaymentNotifications([]);
  }, []);

  const contextValue = useMemo(
    () => ({ 
      socket, 
      isConnected, 
      isConnecting,
      messages, 
      setMessages, 
      sendMessage, 
      queueMessage, 
      offlineQueue,
      sendTypingIndicator,
      typingIndicators,
      bookingUpdates,
      paymentNotifications,
      markPaymentNotificationRead,
      clearPaymentNotifications,
    }),
    [socket, isConnected, isConnecting, messages, sendMessage, queueMessage, offlineQueue, sendTypingIndicator, typingIndicators, bookingUpdates, paymentNotifications, markPaymentNotificationRead, clearPaymentNotifications]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

SocketProvider.propTypes = {
  children: PropTypes.node.isRequired
};
