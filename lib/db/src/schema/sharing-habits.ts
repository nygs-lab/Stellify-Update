import { pgTable, serial, text, boolean, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Level 1: Preparation
export const sharingPreparationsTable = pgTable("sharing_preparations", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  lessonReviewed: boolean("lesson_reviewed").notNull().default(false),
  scriptPrepared: boolean("script_prepared").notNull().default(false),
  prayedForTarget: boolean("prayed_for_target").notNull().default(false),
  confidenceStatus: boolean("confidence_status").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Level 2: Sharing attempts
export const sharingAttemptsTable = pgTable("sharing_attempts", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  attemptDate: date("attempt_date", { mode: "string" }).notNull(),
  targetName: text("target_name").notNull(),
  sharingMethod: text("sharing_method"), // LendPhysicalBook | LendWebBookPassword
  expectedResponseDate: date("expected_response_date", { mode: "string" }),
  followUpDate: date("follow_up_date", { mode: "string" }),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Level 3: Bearing results (conversions)
export const bearingResultsTable = pgTable("bearing_results", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  bearingDate: date("bearing_date", { mode: "string" }).notNull(),
  believerName: text("believer_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSharingPreparationSchema = createInsertSchema(sharingPreparationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSharingPreparation = z.infer<typeof insertSharingPreparationSchema>;

export const insertSharingAttemptSchema = createInsertSchema(sharingAttemptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSharingAttempt = z.infer<typeof insertSharingAttemptSchema>;

export const insertBearingResultSchema = createInsertSchema(bearingResultsTable).omit({ id: true, createdAt: true });
export type InsertBearingResult = z.infer<typeof insertBearingResultSchema>;
