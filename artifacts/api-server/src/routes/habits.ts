import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  spiritualHabitLogsTable,
  worshipAttendanceLogsTable,
  biblicalNotesLogsTable,
  cgAttendanceLogsTable,
  sharingHuddleLogsTable,
  gotLogsTable,
  personalHabitsTable,
  personalHabitLogsTable,
  sharingPreparationsTable,
  sharingAttemptsTable,
  bearingResultsTable,
  membersTable,
  weekUnlocksTable,
} from "@workspace/db";
import { recalcMemberStats } from "../lib/fragments";

const router: IRouter = Router();

// Block ALL habit requests (reads and writes) when discipleship is disabled.
// Admin and Pastor roles bypass the check so they can audit member data.
// Guard with path check because this router is mounted without a path prefix,
// so its middleware fires for every request that reaches it.
router.use(async (req: any, res: any, next: any) => {
  if (!req.path.startsWith("/habits")) {
    next();
    return;
  }
  const memberId: number | undefined = req.session?.memberId ?? req.memberId;
  if (!memberId) {
    next();
    return;
  }
  const [member] = await db
    .select({ discipleshipEnabled: membersTable.discipleshipEnabled, role: membersTable.role })
    .from(membersTable)
    .where(eq(membersTable.id, memberId));
  if (member) {
    // Attach role so route handlers can pass it to isWeekOpen without an extra DB call.
    req.memberRole = member.role;
    // Admins and Pastors can always read habit data for management purposes.
    const isManager = ["Admin", "Pastor"].includes(member.role);
    if (!isManager && !member.discipleshipEnabled) {
      res.status(403).json({ error: "Discipleship is disabled for your account. Habit tracking is not available." });
      return;
    }
  }
  next();
});

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.memberId ?? req.memberId;
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return id;
}

// Get current week's Sunday date
function getWeekStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  const sunday = new Date(d);
  sunday.setDate(diff);
  return sunday.toISOString().split("T")[0];
}

// Return true only while the current week's logging window is open.
// Window: Sunday 00:00 through the following Sunday at 07:30.
// Admin and Pastor roles bypass the window entirely.
const PRIVILEGED_ROLES = new Set(["Admin", "Pastor"]);
function isWeekOpen(weekStart: string, role?: string): boolean {
  if (role && PRIVILEGED_ROLES.has(role)) return true;
  const currentWeekStart = getWeekStart(); // no arg → today's week
  if (weekStart !== currentWeekStart) return false;
  const deadline = new Date(currentWeekStart + "T00:00:00");
  deadline.setDate(deadline.getDate() + 7); // next Sunday
  deadline.setHours(7, 30, 0, 0);
  return new Date() <= deadline;
}

// True if the member may write to the given week: either window is open, or an
// admin has explicitly unlocked that week for them.
async function canWriteWeek(memberId: number, weekStart: string, role?: string): Promise<boolean> {
  if (isWeekOpen(weekStart, role)) return true;
  const [unlock] = await db
    .select({ id: weekUnlocksTable.id })
    .from(weekUnlocksTable)
    .where(and(eq(weekUnlocksTable.memberId, memberId), eq(weekUnlocksTable.weekStart, weekStart)));
  return !!unlock;
}

// ─── SPIRITUAL HABITS ─────────────────────────────────────────────────────────

router.get("/habits/spiritual", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const weekStart = getWeekStart(req.query.weekStart as string);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  // Fetch all habit records for this week
  const [prayerLog] = await db.select().from(spiritualHabitLogsTable)
    .where(and(eq(spiritualHabitLogsTable.memberId, memberId), eq(spiritualHabitLogsTable.habitCode, "SHC001"), eq(spiritualHabitLogsTable.weekStart, weekStart)));
  const [devotionLog] = await db.select().from(spiritualHabitLogsTable)
    .where(and(eq(spiritualHabitLogsTable.memberId, memberId), eq(spiritualHabitLogsTable.habitCode, "SHC002"), eq(spiritualHabitLogsTable.weekStart, weekStart)));
  const [worshipLog] = await db.select().from(worshipAttendanceLogsTable)
    .where(and(eq(worshipAttendanceLogsTable.memberId, memberId), eq(worshipAttendanceLogsTable.attendanceDate, weekStart)));
  const [biblicalLog] = await db.select().from(biblicalNotesLogsTable)
    .where(and(eq(biblicalNotesLogsTable.memberId, memberId), eq(biblicalNotesLogsTable.noteDate, weekStart)));
  const [cgLog] = await db.select().from(cgAttendanceLogsTable)
    .where(and(eq(cgAttendanceLogsTable.memberId, memberId), eq(cgAttendanceLogsTable.attendanceDate, weekStart)));
  const [huddleLog] = await db.select().from(sharingHuddleLogsTable)
    .where(and(eq(sharingHuddleLogsTable.memberId, memberId), eq(sharingHuddleLogsTable.huddleDate, weekStart)));
  const [gotLog] = await db.select().from(gotLogsTable)
    .where(and(eq(gotLogsTable.memberId, memberId), eq(gotLogsTable.weekStart, weekStart)));

  const parseLog = (log: any) => {
    if (!log) return null;
    return {
      ...log,
      days: JSON.parse(log.daysJson || "[]"),
    };
  };

  const [weekUnlock] = await db
    .select({ id: weekUnlocksTable.id })
    .from(weekUnlocksTable)
    .where(and(eq(weekUnlocksTable.memberId, memberId), eq(weekUnlocksTable.weekStart, weekStart)));

  res.json({
    weekStart,
    weekEnd: weekEndStr,
    isUnlocked: !!weekUnlock,
    prayer: parseLog(prayerLog) ?? { id: null, habitCode: "SHC001", memberId, weekStart, days: [], stellarFragments: 0, isLocked: false },
    devotion: parseLog(devotionLog) ?? { id: null, habitCode: "SHC002", memberId, weekStart, days: [], stellarFragments: 0, isLocked: false },
    worshipAttendance: worshipLog ? { ...worshipLog, date: worshipLog.attendanceDate } : { id: null, memberId, date: weekStart, attended: false },
    biblicalNotes: biblicalLog ?? { id: null, memberId, date: weekStart, isDone: false },
    cgAttendance: cgLog ?? { id: null, memberId, date: weekStart },
    sharingHuddle: huddleLog ? { ...huddleLog, date: huddleLog.huddleDate } : { id: null, memberId, date: weekStart, attended: false },
    got: gotLog ?? { id: null, memberId, weekStart },
  });
});

router.post("/habits/spiritual/log", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { habitCode, weekStart, days = [], totalDuration, targetDuration } = req.body ?? {};
  if (!habitCode || !weekStart) {
    res.status(400).json({ error: "habitCode and weekStart required" });
    return;
  }

  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(spiritualHabitLogsTable)
    .where(and(eq(spiritualHabitLogsTable.memberId, memberId), eq(spiritualHabitLogsTable.habitCode, habitCode), eq(spiritualHabitLogsTable.weekStart, ws)));

  if (existing) {
    const [updated] = await db.update(spiritualHabitLogsTable)
      .set({ daysJson: JSON.stringify(days), totalDuration, targetDuration })
      .where(eq(spiritualHabitLogsTable.id, existing.id))
      .returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, days: JSON.parse(updated.daysJson) });
    return;
  }

  const [log] = await db.insert(spiritualHabitLogsTable).values({
    memberId, habitCode, weekStart: ws,
    daysJson: JSON.stringify(days),
    totalDuration, targetDuration,
    stellarFragments: 0,
    isLocked: false,
  }).returning();

  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, days: JSON.parse(log.daysJson) });
});

router.patch("/habits/spiritual/log/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // Load the existing log first to check ownership and week boundary
  const [existing] = await db.select().from(spiritualHabitLogsTable)
    .where(and(eq(spiritualHabitLogsTable.id, id), eq(spiritualHabitLogsTable.memberId, memberId)));
  if (!existing) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (!await canWriteWeek(memberId, existing.weekStart, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const { days, totalDuration, targetDuration, ...rest } = req.body ?? {};
  const updates: Record<string, unknown> = { ...rest };
  if (days !== undefined) updates.daysJson = JSON.stringify(days);
  if (totalDuration !== undefined) updates.totalDuration = totalDuration;
  if (targetDuration !== undefined) updates.targetDuration = targetDuration;

  const [log] = await db.update(spiritualHabitLogsTable).set(updates).where(eq(spiritualHabitLogsTable.id, id)).returning();
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.json({ ...log, days: JSON.parse(log.daysJson) });
});

router.post("/habits/spiritual/worship", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { weekStart, attended = true, attendanceType, absenceReason } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(worshipAttendanceLogsTable)
    .where(and(eq(worshipAttendanceLogsTable.memberId, memberId), eq(worshipAttendanceLogsTable.attendanceDate, ws)));

  if (existing) {
    const [updated] = await db.update(worshipAttendanceLogsTable)
      .set({ attended, attendanceType, absenceReason })
      .where(eq(worshipAttendanceLogsTable.id, existing.id)).returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, date: updated.attendanceDate });
    return;
  }

  const [log] = await db.insert(worshipAttendanceLogsTable).values({
    memberId, attendanceDate: ws, attended, attendanceType, absenceReason,
  }).returning();
  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, date: log.attendanceDate });
});

router.post("/habits/spiritual/huddle", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { weekStart, attended = true, absenceReason, monthlyQuestion, monthlyAnswer } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(sharingHuddleLogsTable)
    .where(and(eq(sharingHuddleLogsTable.memberId, memberId), eq(sharingHuddleLogsTable.huddleDate, ws)));

  if (existing) {
    const [updated] = await db.update(sharingHuddleLogsTable)
      .set({ attended, absenceReason, monthlyQuestion, monthlyAnswer })
      .where(eq(sharingHuddleLogsTable.id, existing.id)).returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, date: updated.huddleDate });
    return;
  }

  const [log] = await db.insert(sharingHuddleLogsTable).values({
    memberId, huddleDate: ws, attended, absenceReason, monthlyQuestion, monthlyAnswer,
  }).returning();
  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, date: log.huddleDate });
});

router.post("/habits/spiritual/got", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { weekStart, submitted = true, giftAmount, offeringAmount, tithesAmount, bobDeduction, bobReason, totalSubmission, submissionMethod } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(gotLogsTable)
    .where(and(eq(gotLogsTable.memberId, memberId), eq(gotLogsTable.weekStart, ws)));

  // Toggle off: delete the record so presence-based state is consistent
  if (existing && !submitted) {
    await db.delete(gotLogsTable).where(eq(gotLogsTable.id, existing.id));
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ id: null, memberId, weekStart: ws, submitted: false });
    return;
  }

  if (existing) {
    const [updated] = await db.update(gotLogsTable)
      .set({ giftAmount, offeringAmount, tithesAmount, bobDeduction, bobReason, totalSubmission, submissionMethod, stellarFragments: 1 })
      .where(eq(gotLogsTable.id, existing.id)).returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, submitted: true });
    return;
  }

  if (!submitted) {
    res.status(201).json({ id: null, memberId, weekStart: ws, submitted: false });
    return;
  }

  const [log] = await db.insert(gotLogsTable).values({
    memberId, weekStart: ws, giftAmount, offeringAmount, tithesAmount, bobDeduction, bobReason, totalSubmission, submissionMethod,
    stellarFragments: 1,
  }).returning();
  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, submitted: true });
});

router.post("/habits/spiritual/biblical", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const {
    weekStart, isDone = true, noteType, notes,
    bsfWholeContext, bsfSource, bsfReceiver, bsfRelation, bsfSpecificTopic, bsfOutline, bsfApplication, bupSelection,
  } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(biblicalNotesLogsTable)
    .where(and(eq(biblicalNotesLogsTable.memberId, memberId), eq(biblicalNotesLogsTable.noteDate, ws)));

  const bsfFields = { bsfWholeContext, bsfSource, bsfReceiver, bsfRelation, bsfSpecificTopic, bsfOutline, bsfApplication, bupSelection };

  if (existing) {
    const [updated] = await db.update(biblicalNotesLogsTable)
      .set({ isDone, noteType, notes, ...bsfFields, stellarFragments: isDone ? 1 : 0 })
      .where(eq(biblicalNotesLogsTable.id, existing.id)).returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, date: updated.noteDate });
    return;
  }

  const [log] = await db.insert(biblicalNotesLogsTable).values({
    memberId, noteDate: ws, isDone, noteType, notes, ...bsfFields,
    stellarFragments: isDone ? 1 : 0,
  }).returning();
  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, date: log.noteDate });
});

router.post("/habits/spiritual/cg", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { weekStart, attended = true, absenceReason, weeklyQuestion, weeklyAnswer } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const ws = getWeekStart(weekStart);
  if (!await canWriteWeek(memberId, ws, (req as any).memberRole)) {
    res.status(403).json({ error: "This week is closed for logging." });
    return;
  }

  const [existing] = await db.select().from(cgAttendanceLogsTable)
    .where(and(eq(cgAttendanceLogsTable.memberId, memberId), eq(cgAttendanceLogsTable.attendanceDate, ws)));

  if (existing) {
    const [updated] = await db.update(cgAttendanceLogsTable)
      .set({ attended, absenceReason, weeklyQuestion, weeklyAnswer, stellarFragments: attended ? 1 : 0 })
      .where(eq(cgAttendanceLogsTable.id, existing.id)).returning();
    recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
    res.status(201).json({ ...updated, date: updated.attendanceDate });
    return;
  }

  const [log] = await db.insert(cgAttendanceLogsTable).values({
    memberId, attendanceDate: ws, attended, absenceReason, weeklyQuestion, weeklyAnswer,
    stellarFragments: attended ? 1 : 0,
  }).returning();
  recalcMemberStats(memberId).catch((err) => req.log.error({ err }, "recalcMemberStats failed"));
  res.status(201).json({ ...log, date: log.attendanceDate });
});

router.post("/habits/spiritual/unlock", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;

  const [caller] = await db
    .select({ role: membersTable.role })
    .from(membersTable)
    .where(eq(membersTable.id, callerId));
  if (!caller || caller.role !== "Admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  const { weekStart, memberId: bodyMemberId } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const targetMemberId: number = bodyMemberId ?? callerId;
  const ws = getWeekStart(weekStart);

  const [existing] = await db
    .select({ id: weekUnlocksTable.id })
    .from(weekUnlocksTable)
    .where(and(eq(weekUnlocksTable.memberId, targetMemberId), eq(weekUnlocksTable.weekStart, ws)));

  if (!existing) {
    await db.insert(weekUnlocksTable).values({
      memberId: targetMemberId,
      weekStart: ws,
      unlockedById: callerId,
    });
  }

  res.json({ ok: true, memberId: targetMemberId, weekStart: ws });
});

// Alias: POST /habits/unlock → same as /habits/spiritual/unlock
router.post("/habits/unlock", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;

  const [caller] = await db
    .select({ role: membersTable.role })
    .from(membersTable)
    .where(eq(membersTable.id, callerId));
  if (!caller || caller.role !== "Admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  const { weekStart, memberId: bodyMemberId } = req.body ?? {};
  if (!weekStart) {
    res.status(400).json({ error: "weekStart required" });
    return;
  }
  const targetMemberId: number = bodyMemberId ?? callerId;
  const ws = getWeekStart(weekStart);

  const [existing] = await db
    .select({ id: weekUnlocksTable.id })
    .from(weekUnlocksTable)
    .where(and(eq(weekUnlocksTable.memberId, targetMemberId), eq(weekUnlocksTable.weekStart, ws)));

  if (!existing) {
    await db.insert(weekUnlocksTable).values({
      memberId: targetMemberId,
      weekStart: ws,
      unlockedById: callerId,
    });
  }

  res.json({ ok: true, memberId: targetMemberId, weekStart: ws });
});

// ─── PERSONAL HABIT STREAK RECALCULATION ──────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Recalculates the current streak for a personal habit.
 *
 * @param personalHabitId - the habit to update
 * @param memberId        - owner
 * @param clientDate      - the member's local calendar date (YYYY-MM-DD) at the
 *                          time they submitted the log.  When the server runs in
 *                          UTC and the member is in a timezone that is behind UTC,
 *                          the server's "today" can be one day ahead of the
 *                          member's "today".  Passing clientDate lets us anchor
 *                          the streak walk to the member's local date instead of
 *                          the server clock, preventing a false streak-break for
 *                          members who log late in the evening in their timezone.
 *                          Accepted only when it equals exactly serverToday − 1
 *                          day; any larger gap uses serverToday (logging for an
 *                          old past day should not shift the anchor).
 */
async function recalcPersonalHabitStreak(
  personalHabitId: number,
  memberId: number,
  clientDate?: string,
): Promise<void> {
  const logs = await db
    .select({ logDate: personalHabitLogsTable.logDate })
    .from(personalHabitLogsTable)
    .where(and(
      eq(personalHabitLogsTable.personalHabitId, personalHabitId),
      eq(personalHabitLogsTable.memberId, memberId),
      eq(personalHabitLogsTable.completed, true),
    ));

  const completedDates = new Set(logs.map((l) => l.logDate));

  // Determine the anchor date for "today".
  // Default: server's current UTC calendar date.
  const serverNow = new Date();
  const serverToday = toDateStr(serverNow);

  // Accept the client's local date as the anchor only when it is exactly one
  // calendar day behind the server.  This covers members whose local midnight
  // hasn't arrived yet while the server's UTC clock has already rolled over.
  // A gap of more than one day means the member is logging a genuinely past
  // day, so we keep serverToday as the anchor (the streak will be evaluated
  // from today regardless).
  let anchor = serverToday;
  if (clientDate && clientDate < serverToday) {
    const serverYesterday = new Date(serverNow.getFullYear(), serverNow.getMonth(), serverNow.getDate() - 1);
    if (clientDate === toDateStr(serverYesterday)) {
      anchor = clientDate;
    }
  }

  let streak = 0;
  const [anchorYear, anchorMonth, anchorDay] = anchor.split("-").map(Number);
  for (let i = 0; i < 3650; i++) {
    const d = new Date(anchorYear, anchorMonth - 1, anchorDay - i);
    const dateStr = toDateStr(d);
    if (completedDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  await db
    .update(personalHabitsTable)
    .set({ currentStreak: streak })
    .where(and(eq(personalHabitsTable.id, personalHabitId), eq(personalHabitsTable.memberId, memberId)));
}

// ─── PERSONAL HABITS ──────────────────────────────────────────────────────────

router.get("/habits/personal", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const today = new Date().toISOString().split("T")[0];
  const habits = await db.select().from(personalHabitsTable)
    .where(and(eq(personalHabitsTable.memberId, memberId), eq(personalHabitsTable.isActive, true)));

  const todayLogs = await db.select().from(personalHabitLogsTable)
    .where(and(
      eq(personalHabitLogsTable.memberId, memberId),
      eq(personalHabitLogsTable.logDate, today),
      eq(personalHabitLogsTable.completed, true),
    ));

  const completedIds = new Set(todayLogs.map((l) => l.personalHabitId));
  const habitsWithStatus = habits.map((h) => ({ ...h, todayCompleted: completedIds.has(h.id) }));
  res.json(habitsWithStatus);
});

router.post("/habits/personal", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { habitCode, habitName, aspect, frequency, description, isCustom = false, boundType, targetValue, targetUnit } = req.body ?? {};
  if (!habitCode || !habitName || !aspect || !frequency) {
    res.status(400).json({ error: "habitCode, habitName, aspect, frequency required" });
    return;
  }

  const [habit] = await db.insert(personalHabitsTable).values({
    memberId, habitCode, habitName, aspect, frequency, description, isCustom,
    isActive: true, stellarFragments: 0, currentStreak: 0,
    boundType: boundType ?? null, targetValue: targetValue ?? null, targetUnit: targetUnit ?? null,
  }).returning();
  res.status(201).json(habit);
});

router.delete("/habits/personal/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(personalHabitsTable).set({ isActive: false }).where(
    and(eq(personalHabitsTable.id, id), eq(personalHabitsTable.memberId, memberId))
  );
  res.sendStatus(204);
});

router.get("/habits/personal/week", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  // Derive week start (Sunday). Accepts ?weekStart=YYYY-MM-DD (Sunday).
  let sunday: Date;
  if (typeof req.query.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)) {
    sunday = new Date(req.query.weekStart + "T00:00:00");
  } else {
    sunday = new Date();
    sunday.setDate(sunday.getDate() - sunday.getDay());
  }

  const weekDates: string[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + d);
    weekDates.push(day.toISOString().split("T")[0]);
  }
  const [weekStart, weekEnd] = [weekDates[0], weekDates[6]];

  const habits = await db.select().from(personalHabitsTable)
    .where(and(eq(personalHabitsTable.memberId, memberId), eq(personalHabitsTable.isActive, true)));

  if (habits.length === 0) { res.json([]); return; }

  const { gte, lte } = await import("drizzle-orm");
  const logs = await db.select().from(personalHabitLogsTable)
    .where(and(
      eq(personalHabitLogsTable.memberId, memberId),
      gte(personalHabitLogsTable.logDate, weekStart),
      lte(personalHabitLogsTable.logDate, weekEnd),
    ));

  const logMap = new Map<string, typeof logs[0]>();
  for (const log of logs) {
    logMap.set(`${log.personalHabitId}:${log.logDate}`, log);
  }

  const result = habits.map((h) => {
    const weekLogs = weekDates.map((date, dayOfWeek) => {
      const existing = logMap.get(`${h.id}:${date}`);
      return {
        dayOfWeek,
        logDate: date,
        completed: existing?.completed ?? false,
        compliant: existing?.compliant ?? false,
        committed: existing?.committed ?? false,
        durationMinutes: existing?.durationMinutes ?? null,
        metricValue: existing?.metricValue ?? null,
        notes: existing?.notes ?? null,
      };
    });
    return {
      id: h.id,
      habitCode: h.habitCode,
      habitName: h.habitName,
      aspect: h.aspect,
      frequency: h.frequency,
      description: h.description,
      isCustom: h.isCustom,
      stellarFragments: h.stellarFragments,
      currentStreak: h.currentStreak,
      boundType: h.boundType,
      targetValue: h.targetValue,
      targetUnit: h.targetUnit,
      createdAt: h.createdAt.toISOString().split("T")[0],
      weekLogs,
    };
  });

  res.json(result);
});

router.post("/habits/personal/:id/log", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const personalHabitId = parseInt(raw, 10);

  const { logDate, completed = false, compliant = false, committed = false, durationMinutes, metricValue, notes } = req.body ?? {};
  if (!logDate) {
    res.status(400).json({ error: "logDate required" });
    return;
  }

  // Strict YYYY-MM-DD format check
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(logDate)) {
    res.status(400).json({ error: "Invalid logDate: must be YYYY-MM-DD" });
    return;
  }
  // Round-trip calendar check: catch impossible dates like 2024-02-31 (rolls over in Date ctor)
  const [yearStr, monthStr, dayStr] = (logDate as string).split("-");
  const logYear = parseInt(yearStr, 10);
  const logMonth = parseInt(monthStr, 10); // 1-12
  const logDay = parseInt(dayStr, 10);
  const logDateObj = new Date(logYear, logMonth - 1, logDay);
  if (
    logDateObj.getFullYear() !== logYear ||
    logDateObj.getMonth() + 1 !== logMonth ||
    logDateObj.getDate() !== logDay
  ) {
    res.status(400).json({ error: "Invalid logDate: not a real calendar date" });
    return;
  }

  // Reject future dates — compare day-level local Date objects
  const now = new Date();
  const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (logDateObj > todayObj) {
    res.status(400).json({ error: "logDate cannot be in the future" });
    return;
  }

  const [habit] = await db.select().from(personalHabitsTable)
    .where(and(eq(personalHabitsTable.id, personalHabitId), eq(personalHabitsTable.memberId, memberId)));
  if (!habit) {
    res.status(404).json({ error: "Personal habit not found" });
    return;
  }

  // Reject dates before habit was created — extract UTC date from ISO string, compare as local Date
  const createdAt = habit.createdAt instanceof Date ? habit.createdAt : new Date(String(habit.createdAt));
  const [cy, cm, cd] = createdAt.toISOString().split("T")[0].split("-").map(Number);
  const habitCreatedDayObj = new Date(cy, cm - 1, cd);
  if (logDateObj < habitCreatedDayObj) {
    res.status(400).json({ error: "logDate cannot be before the habit was created" });
    return;
  }

  const [existing] = await db.select().from(personalHabitLogsTable)
    .where(and(
      eq(personalHabitLogsTable.personalHabitId, personalHabitId),
      eq(personalHabitLogsTable.memberId, memberId),
      eq(personalHabitLogsTable.logDate, logDate),
    ));

  if (existing) {
    const [updated] = await db.update(personalHabitLogsTable)
      .set({ completed, compliant, committed, durationMinutes: durationMinutes ?? null, metricValue: metricValue ?? null, notes: notes ?? null, stellarFragmentsEarned: completed ? 1 : 0 })
      .where(eq(personalHabitLogsTable.id, existing.id))
      .returning();
    await Promise.all([
      recalcMemberStats(memberId),
      recalcPersonalHabitStreak(personalHabitId, memberId, logDate as string),
    ]);
    res.status(201).json(updated);
    return;
  }

  const [log] = await db.insert(personalHabitLogsTable).values({
    personalHabitId, memberId, logDate, completed, compliant, committed,
    durationMinutes: durationMinutes ?? null, metricValue: metricValue ?? null, notes: notes ?? null,
    stellarFragmentsEarned: completed ? 1 : 0,
  }).returning();
  await Promise.all([
    recalcMemberStats(memberId),
    recalcPersonalHabitStreak(personalHabitId, memberId, logDate as string),
  ]);
  res.status(201).json(log);
});

// ─── SHARING HABITS ───────────────────────────────────────────────────────────

router.get("/habits/sharing", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const preparations = await db.select().from(sharingPreparationsTable).where(eq(sharingPreparationsTable.memberId, memberId));
  const attempts = await db.select().from(sharingAttemptsTable).where(eq(sharingAttemptsTable.memberId, memberId));
  const bearings = await db.select().from(bearingResultsTable).where(eq(bearingResultsTable.memberId, memberId));

  // Determine level from stellar status
  const levelMap: Record<string, number> = { SBG: 1, P2S: 2, S2B: 3, P2G: 3 };
  const level = levelMap[member?.stellarStatus ?? "SBG"] ?? 1;

  res.json({
    level,
    preparations,
    attempts,
    bearings,
    totalBearings: bearings.length,
  });
});

router.post("/habits/sharing/preparation", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { weekStart, lessonReviewed = false, scriptPrepared = false, prayedForTarget = false, confidenceStatus = false } = req.body ?? {};
  const ws = getWeekStart(weekStart);

  const [existing] = await db.select().from(sharingPreparationsTable)
    .where(and(eq(sharingPreparationsTable.memberId, memberId), eq(sharingPreparationsTable.weekStart, ws)));

  if (existing) {
    const [updated] = await db.update(sharingPreparationsTable)
      .set({ lessonReviewed, scriptPrepared, prayedForTarget, confidenceStatus })
      .where(eq(sharingPreparationsTable.id, existing.id)).returning();
    res.status(201).json(updated);
    return;
  }

  const [prep] = await db.insert(sharingPreparationsTable).values({
    memberId, weekStart: ws, lessonReviewed, scriptPrepared, prayedForTarget, confidenceStatus,
  }).returning();
  res.status(201).json(prep);
});

router.post("/habits/sharing/attempt", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { attemptDate, targetName, sharingMethod, expectedResponseDate, followUpDate, result } = req.body ?? {};
  if (!attemptDate || !targetName) {
    res.status(400).json({ error: "attemptDate and targetName required" });
    return;
  }

  const [attempt] = await db.insert(sharingAttemptsTable).values({
    memberId, attemptDate, targetName, sharingMethod, expectedResponseDate, followUpDate, result,
  }).returning();
  res.status(201).json(attempt);
});

router.post("/habits/sharing/bearing", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { bearingDate, believerName } = req.body ?? {};
  if (!bearingDate || !believerName) {
    res.status(400).json({ error: "bearingDate and believerName required" });
    return;
  }

  const [bearing] = await db.insert(bearingResultsTable).values({ memberId, bearingDate, believerName }).returning();
  res.status(201).json(bearing);
});

export default router;
