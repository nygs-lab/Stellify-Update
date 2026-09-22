import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Care Groups, Sharing Huddles, and Family Groups managed by Admin.
export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // CareGroup | SharingHuddle | FamilyGroup
  number: text("number").notNull(),
  name: text("name"),
  leaderId: integer("leader_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groupsTable.$inferSelect;
