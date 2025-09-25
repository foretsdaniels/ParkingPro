import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertAuditEntrySchema, insertWhitelistPlateSchema, insertAppSettingSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Object storage endpoints
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Audit entries endpoints
  app.get("/api/audit-entries", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const entries = await storage.getAuditEntries({ page, limit, search });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching audit entries:", error);
      res.status(500).json({ error: "Failed to fetch audit entries" });
    }
  });

  app.post("/api/audit-entries", async (req, res) => {
    try {
      const validatedData = insertAuditEntrySchema.parse(req.body);
      
      // Check if plate is in whitelist
      const whitelistEntry = await storage.getWhitelistPlateByNumber(validatedData.plateNumber);
      if (whitelistEntry) {
        validatedData.authorizationStatus = "authorized";
      }
      
      const entry = await storage.createAuditEntry(validatedData);
      
      // Queue for Google Sheets sync
      await storage.queueForGoogleSheetsSync(entry.id);
      
      res.json(entry);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating audit entry:", error);
      res.status(500).json({ error: "Failed to create audit entry" });
    }
  });

  app.put("/api/audit-entries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const entry = await storage.updateAuditEntry(id, updates);
      if (!entry) {
        return res.status(404).json({ error: "Audit entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating audit entry:", error);
      res.status(500).json({ error: "Failed to update audit entry" });
    }
  });

  app.put("/api/audit-entries/:id/images", async (req, res) => {
    try {
      const { id } = req.params;
      const { plateImageURL, vehicleImageURL } = req.body;

      if (!plateImageURL && !vehicleImageURL) {
        return res.status(400).json({ error: "At least one image URL is required" });
      }

      const updates: any = {};
      
      if (plateImageURL) {
        updates.plateImagePath = objectStorageService.normalizeObjectEntityPath(plateImageURL);
      }
      
      if (vehicleImageURL) {
        updates.vehicleImagePath = objectStorageService.normalizeObjectEntityPath(vehicleImageURL);
      }

      const entry = await storage.updateAuditEntry(id, updates);
      if (!entry) {
        return res.status(404).json({ error: "Audit entry not found" });
      }

      res.json({ 
        success: true, 
        plateImagePath: updates.plateImagePath,
        vehicleImagePath: updates.vehicleImagePath
      });
    } catch (error) {
      console.error("Error updating audit entry images:", error);
      res.status(500).json({ error: "Failed to update images" });
    }
  });

  // Whitelist endpoints
  app.get("/api/whitelist", async (req, res) => {
    try {
      const plates = await storage.getWhitelistPlates();
      res.json(plates);
    } catch (error) {
      console.error("Error fetching whitelist:", error);
      res.status(500).json({ error: "Failed to fetch whitelist" });
    }
  });

  app.post("/api/whitelist", async (req, res) => {
    try {
      const validatedData = insertWhitelistPlateSchema.parse(req.body);
      const plate = await storage.createWhitelistPlate(validatedData);
      res.json(plate);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating whitelist entry:", error);
      res.status(500).json({ error: "Failed to create whitelist entry" });
    }
  });

  app.delete("/api/whitelist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteWhitelistPlate(id);
      if (!success) {
        return res.status(404).json({ error: "Whitelist entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting whitelist entry:", error);
      res.status(500).json({ error: "Failed to delete whitelist entry" });
    }
  });

  // Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validatedData = insertAppSettingSchema.parse(req.body);
      const setting = await storage.updateAppSetting(validatedData.key, validatedData.value);
      res.json(setting);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Google Sheets sync endpoints
  app.post("/api/sync/google-sheets", async (req, res) => {
    try {
      const result = await storage.syncPendingToGoogleSheets();
      res.json(result);
    } catch (error) {
      console.error("Error syncing to Google Sheets:", error);
      res.status(500).json({ error: "Failed to sync to Google Sheets" });
    }
  });

  app.get("/api/sync/status", async (req, res) => {
    try {
      const status = await storage.getSyncStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // Statistics endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getAuditStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
