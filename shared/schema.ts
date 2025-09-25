import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const auditEntries = pgTable("audit_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plateNumber: text("plate_number").notNull(),
  plateImagePath: text("plate_image_path"),
  vehicleImagePath: text("vehicle_image_path"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  location: text("location"),
  parkingZone: text("parking_zone"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 2 }),
  authorizationStatus: text("authorization_status").notNull().default("unknown"), // "authorized", "unauthorized", "unknown"
  notes: text("notes"),
  userId: varchar("user_id"),
  syncedToGoogleSheets: boolean("synced_to_google_sheets").default(false),
  googleSheetsRowId: text("google_sheets_row_id"),
  metadata: jsonb("metadata"),
});

export const whitelistPlates = pgTable("whitelist_plates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plateNumber: text("plate_number").notNull().unique(),
  description: text("description"),
  addedBy: varchar("added_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAuditEntrySchema = createInsertSchema(auditEntries).omit({
  id: true,
  timestamp: true,
  syncedToGoogleSheets: true,
  googleSheetsRowId: true,
});

export const insertWhitelistPlateSchema = createInsertSchema(whitelistPlates).omit({
  id: true,
  createdAt: true,
});

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAuditEntry = z.infer<typeof insertAuditEntrySchema>;
export type AuditEntry = typeof auditEntries.$inferSelect;

export type InsertWhitelistPlate = z.infer<typeof insertWhitelistPlateSchema>;
export type WhitelistPlate = typeof whitelistPlates.$inferSelect;

export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;
