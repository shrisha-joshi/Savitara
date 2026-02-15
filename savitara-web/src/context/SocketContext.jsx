import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!user || !token || (socket && socket.readyState === WebSocket.OPEN)) return;

    if (socket) {
      socket.close();
    }

    // Determine WS protocol based on window location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = 'localhost:8000'; // Hardcoded for dev, normally window.location.host
    const wsUrl = `${protocol}//${host}/ws/${user.id}?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setSocket(ws);
      // Clear any pending reconnects
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS Message:', data);
        
        if (data.type === 'new_message') {
          // Add new message to state - deduping logic is good to have in UI too
          setMessages(prev => [...prev, data.message]);
        }
      } catch (err) {
        console.error('WS Parse Error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setSocket(null);

      // Attempt reconnect after 3 seconds
      if (user && token) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting Reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      ws.close();
    };

  }, [user, token, socket]);

  useEffect(() => {
    if (user && token) {
      connect();
    }
    return () => {
      if (socket) socket.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [user, token, connect]); // Added connect to deps

  const sendMessage = useCallback((receiverId, content) => {
    // We use REST API for sending to ensure persistence and validation
    // But we could use socket for typing indicators etc.
    if (socket && socket.readyState === WebSocket.OPEN) {
      // socket.send(JSON.stringify({ type: 'typing', receiverId }));
    }
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, messages, setMessages, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
};
