/**
 * WebSocket Service for Real-time Communication
 */
import { API_CONFIG } from '../config/api.config';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = {};
    this.isConnecting = false;
  }

  connect(userId, token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection in progress');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = API_CONFIG.baseURL.replace('http', 'ws');
      this.ws = new WebSocket(`${wsUrl}/ws/${userId}?token=${token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected', { userId });
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
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
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
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
