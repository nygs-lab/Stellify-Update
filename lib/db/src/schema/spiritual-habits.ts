import { pgTable, serial, text, boolean, integer, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Weekly prayer/devotion logs (SHC001, SHC002)
export const spiritualHabitLogsTable = pgTable("spiritual_habit_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  habitCode: text("habit_code").notNull(), // SHC001 | SHC002
  weekStart: date("week_start", { mode: "string" }).notNull(), // Sunday YYYY-MM-DD
  // days stored as JSON: [{dayOfWeek, completed, compliant, committed, durationMinutes, devotionType, devotionDetails}]
  daysJson: text("days_json").notNull().default("[]"),
  totalDuration: integer("total_duration"),
  targetDuration: integer("target_duration"),
  isLocked: boolean("is_locked").notNull().default(false),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Worship attendance (SHC004)
export const worshipAttendanceLogsTable = pgTable("worship_attendance_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  attendanceDate: date("attendance_date", { mode: "string" }).notNull(), // Sunday date
  attended: boolean("attended"),
  attendanceType: text("attendance_type"), // Online | Onsite
  absenceReason: text("absence_reason"), // Medical | Academic | Invalid
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Biblical message notes (SHC005)
export const biblicalNotesLogsTable = pgTable("biblical_notes_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  noteDate: date("note_date", { mode: "string" }).notNull(),
  noteType: text("note_type"), // Digital | HandWritten
  bsfWholeContext: text("bsf_whole_context"),
  bsfSource: text("bsf_source"),
  bsfReceiver: text("bsf_receiver"),
  bsfRelation: text("bsf_relation"),
  bsfSpecificTopic: text("bsf_specific_topic"),
  bsfOutline: text("bsf_outline"),
  bsfApplication: text("bsf_application"),
  notes: text("notes"),
  bupSelection: text("bup_selection"), // BUP1-BUP6
  isDone: boolean("is_done").notNull().default(false),
  handwrittenImageUrl: text("handwritten_image_url"),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  verificationStatus: text("verification_status"), // Pending | Verified | Flagged
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// CG Attendance (SHC006)
export const cgAttendanceLogsTable = pgTable("cg_attendance_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  attendanceDate: date("attendance_date", { mode: "string" }).notNull(),
  attended: boolean("attended"),
  absenceReason: text("absence_reason"),
  weeklyQuestion: text("weekly_question"),
  weeklyAnswer: text("weekly_answer"),
  leaderVerified: boolean("leader_verified"),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Sharing Huddle (SHC007)
export const sharingHuddleLogsTable = pgTable("sharing_huddle_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  huddleDate: date("huddle_date", { mode: "string" }).notNull(),
  attended: boolean("attended"),
  absenceReason: text("absence_reason"),
  monthlyQuestion: text("monthly_question"),
  monthlyAnswer: text("monthly_answer"),
  captainVerified: boolean("captain_verified"),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// GOT Logs (SHC003) - Gift Offering Tithes
export const gotLogsTable = pgTable("got_logs", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  giftAmount: numeric("gift_amount", { precision: 12, scale: 2 }),
  offeringAmount: numeric("offering_amount", { precision: 12, scale: 2 }),
  tithesAmount: numeric("tithes_amount", { precision: 12, scale: 2 }),
  bobDeduction: numeric("bob_deduction", { precision: 12, scale: 2 }),
  bobReason: text("bob_reason"),
  totalSubmission: numeric("total_submission", { precision: 12, scale: 2 }),
  submissionMethod: text("submission_method"), // eWallet | BankTransfer
  screenshotLink: text("screenshot_link"),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationStatus: text("verification_status"), // Pending | Verified | Flagged
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSpiritualHabitLogSchema = createInsertSchema(spiritualHabitLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSpiritualHabitLog = z.infer<typeof insertSpiritualHabitLogSchema>;
export type SpiritualHabitLog = typeof spiritualHabitLogsTable.$inferSelect;

export const weekUnlocksTable = pgTable("week_unlocks", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  unlockedById: integer("unlocked_by_id").notNull(),
});
