import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { type Notification } from '@shared/schema';
import session from 'express-session';
import passport from 'passport';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private sessionParser: any;

  constructor(server: any, sessionParser: any) {
    this.sessionParser = sessionParser;
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.setupHeartbeat();
  }

  private handleConnection(ws: AuthenticatedWebSocket, request: IncomingMessage) {
    ws.isAlive = true;
    
    // Extract user ID from authenticated session
    this.authenticateWebSocket(request)
      .then((userId: string | null) => {
        if (userId) {
          ws.userId = userId;
          this.addClient(userId, ws);
          console.log(`WebSocket authenticated for user: ${userId}`);
        } else {
          console.log('WebSocket connection rejected - not authenticated');
          ws.close(1008, 'Authentication required');
        }
      })
      .catch((error: any) => {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Authentication failed');
      });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        this.removeClient(ws.userId, ws);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (ws.userId) {
        this.removeClient(ws.userId, ws);
      }
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to real-time notifications'
    }));
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: any) {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      
      case 'subscribe':
        // Handle subscription to specific notification types
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          channels: message.channels || ['all'] 
        }));
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private addClient(userId: string, ws: AuthenticatedWebSocket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  private removeClient(userId: string, ws: AuthenticatedWebSocket) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  private setupHeartbeat() {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (!authWs.isAlive) {
          authWs.terminate();
          return;
        }
        
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000); // 30 second heartbeat

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  // Send notification to specific user
  sendToUser(userId: string, notification: Notification) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify({
        type: 'notification',
        data: notification
      });

      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  // Send notification to all connected users
  broadcast(notification: Notification) {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Send system alert to all users
  sendSystemAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') {
    const alert = {
      type: 'system_alert',
      title,
      message,
      severity,
      timestamp: new Date().toISOString()
    };

    const alertMessage = JSON.stringify({
      type: 'system_alert',
      data: alert
    });

    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(alertMessage);
      }
    });
  }

  // Authenticate WebSocket connection using session
  private async authenticateWebSocket(request: IncomingMessage): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.sessionParser) {
        resolve(null);
        return;
      }

      // Parse session from request
      this.sessionParser(request, {} as any, () => {
        const session = (request as any).session;
        const user = (request as any).user;
        
        if (session && session.passport && session.passport.user) {
          resolve(session.passport.user);
        } else if (user && user.id) {
          resolve(user.id);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.wss.clients.size,
      userConnections: this.clients.size,
      activeUsers: Array.from(this.clients.keys())
    };
  }
}