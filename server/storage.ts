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

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Audit Entries
  getAuditEntries(options: { page?: number; limit?: number; search?: string }): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }>;
  getAuditEntry(id: string): Promise<AuditEntry | undefined>;
  createAuditEntry(entry: InsertAuditEntry): Promise<AuditEntry>;
  updateAuditEntry(id: string, updates: Partial<AuditEntry>): Promise<AuditEntry | undefined>;
  deleteAuditEntry(id: string): Promise<boolean>;
  getAuditStats(): Promise<{
    totalScans: number;
    authorizedCount: number;
    unauthorizedCount: number;
    unknownCount: number;
    todayScans: number;
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
  async getAuditEntries(options: { page?: number; limit?: number; search?: string }): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { page = 1, limit = 20, search } = options;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      if (search) {
        const searchLower = `%${search.toLowerCase()}%`;
        whereConditions = [
          like(auditEntries.plateNumber, searchLower),
          like(auditEntries.location, searchLower),
          like(auditEntries.parkingZone, searchLower)
        ];
      }

      // Get total count
      const totalQuery = whereConditions.length > 0 
        ? db.select({ count: count() }).from(auditEntries)
            .where(sql`${auditEntries.plateNumber} ILIKE ${`%${search}%`} OR ${auditEntries.location} ILIKE ${`%${search}%`} OR ${auditEntries.parkingZone} ILIKE ${`%${search}%`}`)
        : db.select({ count: count() }).from(auditEntries);
      
      const [{ count: total }] = await totalQuery;

      // Get paginated entries
      const entriesQuery = whereConditions.length > 0
        ? db.select().from(auditEntries)
            .where(sql`${auditEntries.plateNumber} ILIKE ${`%${search}%`} OR ${auditEntries.location} ILIKE ${`%${search}%`} OR ${auditEntries.parkingZone} ILIKE ${`%${search}%`}`)
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

  async getAuditStats(): Promise<{
    totalScans: number;
    authorizedCount: number;
    unauthorizedCount: number;
    unknownCount: number;
    todayScans: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

      return {
        totalScans: totalResult.count,
        authorizedCount: authorizedResult.count,
        unauthorizedCount: unauthorizedResult.count,
        unknownCount: unknownResult.count,
        todayScans: todayResult.count,
      };
    } catch (error) {
      console.error('Error getting audit stats:', error);
      return {
        totalScans: 0,
        authorizedCount: 0,
        unauthorizedCount: 0,
        unknownCount: 0,
        todayScans: 0,
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
      console.log(`[DEBUG] Retrieved ${settings.length} settings from DB`);
      const result: Record<string, any> = {};
      for (const setting of settings) {
        try {
          result[setting.key] = JSON.parse(setting.value);
          console.log(`[DEBUG] Setting ${setting.key}: ${setting.value} -> parsed:`, result[setting.key]);
        } catch (parseError) {
          // Handle plain string values that weren't JSON encoded
          console.warn(`Setting ${setting.key} has non-JSON value, using as-is:`, setting.value);
          result[setting.key] = setting.value;
        }
      }
      console.log(`[DEBUG] Final settings object:`, result);
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
      console.log(`[DEBUG] Updating setting ${key} with value:`, value, `(type: ${typeof value})`);
      
      // First try to update existing setting
      const [existingSetting] = await db.select().from(appSettings)
        .where(eq(appSettings.key, key));
      
      const stringValue = JSON.stringify(value);
      console.log(`[DEBUG] JSON stringified value:`, stringValue);
      
      if (existingSetting) {
        console.log(`[DEBUG] Updating existing setting ${key}, old value: ${existingSetting.value}`);
        // Update existing setting
        const [updated] = await db.update(appSettings)
          .set({ value: stringValue, updatedAt: new Date() })
          .where(eq(appSettings.id, existingSetting.id))
          .returning();
        console.log(`[DEBUG] Updated setting ${key}, new value in DB:`, updated.value);
        return updated;
      } else {
        console.log(`[DEBUG] Creating new setting ${key}`);
        // Create new setting
        const [created] = await db.insert(appSettings)
          .values({ key, value: stringValue })
          .returning();
        console.log(`[DEBUG] Created new setting ${key}, value in DB:`, created.value);
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

    for (const entryId of pendingIds) {
      const entry = await this.getAuditEntry(entryId);
      if (!entry) {
        this.googleSheetsSyncQueue.delete(entryId);
        continue;
      }

      try {
        // Mock Google Sheets sync - in real implementation, would use Google Sheets API
        const googleSheetsAPI = process.env.GOOGLE_SHEETS_API_KEY;
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        
        if (googleSheetsAPI && spreadsheetId) {
          // Real implementation would make API call here
          console.log(`Syncing entry ${entryId} to Google Sheets...`);
          
          // Update entry as synced
          await this.updateAuditEntry(entryId, {
            syncedToGoogleSheets: true,
            googleSheetsRowId: `row_${Date.now()}`,
          });

          this.googleSheetsSyncQueue.delete(entryId);
          synced++;
        } else {
          console.warn("Google Sheets credentials not configured");
          failed++;
        }
      } catch (error) {
        console.error(`Failed to sync entry ${entryId}:`, error);
        failed++;
      }
    }

    // Update last sync time
    await this.updateAppSetting("lastSyncTime", new Date().toISOString());

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
