import { pgTable, serial, text, boolean, integer, real, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Member's selected personal habit cards
export const personalHabitsTable = pgTable("personal_habits", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  habitCode: text("habit_code").notNull(), // PHC001-PHC014 or CUSTOM-XXXX
  habitName: text("habit_name").notNull(),
  aspect: text("aspect").notNull(), // Physical | Mental | Financial | SelfControl
  frequency: text("frequency").notNull(), // Daily | Weekly | Monthly | Custom
  description: text("description"),
  isCustom: boolean("is_custom").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  // Bound-type metadata for the habit card tracking grid
  boundType: text("bound_type"), // time | calorie | volume | count | negative | bp | weight | custom
  targetValue: real("target_value"),  // numeric target (e.g. 7 for 7h, 2 for 2L)
  targetUnit: text("target_unit"),    // "hours" | "liters" | "calories" | "count" | "minutes" | "kg"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Personal habit log entries
export const personalHabitLogsTable = pgTable("personal_habit_logs", {
  id: serial("id").primaryKey(),
  personalHabitId: integer("personal_habit_id").notNull(),
  memberId: integer("member_id").notNull(),
  logDate: date("log_date", { mode: "string" }).notNull(),
  completed: boolean("completed").notNull().default(false),
  compliant: boolean("compliant").notNull().default(false),
  committed: boolean("committed").notNull().default(false),
  durationMinutes: integer("duration_minutes"),
  metricValue: real("metric_value"), // generic numeric (weight kg, systolic mmHg, etc.)
  notes: text("notes"),
  stellarFragmentsEarned: integer("stellar_fragments_earned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonalHabitSchema = createInsertSchema(personalHabitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPersonalHabit = z.infer<typeof insertPersonalHabitSchema>;
export type PersonalHabit = typeof personalHabitsTable.$inferSelect;
