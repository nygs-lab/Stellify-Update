import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Key-value store for server-side configuration that must survive restarts.
 * Currently used only for tracking the year of the last annual fragment reset.
 */
export const systemConfigTable = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SystemConfig = typeof systemConfigTable.$inferSelect;
