/**
 * One-time reset script: set stellarFragments = 0 and currentStreak = 0
 * for all members at the start of an annual cycle.
 *
 * Usage: pnpm --filter @workspace/scripts run reset-stellar-fragments
 *
 * This was run during Task #1 foundation setup (2026-06-26) to establish
 * a clean baseline before the annual tracking cycle begins.
 */
import { db, membersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    UPDATE members
    SET stellar_fragments = 0, current_streak = 0
  `);
  console.log(`Reset complete — rows affected: ${(result as any).rowCount ?? "unknown"}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
