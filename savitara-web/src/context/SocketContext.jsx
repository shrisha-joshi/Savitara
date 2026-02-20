import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const OFFLINE_QUEUE_KEY = 'savitara_offline_messages';
const MAX_QUEUE_SIZE = 50;

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingIndicators, setTypingIndicators] = useState({});
  const [bookingUpdates, setBookingUpdates] = useState([]);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const reconnectTimeoutRef = useRef(null);
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

  const connect = useCallback(() => {
    if (!user || !token || socket?.readyState === WebSocket.OPEN || connectingRef.current) return;

    if (socket) {
      socket.close();
    }

    connectingRef.current = true;
    setIsConnecting(true);

    // Determine WS protocol and host dynamically
    const isSecure = globalThis.location?.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    
    // Use environment variable or fallback to current host
    const backendHost = import.meta.env.VITE_BACKEND_WS_HOST || 
              import.meta.env.VITE_BACKEND_HOST || 
              'localhost:8000' ||
              globalThis.location?.host;
    
    const wsUrl = `${protocol}//${backendHost}/ws/${user.id}?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setIsConnecting(false);
      connectingRef.current = false;
      setSocket(ws);
      // Clear any pending reconnects
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Send any queued messages
      if (offlineQueue.length > 0) {
        console.log(`Sending ${offlineQueue.length} queued messages`);
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
        console.log('WS Message:', data);
        
        if (data.type === 'new_message') {
          setMessages(prev => [...prev, data]);
        } else if (data.type === 'message_read') {
          setMessages(prev => prev.map(msg => {
            if ((msg.id || msg._id) === (data.message_id || data.id)) {
              return { ...msg, status: 'read', read_at: data.read_at || new Date().toISOString() };
            }
            return msg;
          }));
        } else if (data.type === 'typing_indicator') {
          const fromId = data.sender_id || data.user_id
          if (fromId) {
            setTypingIndicators(prev => ({ ...prev, [fromId]: { isTyping: data.is_typing, at: Date.now() } }))
            // auto-clear typing after 5s
            setTimeout(() => {
              setTypingIndicators(prev => {
                const clone = { ...prev }
                delete clone[fromId]
                return clone
              })
            }, 5000)
          }
        } else if (data.type === 'booking_update') {
          setBookingUpdates(prev => [...prev.slice(-10), { ...data, received_at: Date.now() }]);
        }
      } catch (err) {
        console.error('WS Parse Error:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket Disconnected', event.code, event.reason);
      setIsConnected(false);
      setIsConnecting(false);
      connectingRef.current = false;
      setSocket(null);

      // Attempt reconnect after 3 seconds, but only if not a normal closure
      if (user && token && event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting Reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      // Let onclose handle reconnection
    };

  }, [user, token, socket, offlineQueue]);

  useEffect(() => {
    if (user && token) {
      connect();
    }
    return () => {
      if (socket) socket.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
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
    }),
    [socket, isConnected, isConnecting, messages, sendMessage, queueMessage, offlineQueue, sendTypingIndicator, typingIndicators, bookingUpdates]
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
