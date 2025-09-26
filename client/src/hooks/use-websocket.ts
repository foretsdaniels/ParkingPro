import { useEffect, useRef, useState } from 'react';
import { type Notification } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: 'notification' | 'system_alert' | 'connected' | 'pong';
  data?: Notification | any;
  message?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const reconnectTimer = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Clear any reconnect timer
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = undefined;
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'notification':
              if (message.data) {
                const notification = message.data as Notification;
                setNotifications(prev => [notification, ...prev]);
                
                // Show toast notification
                toast({
                  title: notification.title,
                  description: notification.message,
                  variant: notification.severity === 'error' ? 'destructive' : 'default',
                });
              }
              break;
              
            case 'system_alert':
              if (message.data) {
                toast({
                  title: message.data.title,
                  description: message.data.message,
                  variant: message.data.severity === 'error' ? 'destructive' : 'default',
                });
              }
              break;
              
            case 'connected':
              console.log('WebSocket handshake complete');
              break;
              
            default:
              console.log('Unknown WebSocket message:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Auto-reconnect after 3 seconds if not intentionally closed
        if (event.code !== 1000) {
          reconnectTimer.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connect();
          }, 3000);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
    
    if (ws.current) {
      ws.current.close(1000, 'User disconnect');
      ws.current = null;
    }
    setIsConnected(false);
  };

  const sendMessage = (message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Ping-pong heartbeat
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    isConnected,
    notifications,
    connect,
    disconnect,
    sendMessage,
    clearNotifications: () => setNotifications([])
  };
}