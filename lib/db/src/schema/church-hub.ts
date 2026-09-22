import { pgTable, serial, text, boolean, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Biblical message recordings
export const sermonsTable = pgTable("sermons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  speaker: text("speaker").notNull(),
  publishDate: date("publish_date", { mode: "string" }).notNull(),
  shortDescription: text("short_description"),
  driveLink: text("drive_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Church events
export const churchEventsTable = pgTable("church_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  eventDate: text("event_date").notNull(), // ISO datetime string
  location: text("location"),
  meetLink: text("meet_link"),
  description: text("description"),
  eventType: text("event_type").notNull(), // SundayWorship | OnsiteWorship | OnlineWorship | SpecialEvent | InMemoryOfTheLord | SharingEvent | CareEvent | WorshipServiceEvent
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Church guides and feeds
export const guidesTable = pgTable("guides", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  driveLink: text("drive_link"),
  guideType: text("guide_type").notNull(), // ApplicationUserGuide | MinistryGuide | MinisterGuide
  targetLevel: text("target_level").notNull(), // ChurchLevel | CaregroupLevel | SharingHuddleLevel | AuditorLevel | AdminLevel | PastorLevel
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Prayer requests
export const prayerRequestsTable = pgTable("prayer_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  description: text("description").notNull(),
  visibility: text("visibility").notNull(), // Church | PastorOnly | ServantOnly | CaptainOnly
  isDone: boolean("is_done").notNull().default(false),
  doneById: integer("done_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Counseling requests
export const counselingRequestsTable = pgTable("counseling_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  reason: text("reason").notNull(),
  preferredDate: date("preferred_date", { mode: "string" }).notNull(),
  connectType: text("connect_type").notNull(), // GoogleMeet | FacebookMessenger | MobilePhoneCall | FaceToFace
  counselorTarget: text("counselor_target").notNull(), // Pastor | Servant | Captain
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Brethren Watch
export const brethrenWatchTable = pgTable("brethren_watch", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  reportedMemberId: integer("reported_member_id").notNull(),
  leaderRoute: text("leader_route").notNull(), // Pastor | Servant | Captain | FamilyLeader
  incidentDescription: text("incident_description").notNull(),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Feedback
export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  categoryTitle: text("category_title").notNull(),
  description: text("description").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  status: text("status").notNull().default("Pending"), // Pending | TakenIntoAdvisement
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Notifications
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Church expenses (treasury)
export const churchExpensesTable = pgTable("church_expenses", {
  id: serial("id").primaryKey(),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(), // stored as string for precision
  notes: text("notes"),
  recordedById: integer("recorded_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSermonSchema = createInsertSchema(sermonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSermon = z.infer<typeof insertSermonSchema>;
export type Sermon = typeof sermonsTable.$inferSelect;

export const insertPrayerRequestSchema = createInsertSchema(prayerRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrayerRequest = z.infer<typeof insertPrayerRequestSchema>;
