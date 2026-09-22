import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stellarStatusApprovalsTable = pgTable("stellar_status_approvals", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  requestedStatus: text("requested_status").notNull(), // SBG | P2S | S2B | P2G
  requestedById: integer("requested_by_id").notNull(), // Admin who requested
  approvedById: integer("approved_by_id"), // Pastor who approved/rejected
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStellarStatusApprovalSchema = createInsertSchema(stellarStatusApprovalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStellarStatusApproval = z.infer<typeof insertStellarStatusApprovalSchema>;
export type StellarStatusApproval = typeof stellarStatusApprovalsTable.$inferSelect;
