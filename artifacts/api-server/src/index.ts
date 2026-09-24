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
// Explicitly resolve paths relative to both process.cwd() AND __dirname
const possiblePaths = [
  // Relative to repository root /app
  path.resolve(process.cwd(), "artifacts/stellify/dist/public"),
  path.resolve(process.cwd(), "artifacts/stellify/dist"),
  path.resolve(process.cwd(), "../stellify/dist/public"),
  path.resolve(process.cwd(), "../stellify/dist"),
  // Relative to this file's location inside artifacts/api-server/src or dist
  path.resolve(__dirname, "../../stellify/dist/public"),
  path.resolve(__dirname, "../../stellify/dist"),
  path.resolve(__dirname, "../../../artifacts/stellify/dist/public"),
  path.resolve(__dirname, "../../../artifacts/stellify/dist"),
];

// Mount static middleware for any directory that exists
possiblePaths.forEach((staticPath) => {
  if (fs.existsSync(staticPath)) {
    logger.info({ staticPath }, "Mounted static frontend assets directory");
    app.use(express.static(staticPath));
  }
});

// Fallback GET requests to index.html for Single Page Application (SPA) routing
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

  logger.info({ port, cwd: process.cwd(), __dirname }, "Server listening");
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