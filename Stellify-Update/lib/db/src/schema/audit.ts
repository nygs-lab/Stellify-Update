import { pgTable, serial, integer, text, timestamp, date } from "drizzle-orm/pg-core";

export const cgAuditSummariesTable = pgTable("cg_audit_summaries", {
  id: serial("id").primaryKey(),
  cgNumber: text("cg_number").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  observations: text("observations"),
  submittedById: integer("submitted_by_id").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
});

export const churchAuditSummariesTable = pgTable("church_audit_summaries", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  observations: text("observations"),
  totalCgsReported: integer("total_cgs_reported"),
  submittedById: integer("submitted_by_id").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberRemindersTable = pgTable("member_reminders", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  sentById: integer("sent_by_id").notNull(),
  message: text("message"),
  weekStart: date("week_start", { mode: "string" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
