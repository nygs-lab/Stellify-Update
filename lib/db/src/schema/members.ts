import { pgTable, serial, text, boolean, timestamp, date, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  churchId: text("church_id").notNull().unique(),
  accountType: text("account_type").notNull().default("PCM"), // PCM | TCM
  status: text("status").notNull().default("Active"), // Active | Deactivated | Retired | Deleted
  role: text("role").notNull().default("Member"), // Admin | Pastor | Servant | SharingCaptain | CgAuditor | ChurchAuditor | Member
  passwordHash: text("password_hash").notNull(),

  // Personal details
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  nickname: text("nickname"),
  gender: text("gender"), // Male | Female
  birthday: date("birthday", { mode: "string" }),
  civilStatus: text("civil_status"),
  weddingAnniversary: date("wedding_anniversary", { mode: "string" }),

  // Contact
  email: text("email"),
  contactNumber: text("contact_number"),
  profilePicture: text("profile_picture"),

  // Health
  foodPreferences: text("food_preferences"),
  medicalCondition: text("medical_condition"),
  medication: text("medication"),
  bloodType: text("blood_type"),
  height: text("height"),
  weight: text("weight"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactRelationship: text("emergency_contact_relationship"),
  emergencyContactNumber: text("emergency_contact_number"),

  // Church groupings
  familyGroupNumber: text("family_group_number"),
  familyRole: text("family_role"), // FamilyMember | FamilyLeader
  cgNumber: text("cg_number"),
  cgRole: text("cg_role"), // CGMember | CGServant
  sharingHuddleNumber: text("sharing_huddle_number"),
  sharingHuddleRole: text("sharing_huddle_role"), // SharingHuddleMember | SharingHuddleCaptain

  // Milestones
  salvationDate: date("salvation_date", { mode: "string" }),
  baptismDate: date("baptism_date", { mode: "string" }),
  sharingPermissionDate: date("sharing_permission_date", { mode: "string" }),
  bearingDate: date("bearing_date", { mode: "string" }),
  dedicationDate: date("dedication_date", { mode: "string" }),
  ministryRoles: jsonb("ministry_roles").$type<string[]>(),
  roleGroupMappings: jsonb("role_group_mappings").$type<Record<string, string>>(),

  // Stellar / Discipleship
  discipleshipEnabled: boolean("discipleship_enabled").notNull().default(true),
  sbgEndDate: date("sbg_end_date", { mode: "string" }),
  stellarStatus: text("stellar_status").notNull().default("SBG"), // SBG | P2S | S2B | P2G
  pendingStellarStatus: text("pending_stellar_status"), // status awaiting pastor approval
  stellarStatusApprovedByPastor: boolean("stellar_status_approved_by_pastor").notNull().default(false),
  stellarFragments: integer("stellar_fragments").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),

  // Timezone
  timezone: text("timezone"), // IANA timezone string e.g. "Asia/Manila"

  // Push notifications
  expoPushToken: text("expo_push_token"),

  // Account flags
  isTestingAccount: boolean("is_testing_account").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(true),

  // Social media (stored as JSON string)
  socialMediaLinks: text("social_media_links"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
