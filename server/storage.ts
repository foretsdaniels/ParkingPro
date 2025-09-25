import { 
  type User, 
  type InsertUser, 
  type AuditEntry, 
  type InsertAuditEntry,
  type WhitelistPlate,
  type InsertWhitelistPlate,
  type AppSetting,
  type InsertAppSetting
} from "@shared/schema";
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private auditEntries: Map<string, AuditEntry>;
  private whitelistPlates: Map<string, WhitelistPlate>;
  private appSettings: Map<string, AppSetting>;
  private googleSheetsSyncQueue: Set<string>;

  constructor() {
    this.users = new Map();
    this.auditEntries = new Map();
    this.whitelistPlates = new Map();
    this.appSettings = new Map();
    this.googleSheetsSyncQueue = new Set();

    // Initialize default settings
    this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const defaultSettings = [
      { key: "ocrThreshold", value: 85 },
      { key: "autoFlash", value: true },
      { key: "saveFullImages", value: true },
      { key: "defaultParkingZone", value: "Front Lot - Section A" },
    ];

    for (const setting of defaultSettings) {
      if (!this.appSettings.has(setting.key)) {
        await this.updateAppSetting(setting.key, setting.value);
      }
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Audit Entries
  async getAuditEntries(options: { page?: number; limit?: number; search?: string }): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const { page = 1, limit = 20, search } = options;
    let entries = Array.from(this.auditEntries.values());

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter(entry => 
        entry.plateNumber.toLowerCase().includes(searchLower) ||
        entry.location?.toLowerCase().includes(searchLower) ||
        entry.parkingZone?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = entries.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = entries.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    return {
      entries: paginatedEntries,
      total,
      hasMore,
    };
  }

  async getAuditEntry(id: string): Promise<AuditEntry | undefined> {
    return this.auditEntries.get(id);
  }

  async createAuditEntry(insertEntry: InsertAuditEntry): Promise<AuditEntry> {
    const id = randomUUID();
    const entry: AuditEntry = {
      ...insertEntry,
      id,
      timestamp: new Date(),
      syncedToGoogleSheets: false,
      googleSheetsRowId: null,
      metadata: null,
      location: insertEntry.location || null,
      plateImagePath: insertEntry.plateImagePath || null,
      vehicleImagePath: insertEntry.vehicleImagePath || null,
      latitude: insertEntry.latitude || null,
      longitude: insertEntry.longitude || null,
      parkingZone: insertEntry.parkingZone || null,
      ocrConfidence: insertEntry.ocrConfidence || null,
      authorizationStatus: insertEntry.authorizationStatus || "unknown",
      notes: insertEntry.notes || null,
      userId: insertEntry.userId || null,
    };
    this.auditEntries.set(id, entry);
    return entry;
  }

  async updateAuditEntry(id: string, updates: Partial<AuditEntry>): Promise<AuditEntry | undefined> {
    const entry = this.auditEntries.get(id);
    if (!entry) return undefined;

    const updatedEntry = { ...entry, ...updates };
    this.auditEntries.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteAuditEntry(id: string): Promise<boolean> {
    return this.auditEntries.delete(id);
  }

  async getAuditStats(): Promise<{
    totalScans: number;
    authorizedCount: number;
    unauthorizedCount: number;
    unknownCount: number;
    todayScans: number;
  }> {
    const entries = Array.from(this.auditEntries.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalScans = entries.length;
    const authorizedCount = entries.filter(e => e.authorizationStatus === "authorized").length;
    const unauthorizedCount = entries.filter(e => e.authorizationStatus === "unauthorized").length;
    const unknownCount = entries.filter(e => e.authorizationStatus === "unknown").length;
    const todayScans = entries.filter(e => new Date(e.timestamp) >= today).length;

    return {
      totalScans,
      authorizedCount,
      unauthorizedCount,
      unknownCount,
      todayScans,
    };
  }

  // Whitelist
  async getWhitelistPlates(): Promise<WhitelistPlate[]> {
    return Array.from(this.whitelistPlates.values())
      .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber));
  }

  async getWhitelistPlateByNumber(plateNumber: string): Promise<WhitelistPlate | undefined> {
    return Array.from(this.whitelistPlates.values()).find(
      plate => plate.plateNumber.toLowerCase() === plateNumber.toLowerCase()
    );
  }

  async createWhitelistPlate(insertPlate: InsertWhitelistPlate): Promise<WhitelistPlate> {
    const id = randomUUID();
    const plate: WhitelistPlate = {
      plateNumber: insertPlate.plateNumber,
      description: insertPlate.description || null,
      addedBy: insertPlate.addedBy || null,
      id,
      createdAt: new Date(),
    };
    this.whitelistPlates.set(id, plate);
    return plate;
  }

  async deleteWhitelistPlate(id: string): Promise<boolean> {
    return this.whitelistPlates.delete(id);
  }

  // App Settings
  async getAppSettings(): Promise<Record<string, any>> {
    const settings: Record<string, any> = {};
    for (const setting of Array.from(this.appSettings.values())) {
      settings[setting.key] = setting.value;
    }
    return settings;
  }

  async getAppSetting(key: string): Promise<any> {
    const setting = this.appSettings.get(key);
    return setting?.value;
  }

  async updateAppSetting(key: string, value: any): Promise<AppSetting> {
    const id = randomUUID();
    const setting: AppSetting = {
      id,
      key,
      value,
      updatedAt: new Date(),
    };
    this.appSettings.set(key, setting);
    return setting;
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
      const entry = this.auditEntries.get(entryId);
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

export const storage = new MemStorage();
