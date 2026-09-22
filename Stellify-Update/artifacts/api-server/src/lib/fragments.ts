import { and, eq, gte, lte } from "drizzle-orm";
import {
  db,
  spiritualHabitLogsTable,
  worshipAttendanceLogsTable,
  biblicalNotesLogsTable,
  cgAttendanceLogsTable,
  sharingHuddleLogsTable,
  gotLogsTable,
  personalHabitLogsTable,
  membersTable,
  systemConfigTable,
} from "@workspace/db";
import {
  spiritualCompletionsInYear,
  computeStreak,
  countAttended,
  countDone,
  countCompleted,
} from "./fragments-compute.js";

// ─── DB-BACKED CONFIG HELPERS ─────────────────────────────────────────────────

const CONFIG_KEY_LAST_RESET_YEAR = "lastAnnualResetYear";

/** Read the persisted year of the last successful annual reset (0 if never run). */
export async function getLastResetYear(): Promise<number> {
  const [row] = await db
    .select({ value: systemConfigTable.value })
    .from(systemConfigTable)
    .where(eq(systemConfigTable.key, CONFIG_KEY_LAST_RESET_YEAR));
  return row ? parseInt(row.value, 10) : 0;
}

/** Persist the year of the last successful annual reset to the DB. */
export async function setLastResetYear(year: number): Promise<void> {
  await db
    .insert(systemConfigTable)
    .values({ key: CONFIG_KEY_LAST_RESET_YEAR, value: String(year) })
    .onConflictDoUpdate({
      target: systemConfigTable.key,
      set: { value: String(year) },
    });
}

// ─── FRAGMENT + STREAK RECALCULATION ─────────────────────────────────────────

/**
 * Recalculate stellarFragments (for the given year) and currentStreak for one
 * member, then persist the result to the members table.
 *
 * - `year` defaults to the current calendar year.
 * - `annualReset` — set true during the year-boundary reset.  When true,
 *   currentStreak is written as 0 (the leaderboard starts fresh); on regular
 *   habit-logging calls it is left as the all-time consecutive prayer count so
 *   member profiles keep their live streak.
 */
export async function recalcMemberStats(
  memberId: number,
  year?: number,
  annualReset = false,
): Promise<void> {
  const targetYear = year ?? new Date().getFullYear();
  const yearStart = `${targetYear}-01-01`;
  const yearEnd = `${targetYear}-12-31`;

  // Expand the spiritual-logs fetch window to capture weeks that straddle the
  // year boundary (e.g. a Dec 29 weekStart with Jan 1–4 days, or a Jan 1
  // weekStart with late-December days from the prior year).
  const spiritualWindowStart = `${targetYear - 1}-12-25`;
  const spiritualWindowEnd = `${targetYear + 1}-01-07`;

  let fragments = 0;

  // ── Spiritual habits ───────────────────────────────────────────────────────
  // Fetch a wider window and filter by actual completion date, not weekStart.
  const spiritualLogs = await db
    .select()
    .from(spiritualHabitLogsTable)
    .where(
      and(
        eq(spiritualHabitLogsTable.memberId, memberId),
        gte(spiritualHabitLogsTable.weekStart, spiritualWindowStart),
        lte(spiritualHabitLogsTable.weekStart, spiritualWindowEnd),
      ),
    );

  fragments += spiritualCompletionsInYear(spiritualLogs, targetYear);

  // ── Worship (SHC004) ───────────────────────────────────────────────────────
  const worshipLogs = await db
    .select()
    .from(worshipAttendanceLogsTable)
    .where(
      and(
        eq(worshipAttendanceLogsTable.memberId, memberId),
        gte(worshipAttendanceLogsTable.attendanceDate, yearStart),
        lte(worshipAttendanceLogsTable.attendanceDate, yearEnd),
      ),
    );
  fragments += countAttended(worshipLogs);

  // ── Biblical Notes (SHC005) ────────────────────────────────────────────────
  const biblicalLogs = await db
    .select()
    .from(biblicalNotesLogsTable)
    .where(
      and(
        eq(biblicalNotesLogsTable.memberId, memberId),
        gte(biblicalNotesLogsTable.noteDate, yearStart),
        lte(biblicalNotesLogsTable.noteDate, yearEnd),
      ),
    );
  fragments += countDone(biblicalLogs);

  // ── CG Attendance (SHC006) ─────────────────────────────────────────────────
  const cgLogs = await db
    .select()
    .from(cgAttendanceLogsTable)
    .where(
      and(
        eq(cgAttendanceLogsTable.memberId, memberId),
        gte(cgAttendanceLogsTable.attendanceDate, yearStart),
        lte(cgAttendanceLogsTable.attendanceDate, yearEnd),
      ),
    );
  fragments += countAttended(cgLogs);

  // ── Sharing Huddle (SHC007) ────────────────────────────────────────────────
  const huddleLogs = await db
    .select()
    .from(sharingHuddleLogsTable)
    .where(
      and(
        eq(sharingHuddleLogsTable.memberId, memberId),
        gte(sharingHuddleLogsTable.huddleDate, yearStart),
        lte(sharingHuddleLogsTable.huddleDate, yearEnd),
      ),
    );
  fragments += countAttended(huddleLogs);

  // ── GOT (SHC003) ───────────────────────────────────────────────────────────
  const gotLogs = await db
    .select()
    .from(gotLogsTable)
    .where(
      and(
        eq(gotLogsTable.memberId, memberId),
        gte(gotLogsTable.weekStart, yearStart),
        lte(gotLogsTable.weekStart, yearEnd),
      ),
    );
  fragments += gotLogs.length;

  // ── Personal habits ────────────────────────────────────────────────────────
  const personalLogs = await db
    .select()
    .from(personalHabitLogsTable)
    .where(
      and(
        eq(personalHabitLogsTable.memberId, memberId),
        eq(personalHabitLogsTable.completed, true),
        gte(personalHabitLogsTable.logDate, yearStart),
        lte(personalHabitLogsTable.logDate, yearEnd),
      ),
    );
  fragments += countCompleted(personalLogs);

  // ── Streak computation ─────────────────────────────────────────────────────
  // During an annual reset the leaderboard starts fresh, so streak is set to 0.
  // On regular recalcs (triggered by habit logging) the all-time consecutive
  // prayer streak is preserved — it intentionally crosses year boundaries.
  let streak = 0;

  if (!annualReset) {
    // Fetch all prayer logs (all-time) so multi-year streaks are correct.
    const allPrayerLogs = await db
      .select()
      .from(spiritualHabitLogsTable)
      .where(
        and(
          eq(spiritualHabitLogsTable.memberId, memberId),
          eq(spiritualHabitLogsTable.habitCode, "SHC001"),
        ),
      );

    streak = computeStreak(allPrayerLogs);
  }

  await db
    .update(membersTable)
    .set({ stellarFragments: fragments, currentStreak: streak })
    .where(eq(membersTable.id, memberId));
}

/**
 * Compute the total fragment count for a single member in a given year by
 * aggregating directly from the habit log tables.  Unlike `recalcMemberStats`
 * this function does NOT persist anything — it is used to build historical
 * StellarBoard rankings without touching member rows.
 */
export async function computeFragmentsForMember(
  memberId: number,
  year: number,
): Promise<number> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const spiritualWindowStart = `${year - 1}-12-25`;
  const spiritualWindowEnd = `${year + 1}-01-07`;

  let fragments = 0;

  const spiritualLogs = await db
    .select()
    .from(spiritualHabitLogsTable)
    .where(
      and(
        eq(spiritualHabitLogsTable.memberId, memberId),
        gte(spiritualHabitLogsTable.weekStart, spiritualWindowStart),
        lte(spiritualHabitLogsTable.weekStart, spiritualWindowEnd),
      ),
    );
  fragments += spiritualCompletionsInYear(spiritualLogs, year);

  const worshipLogs = await db
    .select()
    .from(worshipAttendanceLogsTable)
    .where(
      and(
        eq(worshipAttendanceLogsTable.memberId, memberId),
        gte(worshipAttendanceLogsTable.attendanceDate, yearStart),
        lte(worshipAttendanceLogsTable.attendanceDate, yearEnd),
      ),
    );
  fragments += countAttended(worshipLogs);

  const biblicalLogs = await db
    .select()
    .from(biblicalNotesLogsTable)
    .where(
      and(
        eq(biblicalNotesLogsTable.memberId, memberId),
        gte(biblicalNotesLogsTable.noteDate, yearStart),
        lte(biblicalNotesLogsTable.noteDate, yearEnd),
      ),
    );
  fragments += countDone(biblicalLogs);

  const cgLogs = await db
    .select()
    .from(cgAttendanceLogsTable)
    .where(
      and(
        eq(cgAttendanceLogsTable.memberId, memberId),
        gte(cgAttendanceLogsTable.attendanceDate, yearStart),
        lte(cgAttendanceLogsTable.attendanceDate, yearEnd),
      ),
    );
  fragments += countAttended(cgLogs);

  const huddleLogs = await db
    .select()
    .from(sharingHuddleLogsTable)
    .where(
      and(
        eq(sharingHuddleLogsTable.memberId, memberId),
        gte(sharingHuddleLogsTable.huddleDate, yearStart),
        lte(sharingHuddleLogsTable.huddleDate, yearEnd),
      ),
    );
  fragments += countAttended(huddleLogs);

  const gotLogs = await db
    .select()
    .from(gotLogsTable)
    .where(
      and(
        eq(gotLogsTable.memberId, memberId),
        gte(gotLogsTable.weekStart, yearStart),
        lte(gotLogsTable.weekStart, yearEnd),
      ),
    );
  fragments += gotLogs.length;

  const personalLogs = await db
    .select()
    .from(personalHabitLogsTable)
    .where(
      and(
        eq(personalHabitLogsTable.memberId, memberId),
        eq(personalHabitLogsTable.completed, true),
        gte(personalHabitLogsTable.logDate, yearStart),
        lte(personalHabitLogsTable.logDate, yearEnd),
      ),
    );
  fragments += countCompleted(personalLogs);

  return fragments;
}

/**
 * Re-run recalcMemberStats for every discipleship-enabled member.
 * Used for the annual reset on January 1st and the admin-triggered reset.
 *
 * When called for an annual reset, pass annualReset=true so that
 * currentStreak is zeroed along with stellarFragments.
 *
 * Idempotent — safe to call multiple times; always derives the correct count
 * from the log tables for the specified year.
 */
export async function recalcAllMembersForYear(
  year?: number,
  annualReset = false,
): Promise<{ updated: number }> {
  const members = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(eq(membersTable.discipleshipEnabled, true));

  for (const member of members) {
    await recalcMemberStats(member.id, year, annualReset);
  }

  return { updated: members.length };
}
