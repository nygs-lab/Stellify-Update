import path from "path";
import fs from "fs";
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
// Absolute paths resolved relative to container root /app
const rootDir = process.cwd();
const possiblePaths = [
  path.resolve(rootDir, "artifacts/stellify/dist/public"),
  path.resolve(rootDir, "artifacts/stellify/dist"),
  path.resolve(rootDir, "dist/public"),
  path.resolve(rootDir, "dist"),
];

// Mount static middleware for every existing directory
possiblePaths.forEach((staticPath) => {
  if (fs.existsSync(staticPath)) {
    logger.info({ staticPath }, "Mounted static frontend assets directory");
    app.use(express.static(staticPath));
  }
});

// Fallback GET requests to index.html for Single Page Application routing
app.get("{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  for (const staticPath of possiblePaths) {
    const indexPath = path.join(staticPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  res.status(404).send("Frontend index.html not found at expected path");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, rootDir }, "Server listening");
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