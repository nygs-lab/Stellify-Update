import app from "./app";
import { logger } from "./lib/logger";
import { recalcAllMembersForYear, getLastResetYear, setLastResetYear } from "./lib/fragments";
import { scheduleStreakReminderJob } from "./jobs/streakReminder";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// ─── ANNUAL FRAGMENT RESET SCHEDULER ─────────────────────────────────────────
// Checks every 6 hours whether the annual reset for the current year has run.
//
// Uses a DB-backed "lastAnnualResetYear" key so the check survives server
// restarts and outages.  If the server was down all of January 1st and comes
// back up on January 2nd (or even February), the reset is still detected as
// missing and executed.
//
// Correctness guarantees:
// - `lastAnnualResetYear` in the DB is only written AFTER a successful reset,
//   so a failed or partial reset is retried on the next interval.
// - Running the reset multiple times in the same year is safe — it is
//   idempotent and always derives from the underlying log tables.

async function maybeRunAnnualReset(): Promise<void> {
  const currentYear = new Date().getFullYear();
  let lastResetYear: number;

  try {
    lastResetYear = await getLastResetYear();
  } catch (err) {
    logger.error({ err }, "Annual reset: failed to read lastAnnualResetYear from DB — skipping");
    return;
  }

  if (currentYear <= lastResetYear) {
    return; // already reset for this year
  }

  logger.info({ year: currentYear, lastResetYear }, "Annual fragment reset: recalculating all members");

  try {
    const result = await recalcAllMembersForYear(currentYear, true);
    // Only mark success AFTER the recalculation completes without error
    await setLastResetYear(currentYear);
    logger.info({ year: currentYear, ...result }, "Annual fragment reset complete");
  } catch (err) {
    logger.error({ err, year: currentYear }, "Annual fragment reset failed — will retry on next interval");
  }
}

// Check every 6 hours; also run once at startup so any missed reset
// (including across a multi-day outage) is caught immediately.
setInterval(maybeRunAnnualReset, 6 * 60 * 60 * 1000);
maybeRunAnnualReset().catch((err) => logger.error({ err }, "Startup annual-reset check failed"));

// ─── NIGHTLY STREAK REMINDER ──────────────────────────────────────────────────
// Fires at 8 PM server-time each night.  Queries members who haven't logged
// both SHC001 (Prayer) and SHC002 (Devotion) today and sends a push
// notification via the Expo Push API so the reminder fires even if the member
// never opened the app that day.
scheduleStreakReminderJob();
