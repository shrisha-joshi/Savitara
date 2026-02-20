import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api.config';

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
  const socketRef = useRef(null);

  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          console.log('No token found, skipping socket connection');
          return;
        }

        // Extract base URL without /api/v1
        const socketUrl = API_CONFIG.baseURL.replace('/api/v1', '');

        const socketInstance = io(socketUrl, {
          auth: {
            token,
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
          console.log('Socket connected:', socketInstance.id);
          setConnected(true);
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setConnected(false);
        });

        socketInstance.on('error', (error) => {
          console.error('Socket error:', error);
        });

        socketInstance.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }, [socket, connected]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  const value = useMemo(() => ({
    socket,
    connected,
    emit,
    on,
    off,
  }), [socket, connected, emit, on, off]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

SocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SocketContext;
