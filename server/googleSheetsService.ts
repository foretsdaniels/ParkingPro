import { google, sheets_v4 } from 'googleapis';
import type { AuditEntry } from '@shared/schema';

export interface GoogleSheetsConfig {
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  spreadsheetId?: string;
}

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(config: GoogleSheetsConfig) {
    if (!config.serviceAccountEmail || !config.serviceAccountPrivateKey) {
      throw new Error('Google service account credentials are required');
    }
    if (!config.spreadsheetId) {
      throw new Error('Google Sheets spreadsheet ID is required');
    }

    // Decode and format the private key
    let privateKey: string;
    try {
      // Try to decode as base64 first (common format)
      if (config.serviceAccountPrivateKey.includes('-----BEGIN')) {
        // Already in PEM format, just handle escaped newlines
        privateKey = config.serviceAccountPrivateKey.replace(/\\n/g, '\n');
      } else {
        // Assume base64 encoded, decode it
        privateKey = Buffer.from(config.serviceAccountPrivateKey, 'base64').toString('utf-8');
      }
    } catch (error) {
      throw new Error('Invalid service account private key format');
    }

    // Initialize Google Sheets API with service account authentication
    const auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Required scope for read/write access
    });

    this.sheets = google.sheets({
      version: 'v4',
      auth: auth,
    });
    this.spreadsheetId = config.spreadsheetId;
  }

  /**
   * Initialize the spreadsheet with headers if it doesn't exist
   */
  async initializeSpreadsheet(): Promise<void> {
    try {
      // Check if the spreadsheet exists and has headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:K1', // Header row
      });

      const headers = [
        'Timestamp',
        'License Plate',
        'Authorization Status',
        'Confidence Score',
        'GPS Coordinates',
        'Location Description',
        'Notes',
        'Plate Image URL',
        'Vehicle Image URL',
        'Created At',
        'Synced At'
      ];

      // If no data or headers don't match, initialize with headers
      if (!response.data.values || response.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:K1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });
        console.log('Google Sheets: Initialized spreadsheet with headers');
      }
    } catch (error) {
      console.error('Google Sheets: Failed to initialize spreadsheet:', error);
      throw new Error(`Failed to initialize Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Append audit entries to the spreadsheet
   */
  async appendAuditEntries(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      // Convert audit entries to spreadsheet rows
      const rows = entries.map(entry => [
        entry.timestamp.toISOString(),
        entry.plateNumber,
        entry.authorizationStatus,
        entry.ocrConfidence?.toString() || '',
        entry.latitude && entry.longitude ? `${entry.latitude}, ${entry.longitude}` : '',
        entry.location || '',
        entry.notes || '',
        entry.plateImagePath || '',
        entry.vehicleImagePath || '',
        entry.timestamp.toISOString(),
        new Date().toISOString() // Synced at timestamp
      ]);

      // Append the rows to the spreadsheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:K', // Append to columns A through K
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows,
        },
      });

      console.log(`Google Sheets: Successfully synced ${entries.length} audit entries`);
    } catch (error) {
      console.error('Google Sheets: Failed to append entries:', error);
      throw new Error(`Failed to sync to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test the connection to Google Sheets
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      return true;
    } catch (error) {
      console.error('Google Sheets: Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get spreadsheet information
   */
  async getSpreadsheetInfo(): Promise<{ title: string; url: string }> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return {
        title: response.data.properties?.title || 'Unknown',
        url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`,
      };
    } catch (error) {
      console.error('Google Sheets: Failed to get spreadsheet info:', error);
      throw error;
    }
  }
}