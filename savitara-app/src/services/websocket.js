/**
 * WebSocket Service for Real-time Communication
 */
import { API_CONFIG } from '../config/api.config';
import api from './api';

class WebSocketService {
  ws = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectDelay = 1000;
  listeners = {};
  isConnecting = false;
  heartbeatInterval = null;
  heartbeatMs = 30000;

  async connect(userId, token) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection in progress');
      return;
    }

    this.isConnecting = true;

    try {
      const baseHttp = API_CONFIG.baseURL.replace(/\/$/, '').replace(/\/api\/v1$/, '');
      const wsBase = baseHttp.replace('http', 'ws');

      let authParam;
      try {
        const ticketRes = await api.post('/auth/ws-ticket');
        const ticket = ticketRes?.data?.data?.ticket;
        if (!ticket) throw new Error('Missing ticket');
        authParam = `ticket=${ticket}`;
      } catch (err) {
        if (__DEV__ && token) {
          console.warn('[WS] Ticket fetch failed, falling back to token in dev:', err?.message || err);
          authParam = `token=${token}`;
        } else {
          this.isConnecting = false;
          this.emit('error', err);
          return;
        }
      }

      this.ws = new WebSocket(`${wsBase}/ws/${userId}?${authParam}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected', { userId });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.emit('disconnected');
        this.stopHeartbeat();
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * this.reconnectAttempts;
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          
          setTimeout(() => {
            this.connect(userId, token);
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.stopHeartbeat();
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.heartbeatMs);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleMessage(message) {
    const { type } = message;
    
    // Emit to registered listeners
    this.emit(type, message);
    
    // Also emit to generic 'message' event
    this.emit('message', message);
  }

  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Message handlers
  sendChatMessage(receiverId, conversationId, content) {
    this.send({
      type: 'chat_message',
      receiver_id: receiverId,
      conversation_id: conversationId,
      content,
    });
  }

  sendTypingIndicator(receiverId, conversationId, isTyping = true) {
    this.send({
      type: 'typing_indicator',
      receiver_id: receiverId,
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }

  sendBookingUpdate(bookingId, status, grihastaId, acharyaId) {
    this.send({
      type: 'booking_update',
      booking_id: bookingId,
      status,
      grihasta_id: grihastaId,
      acharya_id: acharyaId,
    });
  }

  joinRoom(roomId) {
    this.send({
      type: 'join_room',
      room_id: roomId,
    });
  }

  leaveRoom(roomId) {
    this.send({
      type: 'leave_room',
      room_id: roomId,
    });
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
