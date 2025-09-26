import { storage } from './storage';
import { type InsertNotification, type Notification } from '@shared/schema';
import { WebSocketService } from './websocketService';

export class NotificationService {
  private static instance: NotificationService;
  private wsService: WebSocketService | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  setWebSocketService(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  // Create and send notification
  async createAndSendNotification(notification: InsertNotification): Promise<Notification> {
    // Create notification in database
    const createdNotification = await storage.createNotification(notification);

    // Send via WebSocket if available
    if (this.wsService) {
      if (notification.userId) {
        this.wsService.sendToUser(notification.userId, createdNotification);
      } else {
        this.wsService.broadcast(createdNotification);
      }
    }

    return createdNotification;
  }

  // Violation alert when unauthorized vehicle detected
  async sendViolationAlert(plateNumber: string, location: string, userId?: string) {
    const notification: InsertNotification = {
      type: 'violation',
      title: 'Parking Violation Detected',
      message: `Unauthorized vehicle ${plateNumber} detected at ${location}`,
      severity: 'warning',
      userId,
      metadata: {
        plateNumber,
        location,
        timestamp: new Date().toISOString()
      }
    };

    return this.createAndSendNotification(notification);
  }

  // Quota warning when approaching limits
  async sendQuotaWarning(quotaType: string, current: number, limit: number, userId?: string) {
    const percentage = Math.round((current / limit) * 100);
    
    const notification: InsertNotification = {
      type: 'quota_warning',
      title: 'Quota Warning',
      message: `${quotaType} quota is ${percentage}% full (${current}/${limit})`,
      severity: percentage >= 90 ? 'error' : 'warning',
      userId,
      metadata: {
        quotaType,
        current,
        limit,
        percentage
      }
    };

    return this.createAndSendNotification(notification);
  }

  // System alerts for various events
  async sendSystemAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info', userId?: string) {
    const notification: InsertNotification = {
      type: 'system_alert',
      title,
      message,
      severity,
      userId,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    return this.createAndSendNotification(notification);
  }

  // Bulk violation alert when multiple violations detected
  async sendBulkViolationAlert(violationCount: number, timeFrame: string, userId?: string) {
    const notification: InsertNotification = {
      type: 'violation',
      title: 'Multiple Violations Detected',
      message: `${violationCount} parking violations detected in the last ${timeFrame}`,
      severity: 'error',
      userId,
      metadata: {
        violationCount,
        timeFrame,
        timestamp: new Date().toISOString()
      }
    };

    return this.createAndSendNotification(notification);
  }

  // Google Sheets sync notifications
  async sendSyncNotification(synced: number, failed: number, userId?: string) {
    const severity = failed > 0 ? 'warning' : 'success';
    const message = failed > 0 
      ? `Google Sheets sync completed: ${synced} synced, ${failed} failed`
      : `Google Sheets sync completed successfully: ${synced} entries synced`;

    const notification: InsertNotification = {
      type: 'system_alert',
      title: 'Google Sheets Sync',
      message,
      severity,
      userId,
      metadata: {
        synced,
        failed,
        timestamp: new Date().toISOString()
      }
    };

    return this.createAndSendNotification(notification);
  }

  // Monitor violation threshold and send alerts
  async checkViolationThreshold(userId: string) {
    const settings = await storage.getNotificationSettings(userId);
    if (!settings || !settings.violationAlerts) return;

    const threshold = parseInt(settings.violationThreshold || "10");
    
    // Get recent violations (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEntries = await storage.getAuditEntries({
      limit: 1000,
      page: 1
    });

    const recentViolations = recentEntries.entries.filter(entry => 
      entry.authorizationStatus === 'unauthorized' && 
      new Date(entry.timestamp) > oneHourAgo
    );

    if (recentViolations.length >= threshold) {
      await this.sendBulkViolationAlert(recentViolations.length, '1 hour', userId);
    }
  }

  // Check storage quotas and send warnings
  async checkStorageQuotas(userId?: string) {
    try {
      const stats = await storage.getAuditStats();
      const settings = await storage.getAppSettings();
      
      // Check audit entry count vs retention policy
      const retentionDays = settings['auditRetentionDays'] || 90;
      const expectedMaxEntries = retentionDays * 50; // Assume ~50 entries per day max
      
      if (stats.totalScans > expectedMaxEntries * 0.8) {
        await this.sendQuotaWarning(
          'Audit Entries', 
          stats.totalScans, 
          expectedMaxEntries, 
          userId
        );
      }

      // Check for other quotas like image storage, etc.
      // This can be expanded based on actual storage metrics

    } catch (error) {
      console.error('Error checking storage quotas:', error);
    }
  }

  // Send welcome notification to new users
  async sendWelcomeNotification(userId: string) {
    const notification: InsertNotification = {
      type: 'system_alert',
      title: 'Welcome to ParkAudit Pro',
      message: 'You can now receive real-time notifications for parking violations and system alerts.',
      severity: 'info',
      userId,
      metadata: {
        isWelcome: true,
        timestamp: new Date().toISOString()
      }
    };

    return this.createAndSendNotification(notification);
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();