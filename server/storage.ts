import { 
  type User, 
  type InsertUser, 
  type AuditEntry, 
  type InsertAuditEntry,
  type WhitelistPlate,
  type InsertWhitelistPlate,
  type AppSetting,
  type InsertAppSetting,
  users,
  auditEntries,
  whitelistPlates,
  appSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, count, sql, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { GoogleSheetsService } from "./googleSheetsService";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Audit Entries
  getAuditEntries(options: { page?: number; limit?: number; search?: string; status?: string }): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }>;
  getAuditEntry(id: string): Promise<AuditEntry | undefined>;
  createAuditEntry(entry: InsertAuditEntry): Promise<AuditEntry>;
  updateAuditEntry(id: string, updates: Partial<AuditEntry>): Promise<AuditEntry | undefined>;
  deleteAuditEntry(id: string): Promise<boolean>;
  getAuditStats(period?: string): Promise<{
    totalScans: number;
    authorizedVehicles: number;
    unauthorizedVehicles: number;
    unknownCount: number;
    recentActivity: number;
    avgConfidence: number;
    topZones: Array<{ zone: string; count: number }>;
    dailyTrends: Array<{ date: string; scans: number; authorized: number; unauthorized: number }>;
    hourlyDistribution: Array<{ hour: number; scans: number }>;
  }>;

  // Whitelist
  getWhitelistPlates(): Promise<WhitelistPlate[]>;
  getWhitelistPlateByNumber(plateNumber: string): Promise<WhitelistPlate | undefined>;
  createWhitelistPlate(plate: InsertWhitelistPlate): Promise<WhitelistPlate>;
  deleteWhitelistPlate(id: string): Promise<boolean>;

  // App Settings
  getAppSettings(): Promise<Record<string, any>>;
  getAppSetting(key: string): Promise<any>;
  updateAppSetting(key: string, value: any): Promise<AppSetting>;

  // Google Sheets Sync
  queueForGoogleSheetsSync(entryId: string): Promise<void>;
  syncPendingToGoogleSheets(): Promise<{ synced: number; failed: number }>;
  getSyncStatus(): Promise<{
    lastSyncTime?: Date;
    pendingCount: number;
    isOnline: boolean;
  }>;
}

export class DatabaseStorage implements IStorage {
  private googleSheetsSyncQueue: Set<string> = new Set();

  constructor() {
    // Initialize default settings
    this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const defaultSettings = {
      ocrThreshold: 85,
      autoFlash: true,
      saveFullImages: true,
      gpsAccuracy: 'high',
      googleSheetsIntegration: false,
      googleSheetsId: '',
      lastSyncTime: null,
      allowOfflineMode: true,
      autoSyncInterval: 5000,
      compressionQuality: 0.8,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      auditRetentionDays: 90,
      debugMode: false,
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      try {
        // Check if setting already exists
        const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({
            key,
            value: JSON.stringify(value),
          });
        }
      } catch (error) {
        console.error(`Failed to initialize setting ${key}:`, error);
      }
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Audit Entries
  async getAuditEntries(options: { page?: number; limit?: number; search?: string; status?: string }): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { page = 1, limit = 20, search, status } = options;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = [];
      
      if (search) {
        whereConditions.push(
          sql`${auditEntries.plateNumber} ILIKE ${`%${search}%`} OR ${auditEntries.location} ILIKE ${`%${search}%`} OR ${auditEntries.parkingZone} ILIKE ${`%${search}%`}`
        );
      }
      
      if (status && status !== 'all') {
        whereConditions.push(
          eq(auditEntries.authorizationStatus, status)
        );
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total count
      const totalQuery = whereClause 
        ? db.select({ count: count() }).from(auditEntries).where(whereClause)
        : db.select({ count: count() }).from(auditEntries);
      
      const [{ count: total }] = await totalQuery;

      // Get paginated entries
      const entriesQuery = whereClause
        ? db.select().from(auditEntries)
            .where(whereClause)
            .orderBy(desc(auditEntries.timestamp))
            .limit(limit)
            .offset(offset)
        : db.select().from(auditEntries)
            .orderBy(desc(auditEntries.timestamp))
            .limit(limit)
            .offset(offset);

      const entries = await entriesQuery;
      const hasMore = offset + entries.length < total;

      return {
        entries,
        total,
        hasMore,
      };
    } catch (error) {
      console.error('Error getting audit entries:', error);
      return { entries: [], total: 0, hasMore: false };
    }
  }

  async getAuditEntry(id: string): Promise<AuditEntry | undefined> {
    try {
      const [entry] = await db.select().from(auditEntries).where(eq(auditEntries.id, id));
      return entry || undefined;
    } catch (error) {
      console.error('Error getting audit entry:', error);
      return undefined;
    }
  }

  async createAuditEntry(insertEntry: InsertAuditEntry): Promise<AuditEntry> {
    try {
      const [entry] = await db.insert(auditEntries).values(insertEntry).returning();
      return entry;
    } catch (error) {
      console.error('Error creating audit entry:', error);
      throw error;
    }
  }

  async updateAuditEntry(id: string, updates: Partial<AuditEntry>): Promise<AuditEntry | undefined> {
    try {
      const [updatedEntry] = await db.update(auditEntries)
        .set(updates)
        .where(eq(auditEntries.id, id))
        .returning();
      return updatedEntry || undefined;
    } catch (error) {
      console.error('Error updating audit entry:', error);
      return undefined;
    }
  }

  async deleteAuditEntry(id: string): Promise<boolean> {
    try {
      const result = await db.delete(auditEntries).where(eq(auditEntries.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting audit entry:', error);
      return false;
    }
  }

  async getAuditStats(period: string = '7days'): Promise<{
    totalScans: number;
    authorizedVehicles: number;
    unauthorizedVehicles: number;
    unknownCount: number;
    recentActivity: number;
    avgConfidence: number;
    topZones: Array<{ zone: string; count: number }>;
    dailyTrends: Array<{ date: string; scans: number; authorized: number; unauthorized: number }>;
    hourlyDistribution: Array<{ hour: number; scans: number }>;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate period start date based on selected period
      let periodStart = new Date();
      switch (period) {
        case '1day':
          periodStart.setDate(periodStart.getDate() - 1);
          break;
        case '7days':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case '30days':
          periodStart.setDate(periodStart.getDate() - 30);
          break;
        case '90days':
          periodStart.setDate(periodStart.getDate() - 90);
          break;
        default:
          periodStart.setDate(periodStart.getDate() - 7);
      }
      periodStart.setHours(0, 0, 0, 0);

      // Get total counts by status
      const [totalResult] = await db.select({ count: count() }).from(auditEntries);
      
      const [authorizedResult] = await db.select({ count: count() })
        .from(auditEntries)
        .where(eq(auditEntries.authorizationStatus, "authorized"));
      
      const [unauthorizedResult] = await db.select({ count: count() })
        .from(auditEntries)
        .where(eq(auditEntries.authorizationStatus, "unauthorized"));
      
      const [unknownResult] = await db.select({ count: count() })
        .from(auditEntries)
        .where(eq(auditEntries.authorizationStatus, "unknown"));
      
      const [todayResult] = await db.select({ count: count() })
        .from(auditEntries)
        .where(gte(auditEntries.timestamp, today));

      // Get average confidence
      const [avgConfidenceResult] = await db.select({ 
        avgConfidence: sql<number>`AVG(${auditEntries.ocrConfidence})` 
      }).from(auditEntries);

      // Get top parking zones
      const topZonesResult = await db.select({
        zone: auditEntries.parkingZone,
        count: count()
      })
        .from(auditEntries)
        .groupBy(auditEntries.parkingZone)
        .orderBy(sql`count DESC`)
        .limit(5);

      // Get daily trends for selected period
      const dailyTrendsRaw = await db.select({
        date: sql<string>`DATE(${auditEntries.timestamp})`,
        total: count(),
        authorized: sql<number>`SUM(CASE WHEN ${auditEntries.authorizationStatus} = 'authorized' THEN 1 ELSE 0 END)`,
        unauthorized: sql<number>`SUM(CASE WHEN ${auditEntries.authorizationStatus} = 'unauthorized' THEN 1 ELSE 0 END)`
      })
        .from(auditEntries)
        .where(gte(auditEntries.timestamp, periodStart))
        .groupBy(sql`DATE(${auditEntries.timestamp})`)
        .orderBy(sql`DATE(${auditEntries.timestamp})`);

      // Get hourly distribution
      const hourlyDistributionRaw = await db.select({
        hour: sql<number>`EXTRACT(HOUR FROM ${auditEntries.timestamp})`,
        count: count()
      })
        .from(auditEntries)
        .where(gte(auditEntries.timestamp, periodStart))
        .groupBy(sql`EXTRACT(HOUR FROM ${auditEntries.timestamp})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${auditEntries.timestamp})`);

      // Format daily trends
      const dailyTrends = dailyTrendsRaw.map(row => ({
        date: row.date,
        scans: Number(row.total),
        authorized: Number(row.authorized),
        unauthorized: Number(row.unauthorized)
      }));

      // Format hourly distribution
      const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
        const hourData = hourlyDistributionRaw.find(row => Number(row.hour) === hour);
        return {
          hour,
          scans: hourData ? Number(hourData.count) : 0
        };
      });

      return {
        totalScans: Number(totalResult.count),
        authorizedVehicles: Number(authorizedResult.count),
        unauthorizedVehicles: Number(unauthorizedResult.count),
        unknownCount: Number(unknownResult.count),
        recentActivity: Number(todayResult.count),
        avgConfidence: Number(avgConfidenceResult.avgConfidence) || 0,
        topZones: topZonesResult.map(row => ({
          zone: row.zone || 'Unknown Zone',
          count: Number(row.count)
        })),
        dailyTrends,
        hourlyDistribution
      };
    } catch (error) {
      console.error('Error getting audit stats:', error);
      return {
        totalScans: 0,
        authorizedVehicles: 0,
        unauthorizedVehicles: 0,
        unknownCount: 0,
        recentActivity: 0,
        avgConfidence: 0,
        topZones: [],
        dailyTrends: [],
        hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({ hour, scans: 0 }))
      };
    }
  }

  // Whitelist
  async getWhitelistPlates(): Promise<WhitelistPlate[]> {
    try {
      return await db.select().from(whitelistPlates)
        .orderBy(asc(whitelistPlates.plateNumber));
    } catch (error) {
      console.error('Error getting whitelist plates:', error);
      return [];
    }
  }

  async getWhitelistPlateByNumber(plateNumber: string): Promise<WhitelistPlate | undefined> {
    try {
      const [plate] = await db.select().from(whitelistPlates)
        .where(eq(whitelistPlates.plateNumber, plateNumber.toUpperCase()));
      return plate || undefined;
    } catch (error) {
      console.error('Error getting whitelist plate by number:', error);
      return undefined;
    }
  }

  async createWhitelistPlate(insertPlate: InsertWhitelistPlate): Promise<WhitelistPlate> {
    try {
      const plateData = {
        ...insertPlate,
        plateNumber: insertPlate.plateNumber.toUpperCase()
      };
      const [plate] = await db.insert(whitelistPlates).values(plateData).returning();
      return plate;
    } catch (error) {
      console.error('Error creating whitelist plate:', error);
      throw error;
    }
  }

  async deleteWhitelistPlate(id: string): Promise<boolean> {
    try {
      const result = await db.delete(whitelistPlates).where(eq(whitelistPlates.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting whitelist plate:', error);
      return false;
    }
  }

  // App Settings
  async getAppSettings(): Promise<Record<string, any>> {
    try {
      const settings = await db.select().from(appSettings);
      const result: Record<string, any> = {};
      for (const setting of settings) {
        try {
          result[setting.key] = JSON.parse(setting.value);
        } catch (parseError) {
          // Handle plain string values that weren't JSON encoded
          console.warn(`Setting ${setting.key} has non-JSON value, using as-is:`, setting.value);
          result[setting.key] = setting.value;
        }
      }
      return result;
    } catch (error) {
      console.error('Error getting app settings:', error);
      return {};
    }
  }

  async getAppSetting(key: string): Promise<any> {
    try {
      const [setting] = await db.select().from(appSettings)
        .where(eq(appSettings.key, key));
      if (!setting) return undefined;
      
      try {
        return JSON.parse(setting.value);
      } catch (parseError) {
        // Handle plain string values that weren't JSON encoded
        console.warn(`Setting ${key} has non-JSON value, using as-is:`, setting.value);
        return setting.value;
      }
    } catch (error) {
      console.error(`Error getting app setting ${key}:`, error);
      return undefined;
    }
  }

  async updateAppSetting(key: string, value: any): Promise<AppSetting> {
    try {
      // First try to update existing setting
      const [existingSetting] = await db.select().from(appSettings)
        .where(eq(appSettings.key, key));
      
      const stringValue = JSON.stringify(value);
      
      if (existingSetting) {
        // Update existing setting
        const [updated] = await db.update(appSettings)
          .set({ value: stringValue, updatedAt: new Date() })
          .where(eq(appSettings.id, existingSetting.id))
          .returning();
        return updated;
      } else {
        // Create new setting
        const [created] = await db.insert(appSettings)
          .values({ key, value: stringValue })
          .returning();
        return created;
      }
    } catch (error) {
      console.error(`Error updating app setting ${key}:`, error);
      throw error;
    }
  }

  // Google Sheets Sync
  async queueForGoogleSheetsSync(entryId: string): Promise<void> {
    this.googleSheetsSyncQueue.add(entryId);
  }

  async syncPendingToGoogleSheets(): Promise<{ synced: number; failed: number }> {
    const pendingIds = Array.from(this.googleSheetsSyncQueue);
    let synced = 0;
    let failed = 0;

    // Check if Google Sheets integration is enabled and configured
    const googleSheetsIntegration = await this.getAppSetting("googleSheetsIntegration");
    const googleSheetsId = await this.getAppSetting("googleSheetsId");
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!googleSheetsIntegration || !serviceAccountEmail || !serviceAccountPrivateKey || !googleSheetsId) {
      console.log("Google Sheets sync skipped: integration not enabled or service account credentials not configured");
      return { synced: 0, failed: pendingIds.length };
    }

    try {
      // Initialize Google Sheets service
      const googleSheetsService = new GoogleSheetsService({
        serviceAccountEmail,
        serviceAccountPrivateKey,
        spreadsheetId: googleSheetsId,
      });

      // Test connection and initialize spreadsheet
      const connectionTest = await googleSheetsService.testConnection();
      if (!connectionTest) {
        console.error("Google Sheets connection test failed");
        return { synced: 0, failed: pendingIds.length };
      }

      // Initialize spreadsheet with headers if needed
      await googleSheetsService.initializeSpreadsheet();

      // Collect all entries to sync
      const entriesToSync: AuditEntry[] = [];
      const validEntryIds: string[] = [];

      for (const entryId of pendingIds) {
        const entry = await this.getAuditEntry(entryId);
        if (!entry) {
          this.googleSheetsSyncQueue.delete(entryId);
          continue;
        }
        entriesToSync.push(entry);
        validEntryIds.push(entryId);
      }

      if (entriesToSync.length === 0) {
        console.log("No entries to sync to Google Sheets");
        return { synced: 0, failed: 0 };
      }

      try {
        // Sync all entries in batch
        await googleSheetsService.appendAuditEntries(entriesToSync);

        // Mark all entries as synced
        for (const entryId of validEntryIds) {
          await this.updateAuditEntry(entryId, {
            syncedToGoogleSheets: true,
            googleSheetsRowId: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          });
          this.googleSheetsSyncQueue.delete(entryId);
          synced++;
        }

        console.log(`Successfully synced ${synced} entries to Google Sheets`);
        
        // Only update last sync time on successful sync
        if (synced > 0) {
          await this.updateAppSetting("lastSyncTime", new Date().toISOString());
        }
      } catch (error) {
        console.error(`Failed to sync entries to Google Sheets:`, error);
        failed = entriesToSync.length;
      }
    } catch (error) {
      console.error("Google Sheets service initialization failed:", error);
      failed = pendingIds.length;
    }

    return { synced, failed };
  }

  async getSyncStatus(): Promise<{
    lastSyncTime?: Date;
    pendingCount: number;
    isOnline: boolean;
  }> {
    const lastSyncTimeStr = await this.getAppSetting("lastSyncTime");
    const lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr) : undefined;
    const pendingCount = this.googleSheetsSyncQueue.size;
    const isOnline = true; // In real implementation, would check network connectivity

    return {
      lastSyncTime,
      pendingCount,
      isOnline,
    };
  }
}

export const storage = new DatabaseStorage();
