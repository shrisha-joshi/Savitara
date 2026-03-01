import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import api from '../services/api';

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
    let wsHost = import.meta.env.VITE_BACKEND_WS_HOST;
    if (!wsHost) {
      const apiUrl = import.meta.env.VITE_BACKEND_API_URL || `http://localhost:8000`;
      wsHost = apiUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }

    // Fetch a short-lived WS ticket to avoid exposing the JWT in the URL
    let wsAuthParam;
    try {
      const ticketRes = await api.post('/auth/ws-ticket');
      const ticket = ticketRes.data?.data?.ticket;
      if (!ticket) throw new Error('No ticket in response');
      wsAuthParam = `ticket=${ticket}`;
    } catch (err) {
      const env = import.meta.env.VITE_ENV || 'development';
      if (env === 'production') {
        console.error('[WS] Ticket required in production. Aborting connection:', err);
        setIsConnecting(false);
        connectingRef.current = false;
        return;
      }
      console.error('[WS] Failed to get WS ticket, falling back to token (non-prod):', err);
      wsAuthParam = `token=${token}`; // server blocks in prod
    }
    
    const wsUrl = `${protocol}//${wsHost}/ws/${user.id}?${wsAuthParam}`;

    console.log('[WS] Connecting to:', `${protocol}//${wsHost}/ws/${user.id}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected successfully');
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
        console.log(`[WS] Sending ${offlineQueue.length} queued messages`);
        offlineQueue.forEach(msg => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        });
        setOfflineQueue([]);
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Do NOT log message content — may contain private chat data
        
        if (data.type === 'new_message') {
          setMessages(prev => [...prev, data]);
        } else if (data.type === 'message_read') {
          setMessages(prev => prev.map(msg => {
            if ((msg.id || msg._id) === (data.message_id || data.id)) {
              return { ...msg, status: 'read', read_at: data.read_at || new Date().toISOString() };
            }
            return msg;
          }));
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
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      setIsConnecting(false);
      connectingRef.current = false;
      setSocket(null);
      stopHeartbeat();

      // Exponential backoff reconnection (avoid if intentional closure code 1000)
      if (user && token && event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        console.log(
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

  }, [user, token, socket, offlineQueue, startHeartbeat, stopHeartbeat, handleTypingIndicator, handlePaymentRequired, handleDeliveryStatus]);

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
      console.log('WebSocket ready for real-time features');
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
