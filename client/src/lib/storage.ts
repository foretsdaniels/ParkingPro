// Local storage utilities for offline functionality

export interface OfflineAuditEntry {
  plateNumber: string;
  latitude?: string;
  longitude?: string;
  location?: string;
  parkingZone: string;
  ocrConfidence: number;
  authorizationStatus: string;
  notes?: string;
  timestamp: string;
  plateImage?: string;
  vehicleImage?: string;
  offlineEntry: boolean;
}

export class LocalStorageService {
  private static readonly PENDING_ENTRIES_KEY = 'pendingAuditEntries';
  private static readonly CURRENT_CAPTURE_KEY = 'currentCapture';
  private static readonly APP_SETTINGS_KEY = 'appSettings';

  // Pending audit entries for offline sync
  static getPendingEntries(): OfflineAuditEntry[] {
    try {
      const stored = localStorage.getItem(this.PENDING_ENTRIES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse pending entries:', error);
      return [];
    }
  }

  static addPendingEntry(entry: OfflineAuditEntry): void {
    try {
      const entries = this.getPendingEntries();
      entries.push(entry);
      localStorage.setItem(this.PENDING_ENTRIES_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save pending entry:', error);
    }
  }

  static removePendingEntry(index: number): void {
    try {
      const entries = this.getPendingEntries();
      entries.splice(index, 1);
      localStorage.setItem(this.PENDING_ENTRIES_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to remove pending entry:', error);
    }
  }

  static clearPendingEntries(): void {
    localStorage.removeItem(this.PENDING_ENTRIES_KEY);
  }

  // Current capture data
  static getCurrentCapture(): any {
    try {
      const stored = localStorage.getItem(this.CURRENT_CAPTURE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to parse current capture:', error);
      return null;
    }
  }

  static setCurrentCapture(data: any): void {
    try {
      localStorage.setItem(this.CURRENT_CAPTURE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save current capture:', error);
    }
  }

  static clearCurrentCapture(): void {
    localStorage.removeItem(this.CURRENT_CAPTURE_KEY);
  }

  // App settings
  static getAppSettings(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.APP_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : {
        ocrThreshold: 85,
        autoFlash: true,
        saveFullImages: true,
        defaultParkingZone: 'Front Lot - Section A'
      };
    } catch (error) {
      console.error('Failed to parse app settings:', error);
      return {};
    }
  }

  static updateAppSetting(key: string, value: any): void {
    try {
      const settings = this.getAppSettings();
      settings[key] = value;
      localStorage.setItem(this.APP_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to update app setting:', error);
    }
  }

  // Storage size calculation
  static getStorageSize(): { used: number; total: number } {
    let used = 0;
    
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
    }

    return {
      used: Math.round(used / 1024), // KB
      total: 5120 // Approximate 5MB limit for localStorage
    };
  }

  // Clear all app data
  static clearAllData(): void {
    const keysToRemove = [
      this.PENDING_ENTRIES_KEY,
      this.CURRENT_CAPTURE_KEY,
      this.APP_SETTINGS_KEY
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  }
}
