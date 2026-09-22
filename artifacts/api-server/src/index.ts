import path from "path";
import express from "express";
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

// ─── STATIC FRONTEND SERVING ──────────────────────────────────────────────────
// Serve static built web assets from the frontend artifact folder
const publicPath = path.join(process.cwd(), "artifacts/stellify/dist/public");
const distPath = path.join(process.cwd(), "artifacts/stellify/dist");

app.use(express.static(publicPath));
app.use(express.static(distPath));

// Express v5 syntax: use '{*splat}' instead of '*' for wildcards
app.get("{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) res.sendFile(path.join(distPath, "index.html"), () => res.status(404).send("Page not found"));
  });
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// ─── ANNUAL FRAGMENT RESET SCHEDULER ─────────────────────────────────────────
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
    await setLastResetYear(currentYear);
    logger.info({ year: currentYear, ...result }, "Annual fragment reset complete");
  } catch (err) {
    logger.error({ err, year: currentYear }, "Annual fragment reset failed — will retry on next interval");
  }
}

setInterval(maybeRunAnnualReset, 6 * 60 * 60 * 1000);
maybeRunAnnualReset().catch((err) => logger.error({ err }, "Startup annual-reset check failed"));

scheduleStreakReminderJob();