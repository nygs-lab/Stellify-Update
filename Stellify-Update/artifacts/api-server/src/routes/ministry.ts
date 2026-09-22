import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import {
  db,
  membersTable,
  spiritualHabitLogsTable,
  gotLogsTable,
  worshipAttendanceLogsTable,
  biblicalNotesLogsTable,
  cgAttendanceLogsTable,
  sharingHuddleLogsTable,
  personalHabitsTable,
  personalHabitLogsTable,
  sharingPreparationsTable,
  sharingAttemptsTable,
  bearingResultsTable,
  cgAuditSummariesTable,
  churchAuditSummariesTable,
  memberRemindersTable,
  notificationsTable,
} from "@workspace/db";

const router: IRouter = Router();

type MemberRow = typeof membersTable.$inferSelect;

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.memberId ?? req.memberId;
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return id;
}

async function requireAuthAndRole(
  req: any,
  res: any,
  allowedRoles: string[],
): Promise<MemberRow | null> {
  const memberId = requireAuth(req, res);
  if (!memberId) return null;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!me) {
    res.status(401).json({ error: "Member not found" });
    return null;
  }

  // Check primary role, additional ministry roles, AND familyRole (e.g. FamilyLeader)
  const additionalRoles = (me.ministryRoles as string[] | null) ?? [];
  const allRoles = [me.role, ...additionalRoles];
  if (me.familyRole) allRoles.push(me.familyRole);
  if (!allowedRoles.some(r => allRoles.includes(r))) {
    res.status(403).json({ error: "Forbidden: insufficient role" });
    return null;
  }
  return me;
}

function getWeekStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  const sunday = new Date(d);
  sunday.setDate(diff);
  return sunday.toISOString().split("T")[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

function getCurrentMonth(monthStr?: string): string {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

async function buildComplianceRow(m: typeof membersTable.$inferSelect, weekStart: string) {
  const weekEnd = getWeekEnd(weekStart);

  const [prayer] = await db.select().from(spiritualHabitLogsTable)
    .where(and(
      eq(spiritualHabitLogsTable.memberId, m.id),
      eq(spiritualHabitLogsTable.habitCode, "SHC001"),
      eq(spiritualHabitLogsTable.weekStart, weekStart),
    ));

  const [devotion] = await db.select().from(spiritualHabitLogsTable)
    .where(and(
      eq(spiritualHabitLogsTable.memberId, m.id),
      eq(spiritualHabitLogsTable.habitCode, "SHC002"),
      eq(spiritualHabitLogsTable.weekStart, weekStart),
    ));

  const [got] = await db.select().from(gotLogsTable)
    .where(and(eq(gotLogsTable.memberId, m.id), eq(gotLogsTable.weekStart, weekStart)));

  const [worship] = await db.select().from(worshipAttendanceLogsTable)
    .where(and(
      eq(worshipAttendanceLogsTable.memberId, m.id),
      eq(worshipAttendanceLogsTable.attendanceDate, weekStart),
    ));

  const biblicalInWeek = await db.select().from(biblicalNotesLogsTable)
    .where(and(
      eq(biblicalNotesLogsTable.memberId, m.id),
      eq(biblicalNotesLogsTable.isDone, true),
      gte(biblicalNotesLogsTable.noteDate, weekStart),
      lte(biblicalNotesLogsTable.noteDate, weekEnd),
    ));

  const cgAttInWeek = await db.select().from(cgAttendanceLogsTable)
    .where(and(
      eq(cgAttendanceLogsTable.memberId, m.id),
      gte(cgAttendanceLogsTable.attendanceDate, weekStart),
      lte(cgAttendanceLogsTable.attendanceDate, weekEnd),
    ));

  const huddleInWeek = await db.select().from(sharingHuddleLogsTable)
    .where(and(
      eq(sharingHuddleLogsTable.memberId, m.id),
      gte(sharingHuddleLogsTable.huddleDate, weekStart),
      lte(sharingHuddleLogsTable.huddleDate, weekEnd),
    ));

  const activeHabits = await db.select().from(personalHabitsTable)
    .where(and(eq(personalHabitsTable.memberId, m.id), eq(personalHabitsTable.isActive, true)));

  let personalDone = 0;
  if (activeHabits.length > 0) {
    const logs = await db.select().from(personalHabitLogsTable)
      .where(and(
        eq(personalHabitLogsTable.memberId, m.id),
        eq(personalHabitLogsTable.completed, true),
        gte(personalHabitLogsTable.logDate, weekStart),
        lte(personalHabitLogsTable.logDate, weekEnd),
      ));
    const done = new Set(logs.map(l => l.personalHabitId));
    personalDone = done.size;
  }

  const prayerDays = JSON.parse(prayer?.daysJson ?? "[]") as Array<{ completed: boolean }>;
  const devotionDays = JSON.parse(devotion?.daysJson ?? "[]") as Array<{ completed: boolean }>;

  return {
    memberId: m.id,
    churchId: m.churchId,
    firstName: m.firstName,
    lastName: m.lastName,
    stellarStatus: m.stellarStatus,
    prayerCompleted: prayerDays.some(d => d.completed),
    devotionCompleted: devotionDays.some(d => d.completed),
    worshipAttended: worship?.attended ?? false,
    gotSubmitted: !!got,
    biblicalDone: biblicalInWeek.length > 0,
    cgAttended: cgAttInWeek.some(r => r.attended),
    huddleAttended: huddleInWeek.some(r => r.attended),
    personalDone,
    personalTotal: activeHabits.length,
    stellarFragments: m.stellarFragments,
    currentStreak: m.currentStreak,
  };
}

function pct(rows: Array<Record<string, unknown>>, key: string): number {
  if (rows.length === 0) return 0;
  return (rows.filter(r => r[key]).length / rows.length) * 100;
}

function getGroupMapping(me: MemberRow, role: string, fallback: string | null): string {
  const mappings = me.roleGroupMappings as Record<string, string> | null;
  return mappings?.[role] ?? fallback ?? "Unknown";
}

function buildHubSummary(cgNumber: string, weekStart: string, rows: Awaited<ReturnType<typeof buildComplianceRow>>[]) {
  return {
    cgNumber,
    weekStart,
    totalMembers: rows.length,
    prayerCompliance: pct(rows, "prayerCompleted"),
    devotionCompliance: pct(rows, "devotionCompleted"),
    worshipCompliance: pct(rows, "worshipAttended"),
    gotCompliance: pct(rows, "gotSubmitted"),
    biblicalCompliance: pct(rows, "biblicalDone"),
    cgAttendanceCompliance: pct(rows, "cgAttended"),
    huddleCompliance: pct(rows, "huddleAttended"),
    members: rows,
  };
}

// ─── GET /ministry/caring ─── Servant sees their CG; Admin/Pastor see all CGs church-wide ──
router.get("/ministry/caring", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "Admin", "Pastor"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);
  const effectiveRolesC = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isAdminOrPastorC = effectiveRolesC.includes("Admin") || effectiveRolesC.includes("Pastor");

  // Admin/Pastor get church-wide compliance (all active members regardless of CG).
  // Servants are scoped to their mapped CG via roleGroupMappings.
  let cgMembers: typeof membersTable.$inferSelect[];
  let cgNumber: string;
  if (isAdminOrPastorC) {
    cgMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
    cgNumber = "ALL";
  } else {
    cgNumber = getGroupMapping(me, "Servant", me.cgNumber);
    cgMembers = await db.select().from(membersTable)
      .where(and(eq(membersTable.cgNumber, cgNumber), eq(membersTable.status, "Active")));
  }

  const rows = await Promise.all(cgMembers.map(m => buildComplianceRow(m, weekStart)));
  res.json(buildHubSummary(cgNumber, weekStart, rows));
});

// ─── GET /ministry/family ─── FamilyLeader sees their family group ────────────
router.get("/ministry/family", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor", "Servant", "Member", "FamilyLeader"]);
  if (!me) return;

  const extraRoles = (me.ministryRoles as string[] | null) ?? [];
  // Admin/Pastor bypass — check both primary role and ministryRoles for full-access roles.
  const isAdminOrPastor = ["Admin", "Pastor"].includes(me.role) || extraRoles.includes("Admin") || extraRoles.includes("Pastor");
  if (!isAdminOrPastor && !extraRoles.includes("FamilyLeader") && me.familyRole !== "FamilyLeader") {
    res.status(403).json({ error: "Access denied: FamilyLeader role required" });
    return;
  }

  const weekStart = getWeekStart(req.query.weekStart as string);

  // Admin/Pastor get church-wide view across all family groups; FamilyLeaders see their own group.
  let familyMembers: typeof membersTable.$inferSelect[];
  let familyGroupNumber: string;
  if (isAdminOrPastor) {
    familyMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
    familyGroupNumber = "ALL";
  } else {
    familyGroupNumber = getGroupMapping(me, "FamilyLeader", me.familyGroupNumber);
    familyMembers = await db.select().from(membersTable)
      .where(and(eq(membersTable.familyGroupNumber, familyGroupNumber), eq(membersTable.status, "Active")));
  }

  const rows = await Promise.all(familyMembers.map(m => buildComplianceRow(m, weekStart)));

  res.json({
    familyGroupNumber,
    weekStart,
    totalMembers: familyMembers.length,
    prayerCompliance: pct(rows, "prayerCompleted"),
    devotionCompliance: pct(rows, "devotionCompleted"),
    worshipCompliance: pct(rows, "worshipAttended"),
    gotCompliance: pct(rows, "gotSubmitted"),
    biblicalCompliance: pct(rows, "biblicalDone"),
    cgAttendanceCompliance: pct(rows, "cgAttended"),
    huddleCompliance: pct(rows, "huddleAttended"),
    members: rows,
  });
});

// ─── GET /ministry/sharing ─── Captain sees their huddle; Admin/Pastor see all huddles church-wide ───
router.get("/ministry/sharing", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["SharingCaptain", "Admin", "Pastor"]);
  if (!me) return;

  const month = getCurrentMonth(req.query.month as string);
  const { start, end } = monthDateRange(month);
  const effectiveRolesS = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isAdminOrPastorS = effectiveRolesS.includes("Admin") || effectiveRolesS.includes("Pastor");

  // Admin/Pastor see all sharing progress church-wide; SharingCaptains see their mapped huddle only.
  let huddleMembers: typeof membersTable.$inferSelect[];
  let huddleNumber: string;
  if (isAdminOrPastorS) {
    huddleMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
    huddleNumber = "ALL";
  } else {
    huddleNumber = getGroupMapping(me, "SharingCaptain", me.sharingHuddleNumber);
    huddleMembers = await db.select().from(membersTable)
      .where(and(eq(membersTable.sharingHuddleNumber, huddleNumber), eq(membersTable.status, "Active")));
  }

  const memberRows = await Promise.all(huddleMembers.map(async (m) => {
    const preps = await db.select().from(sharingPreparationsTable)
      .where(and(
        eq(sharingPreparationsTable.memberId, m.id),
        gte(sharingPreparationsTable.weekStart, start),
        lte(sharingPreparationsTable.weekStart, end),
      ));
    const attempts = await db.select().from(sharingAttemptsTable)
      .where(and(
        eq(sharingAttemptsTable.memberId, m.id),
        gte(sharingAttemptsTable.attemptDate, start),
        lte(sharingAttemptsTable.attemptDate, end),
      ));
    const bearings = await db.select().from(bearingResultsTable)
      .where(and(
        eq(bearingResultsTable.memberId, m.id),
        gte(bearingResultsTable.bearingDate, start),
        lte(bearingResultsTable.bearingDate, end),
      ));
    return {
      memberId: m.id,
      churchId: m.churchId,
      firstName: m.firstName,
      lastName: m.lastName,
      stellarStatus: m.stellarStatus,
      preparations: preps.length,
      attempts: attempts.length,
      bearings: bearings.length,
      stellarFragments: m.stellarFragments,
    };
  }));

  res.json({
    sharingHuddleNumber: huddleNumber,
    month,
    totalMembers: huddleMembers.length,
    totalPreparations: memberRows.reduce((s, m) => s + m.preparations, 0),
    totalAttempts: memberRows.reduce((s, m) => s + m.attempts, 0),
    totalBearings: memberRows.reduce((s, m) => s + m.bearings, 0),
    members: memberRows,
  });
});

// ─── Nudge scope validation helper ────────────────────────────────────────────
async function authorizeNudgeTarget(
  me: typeof membersTable.$inferSelect,
  targetId: number,
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): Promise<boolean> {
  const [target] = await db.select().from(membersTable).where(eq(membersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return false;
  }
  if (hasChurchWideRole(me)) return true;

  // Accumulate ALL eligible scope matches before deciding — a multi-role user is authorized
  // if the target falls in ANY of their authorized groups. Never short-circuit on first mismatch.
  const roles = [me.role, ...(Array.isArray(me.ministryRoles) ? (me.ministryRoles as string[]) : [])];
  const matches: boolean[] = [];

  if (roles.includes("Servant")) {
    const myGroup = getGroupMapping(me, "Servant", me.cgNumber);
    matches.push(target.cgNumber === myGroup);
  }
  if (roles.includes("SharingCaptain")) {
    const myGroup = getGroupMapping(me, "SharingCaptain", me.sharingHuddleNumber);
    matches.push(target.sharingHuddleNumber === myGroup);
  }
  if (me.familyRole === "FamilyLeader" || roles.includes("FamilyLeader")) {
    const myGroup = getGroupMapping(me, "FamilyLeader", me.familyGroupNumber);
    matches.push(target.familyGroupNumber === myGroup);
  }

  if (matches.length === 0 || !matches.some(Boolean)) {
    res.status(403).json({ error: "Cannot nudge members outside your authorized groups" });
    return false;
  }
  return true;
}

async function insertNudge(me: typeof membersTable.$inferSelect, targetId: number, message?: string, weekStart?: string) {
  await db.insert(memberRemindersTable).values({
    memberId: targetId,
    sentById: me.id,
    message: message ?? null,
    weekStart: weekStart ?? null,
  });
  await db.insert(notificationsTable).values({
    recipientId: targetId,
    type: "reminder",
    message: message ?? "Please complete your spiritual habits for this week.",
  });
}

// ─── POST /ministry/nudge ─── Scoped nudge (Servant|SharingCaptain|FamilyLeader|Admin|Pastor)
// CgAuditor and ChurchAuditor are excluded by design — they see financial summary data only
// (treasury/cg and treasury/church) with no individual member compliance rows to act on.
router.post("/ministry/nudge", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "SharingCaptain", "FamilyLeader", "Admin", "Pastor"]);
  if (!me) return;

  const { memberId, message, weekStart } = req.body as {
    memberId: number;
    message?: string;
    weekStart?: string;
  };

  const targetId = typeof memberId === "number" ? memberId : parseInt(memberId as any, 10);
  if (!targetId) { res.status(400).json({ error: "memberId required" }); return; }

  const ok = await authorizeNudgeTarget(me, targetId, res);
  if (!ok) return;

  await insertNudge(me, targetId, message, weekStart);
  res.json({ ok: true });
});

// ─── POST /ministry/remind ─── Legacy alias for /ministry/nudge (Servant/Pastor/Admin)
router.post("/ministry/remind", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "SharingCaptain", "FamilyLeader", "Admin", "Pastor"]);
  if (!me) return;

  const { memberId, message, weekStart } = req.body as {
    memberId: number;
    message?: string;
    weekStart?: string;
  };

  const targetId = typeof memberId === "number" ? memberId : parseInt(memberId as any, 10);
  if (!targetId) { res.status(400).json({ error: "memberId required" }); return; }

  const ok = await authorizeNudgeTarget(me, targetId, res);
  if (!ok) return;

  await insertNudge(me, targetId, message, weekStart);
  res.json({ ok: true });
});

// ─── GET /ministry/pastor/overview ─── Pastor/Admin all-CGs compliance ─────────
router.get("/ministry/pastor/overview", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Pastor", "Admin"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);

  const allMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
  const cgNumbers = [...new Set(allMembers.map(m => m.cgNumber).filter(Boolean))] as string[];

  const cgs = await Promise.all(cgNumbers.map(async (cgNumber) => {
    const cgMembers = allMembers.filter(m => m.cgNumber === cgNumber);
    const rows = await Promise.all(cgMembers.map(m => buildComplianceRow(m, weekStart)));
    return {
      cgNumber,
      totalMembers: cgMembers.length,
      prayerCompliance: pct(rows, "prayerCompleted"),
      devotionCompliance: pct(rows, "devotionCompleted"),
      worshipCompliance: pct(rows, "worshipAttended"),
      gotCompliance: pct(rows, "gotSubmitted"),
      biblicalCompliance: pct(rows, "biblicalDone"),
      cgAttendanceCompliance: pct(rows, "cgAttended"),
      huddleCompliance: pct(rows, "huddleAttended"),
      members: rows,
    };
  }));

  res.json({ weekStart, totalCgs: cgs.length, cgs });
});

// ─── GET /ministry/audit/cg ─── Admin/Pastor only — full church-wide compliance view ──────
// CgAuditors are financial-data-only; they access /ministry/treasury/cg instead.
router.get("/ministry/audit/cg", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);
  // Only Admin/Pastor can reach this route — always return church-wide compliance.
  const cgMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
  const rows = await Promise.all(cgMembers.map(m => buildComplianceRow(m, weekStart)));
  res.json(buildHubSummary("ALL", weekStart, rows));
});

// ─── POST /ministry/audit/cg ─── Servant submits weekly CG narrative summary ──
// CgAuditors are financial-data-only; they do not submit narrative summaries.
router.post("/ministry/audit/cg", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "Admin", "Pastor"]);
  if (!me) return;

  const { weekStart, summary, observations } = req.body as {
    weekStart: string;
    summary: string;
    observations?: string;
  };

  if (!weekStart || !summary) {
    res.status(400).json({ error: "weekStart and summary are required" });
    return;
  }

  // Servants are scoped to their mapped CG; Admin/Pastor can post church-wide ("ALL").
  const effectiveRolesAC = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isAdminOrPastorAC = effectiveRolesAC.includes("Admin") || effectiveRolesAC.includes("Pastor");
  const cgNumber = isAdminOrPastorAC ? "ALL" : getGroupMapping(me, "Servant", me.cgNumber);

  const [record] = await db.insert(cgAuditSummariesTable).values({
    cgNumber,
    weekStart,
    summary,
    observations: observations ?? null,
    submittedById: me.id,
    status: "pending",
  }).returning();

  res.status(201).json({
    id: record.id,
    cgNumber: record.cgNumber,
    weekStart: record.weekStart,
    summary: record.summary,
    observations: record.observations,
    submittedAt: record.submittedAt.toISOString(),
    status: record.status,
  });
});

// ─── GET /ministry/audit/cg/history ─── Servant past CG narrative submissions ─
// CgAuditors are financial-data-only; history access uses Servant mapping.
router.get("/ministry/audit/cg/history", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "Admin", "Pastor"]);
  if (!me) return;

  // Admin/Pastor see all CG summaries church-wide; Servants see their mapped CG only.
  const effectiveRolesACH = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isAdminOrPastorACH = effectiveRolesACH.includes("Admin") || effectiveRolesACH.includes("Pastor");

  const records = isAdminOrPastorACH
    ? await db.select().from(cgAuditSummariesTable).orderBy(desc(cgAuditSummariesTable.submittedAt))
    : await db.select().from(cgAuditSummariesTable)
        .where(eq(cgAuditSummariesTable.cgNumber, getGroupMapping(me, "Servant", me.cgNumber)))
        .orderBy(desc(cgAuditSummariesTable.submittedAt));

  res.json(records.map(r => ({
    id: r.id,
    cgNumber: r.cgNumber,
    weekStart: r.weekStart,
    summary: r.summary,
    observations: r.observations,
    submittedAt: r.submittedAt.toISOString(),
    status: r.status,
  })));
});

// ─── GET /ministry/audit/church ─── Admin/Pastor sees narrative CG summaries ─────
// ChurchAuditor is financial-only; they access /treasury/church for financial data.
router.get("/ministry/audit/church", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);

  const cgSummaries = await db.select().from(cgAuditSummariesTable)
    .where(eq(cgAuditSummariesTable.weekStart, weekStart))
    .orderBy(cgAuditSummariesTable.cgNumber);

  const [existing] = await db.select().from(churchAuditSummariesTable)
    .where(eq(churchAuditSummariesTable.weekStart, weekStart))
    .orderBy(desc(churchAuditSummariesTable.submittedAt))
    .limit(1);

  const mapCg = (r: typeof cgSummaries[number]) => ({
    id: r.id,
    cgNumber: r.cgNumber,
    weekStart: r.weekStart,
    summary: r.summary,
    observations: r.observations,
    submittedAt: r.submittedAt.toISOString(),
    status: r.status,
  });

  res.json({
    weekStart,
    cgSummaries: cgSummaries.map(mapCg),
    existingChurchSummary: existing
      ? {
          id: existing.id,
          weekStart: existing.weekStart,
          summary: existing.summary,
          observations: existing.observations,
          totalCgsReported: existing.totalCgsReported,
          submittedAt: existing.submittedAt.toISOString(),
        }
      : null,
  });
});

// ─── POST /ministry/audit/church ─── Admin/Pastor submits church narrative report ─
router.post("/ministry/audit/church", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor"]);
  if (!me) return;

  const { weekStart, summary, observations, totalCgsReported } = req.body as {
    weekStart: string;
    summary: string;
    observations?: string;
    totalCgsReported?: number;
  };

  if (!weekStart || !summary) {
    res.status(400).json({ error: "weekStart and summary are required" });
    return;
  }

  const [record] = await db.insert(churchAuditSummariesTable).values({
    weekStart,
    summary,
    observations: observations ?? null,
    totalCgsReported: totalCgsReported ?? null,
    submittedById: me.id,
  }).returning();

  res.status(201).json({
    id: record.id,
    weekStart: record.weekStart,
    summary: record.summary,
    observations: record.observations,
    totalCgsReported: record.totalCgsReported,
    submittedAt: record.submittedAt.toISOString(),
  });
});

// ─── GET /ministry/audit/church/history ─── Admin/Pastor past church reports ────
router.get("/ministry/audit/church/history", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor"]);
  if (!me) return;

  const records = await db.select().from(churchAuditSummariesTable)
    .orderBy(desc(churchAuditSummariesTable.submittedAt));

  res.json(records.map(r => ({
    id: r.id,
    weekStart: r.weekStart,
    summary: r.summary,
    observations: r.observations,
    totalCgsReported: r.totalCgsReported,
    submittedAt: r.submittedAt.toISOString(),
  })));
});

// ─── Treasury routes ──────────────────────────────────────────────────────────
router.get("/ministry/treasury/cg", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Servant", "CgAuditor", "Admin", "Pastor"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);
  // Scope by effective roles (primary + ministryRoles) — handles users whose CgAuditor authority
  // is in ministryRoles rather than their primary role.
  const effectiveTreasuryRoles = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isAdminOrPastorT = effectiveTreasuryRoles.includes("Admin") || effectiveTreasuryRoles.includes("Pastor");
  const treasuryGroupKey = effectiveTreasuryRoles.includes("CgAuditor") ? "CgAuditor" : "Servant";

  // Admin/Pastor see all CGs church-wide; Servants/CgAuditors are scoped to their mapped CG.
  let cgMembers: typeof membersTable.$inferSelect[];
  let cgNumber: string;
  if (isAdminOrPastorT) {
    cgMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
    cgNumber = "ALL";
  } else {
    cgNumber = getGroupMapping(me, treasuryGroupKey, me.cgNumber);
    cgMembers = await db.select().from(membersTable)
      .where(and(eq(membersTable.cgNumber, cgNumber), eq(membersTable.status, "Active")));
  }

  const entries = await Promise.all(cgMembers.map(async (m) => {
    const [got] = await db.select().from(gotLogsTable)
      .where(and(eq(gotLogsTable.memberId, m.id), eq(gotLogsTable.weekStart, weekStart)));
    return {
      memberId: m.id,
      churchId: m.churchId,
      firstName: m.firstName,
      lastName: m.lastName,
      giftAmount: got?.giftAmount ? parseFloat(String(got.giftAmount)) : null,
      offeringAmount: got?.offeringAmount ? parseFloat(String(got.offeringAmount)) : null,
      tithesAmount: got?.tithesAmount ? parseFloat(String(got.tithesAmount)) : null,
      bobDeduction: got?.bobDeduction ? parseFloat(String(got.bobDeduction)) : null,
      totalSubmission: got?.totalSubmission ? parseFloat(String(got.totalSubmission)) : null,
    };
  }));

  const sum = (key: "giftAmount" | "offeringAmount" | "tithesAmount" | "bobDeduction" | "totalSubmission") =>
    entries.reduce((s, e) => s + (e[key] ?? 0), 0);

  res.json({
    cgNumber, weekStart, entries,
    totalGift: sum("giftAmount"),
    totalOffering: sum("offeringAmount"),
    totalTithes: sum("tithesAmount"),
    totalBob: sum("bobDeduction"),
    grandTotal: sum("totalSubmission"),
    isFinalized: false,
  });
});

router.get("/ministry/treasury/church", async (req, res): Promise<void> => {
  const me = await requireAuthAndRole(req, res, ["Admin", "Pastor", "ChurchAuditor"]);
  if (!me) return;

  const weekStart = getWeekStart(req.query.weekStart as string);
  const allMembers = await db.select().from(membersTable).where(eq(membersTable.status, "Active"));
  const cgNumbers = [...new Set(allMembers.map(m => m.cgNumber).filter(Boolean))] as string[];

  const cgSummaries = await Promise.all(cgNumbers.map(async (cgNumber) => {
    const cgMembers = allMembers.filter(m => m.cgNumber === cgNumber);
    const entries = await Promise.all(cgMembers.map(async (m) => {
      const [got] = await db.select().from(gotLogsTable)
        .where(and(eq(gotLogsTable.memberId, m.id), eq(gotLogsTable.weekStart, weekStart)));
      return {
        memberId: m.id,
        churchId: m.churchId,
        firstName: m.firstName,
        lastName: m.lastName,
        giftAmount: got?.giftAmount ? parseFloat(String(got.giftAmount)) : null,
        offeringAmount: got?.offeringAmount ? parseFloat(String(got.offeringAmount)) : null,
        tithesAmount: got?.tithesAmount ? parseFloat(String(got.tithesAmount)) : null,
        bobDeduction: got?.bobDeduction ? parseFloat(String(got.bobDeduction)) : null,
        totalSubmission: got?.totalSubmission ? parseFloat(String(got.totalSubmission)) : null,
      };
    }));

    const sum = (key: "giftAmount" | "offeringAmount" | "tithesAmount" | "bobDeduction" | "totalSubmission") =>
      entries.reduce((s, e) => s + (e[key] ?? 0), 0);

    return {
      cgNumber,
      weekStart,
      entries,
      totalGift: sum("giftAmount"),
      totalOffering: sum("offeringAmount"),
      totalTithes: sum("tithesAmount"),
      totalBob: sum("bobDeduction"),
      grandTotal: sum("totalSubmission"),
      isFinalized: false,
    };
  }));

  const churchTotal = {
    totalGift: cgSummaries.reduce((s, cg) => s + cg.totalGift, 0),
    totalOffering: cgSummaries.reduce((s, cg) => s + cg.totalOffering, 0),
    totalTithes: cgSummaries.reduce((s, cg) => s + cg.totalTithes, 0),
    totalBob: cgSummaries.reduce((s, cg) => s + cg.totalBob, 0),
    grandTotal: cgSummaries.reduce((s, cg) => s + cg.grandTotal, 0),
  };

  // ChurchAuditor sees aggregate totals only — strip per-member entries from each CG summary.
  const effectiveCallerRoles = [me.role, ...((me.ministryRoles as string[] | null) ?? [])];
  const isChurchAuditorOnly =
    effectiveCallerRoles.includes("ChurchAuditor") &&
    !effectiveCallerRoles.includes("Admin") &&
    !effectiveCallerRoles.includes("Pastor");

  const responseCgSummaries = isChurchAuditorOnly
    ? cgSummaries.map(({ entries: _entries, ...totals }) => totals)
    : cgSummaries;

  res.json({ weekStart, cgSummaries: responseCgSummaries, churchTotal, isFinalized: false, expenses: [] });
});


// GOT financial audit — CgAuditor (CG-scoped) and core leadership only.
// ChurchAuditor sees church-wide treasury summaries (not per-member GOT records) via /treasury/church.
const AUDIT_ROLES = new Set(["Admin", "Pastor", "Servant", "CgAuditor"]);
// Habit/behavioral audit (Biblical Notes) — CgAuditor and ChurchAuditor are financial-only;
// neither may access non-financial habit data at the route layer.
const HABIT_AUDIT_ROLES = new Set(["Admin", "Pastor", "Servant"]);
// ChurchAuditor is intentionally excluded here — they get church-wide scope only
// on the /treasury/church financial endpoint (handled explicitly there), never on
// habit/compliance/narrative paths. Using CHURCH_WIDE_ROLES on non-financial paths
// must not broaden a multi-role ChurchAuditor+Servant user beyond their CG.
const CHURCH_WIDE_ROLES = new Set(["Admin", "Pastor"]);

// Check role against both the primary role and any additional ministry roles.
function hasAuditRole(caller: { role: string; ministryRoles?: unknown }): boolean {
  if (AUDIT_ROLES.has(caller.role)) return true;
  const extra = Array.isArray(caller.ministryRoles) ? (caller.ministryRoles as string[]) : [];
  return extra.some((r) => AUDIT_ROLES.has(r));
}

// Habit audit (Biblical Notes) — CgAuditors are financial-only, excluded here.
function hasHabitAuditRole(caller: { role: string; ministryRoles?: unknown }): boolean {
  if (HABIT_AUDIT_ROLES.has(caller.role)) return true;
  const extra = Array.isArray(caller.ministryRoles) ? (caller.ministryRoles as string[]) : [];
  return extra.some((r) => HABIT_AUDIT_ROLES.has(r));
}

function hasChurchWideRole(caller: { role: string; ministryRoles?: unknown }): boolean {
  if (CHURCH_WIDE_ROLES.has(caller.role)) return true;
  const extra = Array.isArray(caller.ministryRoles) ? (caller.ministryRoles as string[]) : [];
  return extra.some((r) => CHURCH_WIDE_ROLES.has(r));
}

async function getAuditMemberIds(caller: MemberRow): Promise<number[]> {
  if (hasChurchWideRole(caller)) {
    const all = await db.select({ id: membersTable.id }).from(membersTable).where(eq(membersTable.status, "Active"));
    return all.map((m) => m.id);
  }
  // Scope by effective roles — handles users whose ministry authority is in ministryRoles, not primary role.
  const effectiveAuditRoles = [caller.role, ...((caller.ministryRoles as string[] | null) ?? [])];
  const mappingKey = effectiveAuditRoles.includes("CgAuditor") ? "CgAuditor" : "Servant";
  const cgNumber = getGroupMapping(caller, mappingKey, caller.cgNumber);
  const cgMembers = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(and(eq(membersTable.cgNumber, cgNumber), eq(membersTable.status, "Active")));
  return cgMembers.map((m) => m.id);
}

router.get("/ministry/audit/got", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;
  const [caller] = await db.select().from(membersTable).where(eq(membersTable.id, callerId));
  if (!caller || !hasAuditRole(caller)) { res.status(403).json({ error: "Access denied." }); return; }
  const weekStart = getWeekStart(req.query.weekStart as string | undefined);
  const memberIds = await getAuditMemberIds(caller);
  if (memberIds.length === 0) { res.json({ weekStart, scope: caller.cgNumber ?? "all", entries: [], totalSubmission: 0 }); return; }
  const gotLogs = await db.select().from(gotLogsTable).where(and(inArray(gotLogsTable.memberId, memberIds), eq(gotLogsTable.weekStart, weekStart)));
  const members = await db.select({ id: membersTable.id, churchId: membersTable.churchId, firstName: membersTable.firstName, lastName: membersTable.lastName }).from(membersTable).where(inArray(membersTable.id, memberIds));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const entries = gotLogs.map((log) => {
    const m = memberMap.get(log.memberId);
    return {
      id: log.id, memberId: log.memberId, churchId: m?.churchId ?? "", firstName: m?.firstName ?? "", lastName: m?.lastName ?? "",
      weekStart: log.weekStart, giftAmount: log.giftAmount ? parseFloat(String(log.giftAmount)) : null,
      offeringAmount: log.offeringAmount ? parseFloat(String(log.offeringAmount)) : null,
      tithesAmount: log.tithesAmount ? parseFloat(String(log.tithesAmount)) : null,
      bobDeduction: log.bobDeduction ? parseFloat(String(log.bobDeduction)) : null, bobReason: log.bobReason,
      totalSubmission: log.totalSubmission ? parseFloat(String(log.totalSubmission)) : null,
      submissionMethod: log.submissionMethod, screenshotLink: log.screenshotLink, verificationStatus: log.verificationStatus ?? "Pending",
    };
  });
  const totalSubmission = entries.reduce((s, e) => s + (e.totalSubmission ?? 0), 0);
  const scope = hasChurchWideRole(caller) ? "all" : (caller.cgNumber ?? "Unknown");
  res.json({ weekStart, scope, entries, totalSubmission });
});

router.patch("/ministry/audit/got/:id", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;
  const [caller] = await db.select().from(membersTable).where(eq(membersTable.id, callerId));
  if (!caller || !hasAuditRole(caller)) { res.status(403).json({ error: "Access denied." }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { verificationStatus } = req.body ?? {};
  if (!["Verified", "Flagged", "Pending"].includes(verificationStatus)) { res.status(400).json({ error: "verificationStatus must be Verified, Flagged, or Pending" }); return; }
  const [log] = await db.select().from(gotLogsTable).where(eq(gotLogsTable.id, id));
  if (!log) { res.status(404).json({ error: "GOT log not found" }); return; }
  const memberIds = await getAuditMemberIds(caller);
  if (!memberIds.includes(log.memberId)) { res.status(403).json({ error: "Access denied to this member's record." }); return; }
  const [updated] = await db.update(gotLogsTable).set({ verificationStatus, isVerified: verificationStatus === "Verified" }).where(eq(gotLogsTable.id, id)).returning();
  const [m] = await db.select({ id: membersTable.id, churchId: membersTable.churchId, firstName: membersTable.firstName, lastName: membersTable.lastName }).from(membersTable).where(eq(membersTable.id, updated.memberId));
  res.json({
    id: updated.id, memberId: updated.memberId, churchId: m?.churchId ?? "", firstName: m?.firstName ?? "", lastName: m?.lastName ?? "",
    weekStart: updated.weekStart, giftAmount: updated.giftAmount ? parseFloat(String(updated.giftAmount)) : null,
    offeringAmount: updated.offeringAmount ? parseFloat(String(updated.offeringAmount)) : null,
    tithesAmount: updated.tithesAmount ? parseFloat(String(updated.tithesAmount)) : null,
    bobDeduction: updated.bobDeduction ? parseFloat(String(updated.bobDeduction)) : null, bobReason: updated.bobReason,
    totalSubmission: updated.totalSubmission ? parseFloat(String(updated.totalSubmission)) : null,
    submissionMethod: updated.submissionMethod, screenshotLink: updated.screenshotLink, verificationStatus: updated.verificationStatus ?? "Pending",
  });
});

router.get("/ministry/audit/biblical", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;
  const [caller] = await db.select().from(membersTable).where(eq(membersTable.id, callerId));
  if (!caller || !hasHabitAuditRole(caller)) { res.status(403).json({ error: "Access denied." }); return; }
  const weekStart = getWeekStart(req.query.weekStart as string | undefined);
  const memberIds = await getAuditMemberIds(caller);
  if (memberIds.length === 0) { res.json({ weekStart, scope: caller.cgNumber ?? "all", entries: [] }); return; }
  const biblicalLogs = await db.select().from(biblicalNotesLogsTable).where(and(inArray(biblicalNotesLogsTable.memberId, memberIds), eq(biblicalNotesLogsTable.noteDate, weekStart)));
  const members = await db.select({ id: membersTable.id, churchId: membersTable.churchId, firstName: membersTable.firstName, lastName: membersTable.lastName }).from(membersTable).where(inArray(membersTable.id, memberIds));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const entries = biblicalLogs.map((log) => {
    const m = memberMap.get(log.memberId);
    return { id: log.id, memberId: log.memberId, churchId: m?.churchId ?? "", firstName: m?.firstName ?? "", lastName: m?.lastName ?? "", noteDate: log.noteDate, noteType: log.noteType, isDone: log.isDone, verificationStatus: log.verificationStatus ?? "Pending" };
  });
  const scope = hasChurchWideRole(caller) ? "all" : (caller.cgNumber ?? "Unknown");
  res.json({ weekStart, scope, entries });
});

router.patch("/ministry/audit/biblical/:id", async (req, res): Promise<void> => {
  const callerId = requireAuth(req, res);
  if (!callerId) return;
  const [caller] = await db.select().from(membersTable).where(eq(membersTable.id, callerId));
  if (!caller || !hasHabitAuditRole(caller)) { res.status(403).json({ error: "Access denied." }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { verificationStatus } = req.body ?? {};
  if (!["Verified", "Flagged", "Pending"].includes(verificationStatus)) { res.status(400).json({ error: "verificationStatus must be Verified, Flagged, or Pending" }); return; }
  const [log] = await db.select().from(biblicalNotesLogsTable).where(eq(biblicalNotesLogsTable.id, id));
  if (!log) { res.status(404).json({ error: "Biblical notes log not found" }); return; }
  const memberIds = await getAuditMemberIds(caller);
  if (!memberIds.includes(log.memberId)) { res.status(403).json({ error: "Access denied to this member's record." }); return; }
  const [updated] = await db.update(biblicalNotesLogsTable).set({ verificationStatus }).where(eq(biblicalNotesLogsTable.id, id)).returning();
  const [m] = await db.select({ id: membersTable.id, churchId: membersTable.churchId, firstName: membersTable.firstName, lastName: membersTable.lastName }).from(membersTable).where(eq(membersTable.id, updated.memberId));
  res.json({ id: updated.id, memberId: updated.memberId, churchId: m?.churchId ?? "", firstName: m?.firstName ?? "", lastName: m?.lastName ?? "", noteDate: updated.noteDate, noteType: updated.noteType, isDone: updated.isDone, verificationStatus: updated.verificationStatus ?? "Pending" });
});

export default router;
