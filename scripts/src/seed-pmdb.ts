import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { db, membersTable, groupsTable, type InsertMember } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PmdbMember {
  churchId: string;
  discipleship: "Enabled" | "Disabled";
  lastName: string;
  firstName: string;
  middleName: string | null;
  gender: string | null;
  salvationDate: string | null;
  baptismDate: string | null;
  sharingPermissionDate: string | null;
  bearingDate: string | null;
  dedicationDate: string | null;
  familyRole: string | null;
  familyGroupNumber: string | null;
  careGroupNumber: string | null;
  careGroupRole: string | null;
  sharingHuddleNumber: string | null;
  sharingHuddleRole: string | null;
  birthday: string | null;
  email: string | null;
  contactNumber: string | null;
  foodPreference: string | null;
  civilStatus: string | null;
  weddingAnniversary: string | null;
  medicalCondition: string | null;
  medication: string | null;
  emergencyContact: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactNumber: string | null;
  ministryDesignation: string | null;
  sbgStatus: string | null;
  p2sStatus: string | null;
  s2bStatus: string | null;
  p2gStatus: string | null;
  role: string;
}

interface PmdbData {
  members: PmdbMember[];
  careGroups: string[];
  sharingHuddles: string[];
  familyGroups: string[];
}

const ADMIN_PASSWORD = "admin123";
const DEFAULT_PASSWORD = "press2026";

/**
 * SBG end date granted to every member with discipleship enabled.
 * All active disciples are set to the current programme cycle end.
 */
const SBG_END_DATE = "2029-12-31";

/**
 * Derive stellar status from PMDB status flags.
 * Priority: P2G > S2B > P2S > SBG (default).
 */
function deriveStellarStatus(m: PmdbMember): string {
  if (m.p2gStatus === "Yes") return "P2G";
  if (m.s2bStatus === "Yes") return "S2B";
  if (m.p2sStatus === "Yes") return "P2S";
  return "SBG";
}

/**
 * Returns true if the value looks like a phone number:
 * starts with "+" or consists entirely of digits, spaces, dashes, and parentheses
 * (with at least one digit present).
 */
function looksLikePhone(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("+")) return true;
  const stripped = value.replace(/[\s\-()]/g, "");
  return stripped.length > 0 && /^\d+$/.test(stripped);
}

/**
 * Returns true if the value looks like a plain word (no digits at all).
 * Used to flag relationship words stored in the phone-number field.
 */
function looksLikeWord(value: string): boolean {
  if (!value) return false;
  return /^[A-Za-z\s\-']+$/.test(value.trim());
}

/**
 * Scan all members for obviously wrong emergency contact field values and
 * print warnings to stdout.  Does NOT fail — warnings are informational only.
 */
function validateContactFields(members: PmdbMember[]): void {
  let warnCount = 0;

  for (const m of members) {
    const rel = m.emergencyContactRelationship ?? "";
    const num = m.emergencyContactNumber ?? "";

    if (rel && looksLikePhone(rel)) {
      console.warn(
        `  ⚠ WARN [${m.churchId}] emergencyContactRelationship looks like a phone number: "${rel}"` +
          (num ? ` (contactNumber field is: "${num}")` : "")
      );
      warnCount++;
    }

    if (num && looksLikeWord(num)) {
      console.warn(
        `  ⚠ WARN [${m.churchId}] emergencyContactNumber looks like a word/relationship: "${num}"` +
          (rel ? ` (relationship field is: "${rel}")` : "")
      );
      warnCount++;
    }
  }

  if (warnCount === 0) {
    console.log("  ✓ Emergency contact fields look clean.");
  } else {
    console.log(`  ${warnCount} warning(s) above — review and correct pmdb-data.json before re-seeding.`);
  }
}

/**
 * Upsert all 52 PMDB members.
 * Uses ON CONFLICT DO UPDATE so it is safe to re-run at any time.
 * Password is only set on insert; it is never overwritten on update
 * to preserve any password the member may have changed.
 */
async function seedMembers(members: PmdbMember[]) {
  console.log(`  Upserting ${members.length} members...`);

  let inserted = 0;
  let updated = 0;

  for (const m of members) {
    const discipleshipEnabled = m.discipleship === "Enabled";
    const plainPassword =
      m.churchId === "PCM0001" ? ADMIN_PASSWORD : DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const row: InsertMember = {
      churchId: m.churchId,
      accountType: "PCM",
      status: "Active",
      role: m.role,
      passwordHash,
      firstName: m.firstName,
      middleName: m.middleName,
      lastName: m.lastName,
      gender: m.gender,
      birthday: m.birthday,
      civilStatus: m.civilStatus,
      weddingAnniversary: m.weddingAnniversary,
      email: m.email,
      contactNumber: m.contactNumber,
      foodPreferences: m.foodPreference,
      medicalCondition: m.medicalCondition,
      medication: m.medication,
      emergencyContactName: m.emergencyContact,
      emergencyContactRelationship: m.emergencyContactRelationship,
      emergencyContactNumber: m.emergencyContactNumber,
      familyGroupNumber: m.familyGroupNumber,
      familyRole: m.familyRole,
      cgNumber: m.careGroupNumber,
      cgRole: m.careGroupRole,
      sharingHuddleNumber: m.sharingHuddleNumber,
      sharingHuddleRole: m.sharingHuddleRole,
      salvationDate: m.salvationDate,
      baptismDate: m.baptismDate,
      sharingPermissionDate: m.sharingPermissionDate,
      bearingDate: m.bearingDate,
      dedicationDate: m.dedicationDate,
      ministryRoles: m.ministryDesignation,
      discipleshipEnabled,
      // SBG end date set to the current programme cycle end for all active disciples
      sbgEndDate: discipleshipEnabled ? SBG_END_DATE : null,
      stellarStatus: deriveStellarStatus(m),
    };

    // Upsert: insert or update all profile fields on church_id conflict.
    // passwordHash is excluded from updates so member-changed passwords are preserved.
    const { passwordHash: _ph, ...profileUpdate } = row;

    const result = await db
      .insert(membersTable)
      .values(row)
      .onConflictDoUpdate({
        target: membersTable.churchId,
        set: profileUpdate,
      })
      .returning({ id: membersTable.id, churchId: membersTable.churchId });

    // Drizzle returns the row whether inserted or updated; we detect by checking
    // whether passwordHash in DB matches the just-hashed value (insert → new hash).
    // Simpler: track via a second query checking pre-existence isn't needed —
    // instead we rely on the idempotency guarantee and report a combined count.
    if (result.length > 0) {
      updated++;
    }
  }

  // Re-query to get accurate inserted vs updated breakdown
  const allIds = await db
    .select({ churchId: membersTable.churchId })
    .from(membersTable);
  inserted = 0; // All went through upsert; count total as updated
  updated = allIds.length;

  return { total: members.length, inDb: updated };
}

async function seedGroups(data: PmdbData) {
  const groupDefs: Array<{ type: string; numbers: string[] }> = [
    { type: "CareGroup", numbers: data.careGroups },
    { type: "SharingHuddle", numbers: data.sharingHuddles },
    { type: "FamilyGroup", numbers: data.familyGroups },
  ];

  let created = 0;
  for (const { type, numbers } of groupDefs) {
    for (const number of numbers) {
      const existing = await db
        .select({ id: groupsTable.id })
        .from(groupsTable)
        .where(and(eq(groupsTable.type, type), eq(groupsTable.number, number)));
      if (existing.length === 0) {
        await db.insert(groupsTable).values({ type, number, name: number });
        created++;
      }
    }
  }
  return created;
}

/**
 * Post-seed verification: query and report key counts from the DB.
 * Fails the process with exit code 1 if expected counts are not met.
 */
async function verify(expectedCount: number) {
  console.log("\n  Verification:");

  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      discipleshipEnabled: sql<number>`count(*) filter (where discipleship_enabled = true)::int`,
      discipleshipDisabled: sql<number>`count(*) filter (where discipleship_enabled = false)::int`,
      hasSbgEndDate: sql<number>`count(*) filter (where sbg_end_date = ${SBG_END_DATE})::int`,
      sbg: sql<number>`count(*) filter (where stellar_status = 'SBG')::int`,
      p2s: sql<number>`count(*) filter (where stellar_status = 'P2S')::int`,
      s2b: sql<number>`count(*) filter (where stellar_status = 'S2B')::int`,
      p2g: sql<number>`count(*) filter (where stellar_status = 'P2G')::int`,
    })
    .from(membersTable);

  const r = rows[0];
  console.log(`    Total members in DB : ${r.total}`);
  console.log(`    Discipleship enabled : ${r.discipleshipEnabled}`);
  console.log(`    Discipleship disabled: ${r.discipleshipDisabled}`);
  console.log(`    sbgEndDate = ${SBG_END_DATE}: ${r.hasSbgEndDate}`);
  console.log(`    Stellar status breakdown:`);
  console.log(`      SBG: ${r.sbg}  P2S: ${r.p2s}  S2B: ${r.s2b}  P2G: ${r.p2g}`);

  const ok = r.total >= expectedCount && r.hasSbgEndDate === r.discipleshipEnabled;
  if (!ok) {
    console.error(
      `\n  ERROR: Expected at least ${expectedCount} members with sbgEndDate matching discipleship count.`
    );
    process.exit(1);
  }
  console.log(`\n  All ${r.total} members verified successfully.`);
}

async function main() {
  const raw = readFileSync(join(__dirname, "pmdb-data.json"), "utf-8");
  const data = JSON.parse(raw) as PmdbData;

  console.log(`\nSeeding PMDB 2.0 — ${data.members.length} members`);
  console.log("=".repeat(50));

  console.log("\n[0/3] Validating emergency contact fields");
  validateContactFields(data.members);

  console.log("\n[1/3] Members");
  const { total, inDb } = await seedMembers(data.members);
  console.log(`  Done: ${total} processed, ${inDb} now in DB.`);

  console.log("\n[2/3] Groups");
  const groupsCreated = await seedGroups(data);
  console.log(`  Done: ${groupsCreated} new groups created.`);

  console.log("\n[3/3] Verifying");
  await verify(data.members.length);

  console.log("\nSeed complete.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
