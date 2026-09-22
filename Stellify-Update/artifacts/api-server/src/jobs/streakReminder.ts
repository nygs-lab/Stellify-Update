import { and, eq, isNotNull } from "drizzle-orm";
import { db, membersTable, spiritualHabitLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

/**
 * In-memory deduplication: tracks the local date (YYYY-MM-DD in the member's
 * own timezone) on which we last sent a streak reminder.
 * Resets on server restart — at most one duplicate notification per member per
 * server restart event, which is acceptable for a non-critical reminder.
 */
const _notifiedOnDate = new Map<number, string>();

/**
 * Returns the local hour (0-23), minute (0-59), and local date (YYYY-MM-DD)
 * for `now` in the given IANA timezone. Falls back to "UTC" if the timezone
 * string is absent or unrecognised.
 *
 * Minute is included so that non-integer-offset timezones (UTC+5:30, UTC+5:45,
 * UTC+9:30, etc.) are matched at their actual local 20:00 window rather than
 * being missed when only the hour is checked.
 */
function getLocalHourAndDate(timezone: string | null): { hour: number; minute: number; date: string } {
  const tz = resolvedTz(timezone);
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return { hour, minute, date: `${year}-${month}-${day}` };
}

/**
 * Returns the Sunday-anchored ISO week-start (YYYY-MM-DD) for the current date
 * in the given IANA timezone.
 *
 * Must match the canonical anchor in `routes/habits.ts:getWeekStart` (which
 * uses `d.getDate() - d.getDay()` where getDay() returns 0 for Sunday).
 */
function getWeekStartInTz(timezone: string | null): string {
  const tz = resolvedTz(timezone);
  const now = new Date();
  const dayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayShort);
  // dayIndex === 0 (Sun) → offset = 0; Mon→-1, Tue→-2, …, Sat→-6
  const offsetToSunday = -dayIndex;
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const [y, m, d] = todayStr.split("-").map(Number) as [number, number, number];
  const sunday = new Date(Date.UTC(y, m - 1, d + offsetToSunday));
  return sunday.toISOString().split("T")[0] as string;
}

/**
 * Returns the 3-letter weekday key for the current day in the given IANA
 * timezone (e.g. "Mon", "Tue", …, "Sun").
 */
function getDayKeyInTz(timezone: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTz(timezone),
    weekday: "short",
  }).format(new Date());
}

/** Validates and resolves an IANA timezone string, falling back to "UTC". */
function resolvedTz(timezone: string | null): string {
  if (!timezone) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function checkDayDone(daysJson: string | null, dayKey: string): boolean {
  if (!daysJson) return false;
  try {
    const days = JSON.parse(daysJson) as Array<{
      day?: string;
      dayOfWeek?: string;
      done?: boolean;
      completed?: boolean;
    }>;
    return days.some(
      (d) =>
        (d.day === dayKey || d.dayOfWeek === dayKey) &&
        (d.done === true || d.completed === true)
    );
  } catch {
    return false;
  }
}

async function sendExpoPushBatch(tokens: string[]): Promise<void> {
  const messages = tokens.map((to) => ({
    to,
    title: "Streak at risk! 🔥",
    body: "You haven't logged Prayer & Devotion today. Keep your streak alive!",
    data: { screen: "disciple", subTab: "spiritual" },
    sound: "default",
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo Push API error ${res.status}: ${text}`);
  }
}

/**
 * Runs the streak reminder job for the current UTC-hour window.
 *
 * For each active member with a registered push token:
 * 1. Determines their local hour using their stored IANA timezone (falls back
 *    to UTC if not set).
 * 2. Skips members whose local time is not in the 8 PM hour.
 * 3. Skips members already notified today in their local timezone (in-memory
 *    dedup — resets on server restart).
 * 4. Fetches their habit logs using their local week-start and day key.
 * 5. Sends a push notification to members who haven't completed both Prayer
 *    and Devotion yet today.
 */
export async function runStreakReminderJob(): Promise<void> {
  logger.info("Streak reminder: starting hourly timezone-aware job");

  const members = await db
    .select({
      id: membersTable.id,
      expoPushToken: membersTable.expoPushToken,
      timezone: membersTable.timezone,
    })
    .from(membersTable)
    .where(
      and(
        eq(membersTable.status, "Active"),
        isNotNull(membersTable.expoPushToken)
      )
    );

  if (members.length === 0) {
    logger.info("Streak reminder: no members with push tokens registered");
    return;
  }

  // Filter to members whose local time is currently in the 20:00–20:04 window
  // and who have not already been notified today in their own timezone.
  //
  // The 5-minute window matches the scheduler's poll interval. Using both hour
  // AND minute covers non-integer-offset timezones (UTC+5:30, UTC+5:45,
  // UTC+9:30, etc.) that would be missed if only the hour were checked.
  const eligible: Array<{ id: number; expoPushToken: string | null; timezone: string | null }> = [];
  for (const member of members) {
    const { hour, minute, date } = getLocalHourAndDate(member.timezone);
    if (hour !== 20 || minute >= 5) continue;
    if (_notifiedOnDate.get(member.id) === date) continue;
    eligible.push(member);
  }

  logger.info(
    { total: members.length, eligible: eligible.length },
    "Streak reminder: members in their 8 PM window"
  );

  if (eligible.length === 0) return;

  // For each eligible member, look up their habit logs using their local
  // week-start and day key so boundaries are correct in their timezone.
  const tokensToNotify: string[] = [];

  for (const member of eligible) {
    const weekStart = getWeekStartInTz(member.timezone);
    const todayKey = getDayKeyInTz(member.timezone);

    const logs = await db
      .select({
        habitCode: spiritualHabitLogsTable.habitCode,
        daysJson: spiritualHabitLogsTable.daysJson,
      })
      .from(spiritualHabitLogsTable)
      .where(
        and(
          eq(spiritualHabitLogsTable.memberId, member.id),
          eq(spiritualHabitLogsTable.weekStart, weekStart)
        )
      );

    const logMap = new Map(logs.map((l) => [l.habitCode, l.daysJson]));
    const prayerDone = checkDayDone(logMap.get("SHC001") ?? null, todayKey);
    const devotionDone = checkDayDone(logMap.get("SHC002") ?? null, todayKey);

    // Mark notified regardless of habit status so we don't re-evaluate this
    // member again within the same local-8PM hour window.
    const { date } = getLocalHourAndDate(member.timezone);
    _notifiedOnDate.set(member.id, date);

    if (!prayerDone || !devotionDone) {
      tokensToNotify.push(member.expoPushToken as string);
    }
  }

  logger.info(
    { toNotify: tokensToNotify.length },
    "Streak reminder: sending push notifications"
  );

  if (tokensToNotify.length === 0) {
    logger.info("Streak reminder: all eligible members have completed habits today");
    return;
  }

  let sent = 0;
  for (let i = 0; i < tokensToNotify.length; i += BATCH_SIZE) {
    const batch = tokensToNotify.slice(i, i + BATCH_SIZE);
    try {
      await sendExpoPushBatch(batch);
      sent += batch.length;
    } catch (err) {
      logger.error({ err, batchStart: i }, "Streak reminder: batch send failed");
    }
  }

  logger.info({ sent }, "Streak reminder: job complete");
}

/**
 * Schedules the streak reminder job to run every 5 minutes.
 *
 * A 5-minute poll interval ensures the job runs within the 20:00–20:04 local
 * window for every member, including those in non-integer-offset timezones
 * (UTC+5:30, UTC+5:45, UTC+9:30, etc.) that would be missed by an hourly poll.
 * Per-member deduplication via `_notifiedOnDate` prevents double-sends.
 */
export function scheduleStreakReminderJob(): void {
  const FIVE_MIN_MS = 5 * 60 * 1000;

  function runAndReschedule(): void {
    runStreakReminderJob()
      .catch((err) => {
        logger.error({ err }, "Streak reminder: job threw unexpectedly");
      })
      .finally(() => {
        setTimeout(runAndReschedule, FIVE_MIN_MS);
      });
  }

  // Align first run to the next 5-minute boundary (:00, :05, :10, …) so
  // subsequent polls consistently land at minute boundaries matching the
  // eligibility window (20:00–20:04).
  const now = new Date();
  const msToNext5Min = FIVE_MIN_MS - (now.getTime() % FIVE_MIN_MS);
  const delayMs = msToNext5Min;

  const nextRun = new Date(Date.now() + delayMs).toISOString();
  logger.info({ nextRun }, "Streak reminder: first run scheduled");

  setTimeout(runAndReschedule, delayMs);
}
