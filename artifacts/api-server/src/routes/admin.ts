import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, membersTable, stellarStatusApprovalsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { recalcAllMembersForYear } from "../lib/fragments";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.memberId ?? req.memberId;
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return id;
}

async function requireAdmin(req: any, res: any): Promise<number | null> {
  const id = requireAuth(req, res);
  if (!id) return null;
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!me || me.role !== "Admin") {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return id;
}

async function requireAdminOrPastor(req: any, res: any): Promise<{ memberId: number; role: string } | null> {
  const id = requireAuth(req, res);
  if (!id) return null;
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!me || !["Admin", "Pastor"].includes(me.role)) {
    res.status(403).json({ error: "Admin or Pastor only" });
    return null;
  }
  return { memberId: id, role: me.role };
}

// Pastor-only: only a Pastor (not an Admin) may approve/reject status promotions
async function requirePastor(req: any, res: any): Promise<number | null> {
  const id = requireAuth(req, res);
  if (!id) return null;
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!me || me.role !== "Pastor") {
    res.status(403).json({ error: "Pastor only" });
    return null;
  }
  return id;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const allMembers = await db.select().from(membersTable);
  const realMembers = allMembers.filter(m => !m.isTestingAccount);
  const total = realMembers.length;
  const active = realMembers.filter(m => m.status === "Active").length;
  const sbg = realMembers.filter(m => m.stellarStatus === "SBG").length;
  const p2s = realMembers.filter(m => m.stellarStatus === "P2S").length;
  const s2b = realMembers.filter(m => m.stellarStatus === "S2B").length;
  const p2g = realMembers.filter(m => m.stellarStatus === "P2G").length;
  const totalFragments = realMembers.reduce((sum, m) => sum + m.stellarFragments, 0);
  const testMembers = allMembers.filter(m => m.isTestingAccount).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRegistrations = realMembers.filter(m => new Date(m.createdAt) >= thirtyDaysAgo).length;
  const pendingFirstLogin = realMembers.filter(m => m.mustChangePassword).length;

  res.json({
    totalMembers: total,
    activeMembers: active,
    testMembers,
    sbgMembers: sbg,
    p2sMembers: p2s,
    s2bMembers: s2b,
    p2gMembers: p2g,
    totalStellarFragments: totalFragments,
    averageComplianceRate: 0,
    recentRegistrations,
    pendingFirstLogin,
  });
});

router.post("/admin/members/bulk-import", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const { members = [] } = req.body ?? {};
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const m of members) {
    try {
      const {
        churchId, password, firstName, lastName,
        accountType = "PCM", role = "Member", stellarStatus = "SBG",
        discipleshipEnabled = true, isTestingAccount = false,
        ...rest
      } = m;
      if (!churchId || !password || !firstName || !lastName) {
        errors.push(`Missing required fields for entry: ${JSON.stringify(m)}`);
        skipped++;
        continue;
      }

      const [existing] = await db.select().from(membersTable).where(eq(membersTable.churchId, churchId));
      if (existing) {
        skipped++;
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(membersTable).values({
        churchId, passwordHash, firstName, lastName, accountType, role,
        stellarStatus, discipleshipEnabled, isTestingAccount,
        mustChangePassword: false,
        ...rest,
      });
      imported++;
    } catch (err: any) {
      errors.push(`Failed to import ${m?.churchId}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ imported, skipped, errors });
});

// ─── ADMIN PASSWORD RESET ─────────────────────────────────────────────────────

router.post("/admin/members/bulk-reset-password", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { password, temporary = false } = req.body ?? {};
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db
    .update(membersTable)
    .set({ passwordHash, mustChangePassword: !!temporary });

  const allMembers = await db.select({ id: membersTable.id }).from(membersTable);
  res.json({ updated: allMembers.length });
});

router.post("/admin/members/:id/reset-password", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { password, temporary = false } = req.body ?? {};

  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(membersTable)
    .set({ passwordHash, mustChangePassword: !!temporary })
    .where(eq(membersTable.id, id));

  res.json({ success: true, mustChangePassword: !!temporary });
});

// ─── STELLAR STATUS APPROVALS ─────────────────────────────────────────────────

// GET /admin/stellar-status-approvals — Admin or Pastor can list approvals
router.get("/admin/stellar-status-approvals", async (req, res): Promise<void> => {
  const caller = await requireAdminOrPastor(req, res);
  if (!caller) return;

  const { status } = req.query as { status?: string };
  const allApprovals = await db.select().from(stellarStatusApprovalsTable);
  const filtered = status ? allApprovals.filter(a => a.status === status) : allApprovals;

  const enriched = await Promise.all(filtered.map(async (a) => {
    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, a.memberId));
    const [requestedBy] = await db.select().from(membersTable).where(eq(membersTable.id, a.requestedById));
    const approvedBy = a.approvedById
      ? await db.select().from(membersTable).where(eq(membersTable.id, a.approvedById)).then(r => r[0])
      : null;

    return {
      ...a,
      memberName: member ? `${member.firstName} ${member.lastName}` : "Unknown",
      memberChurchId: member?.churchId ?? "Unknown",
      currentStatus: member?.stellarStatus ?? "SBG",
      requestedByName: requestedBy ? `${requestedBy.firstName} ${requestedBy.lastName}` : "Unknown",
      approvedByName: approvedBy ? `${approvedBy.firstName} ${approvedBy.lastName}` : null,
    };
  }));

  res.json(enriched);
});

// POST /admin/stellar-status-approvals/:id/approve — Pastor-only
router.post("/admin/stellar-status-approvals/:id/approve", async (req, res): Promise<void> => {
  const pastorId = await requirePastor(req, res);
  if (!pastorId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [approval] = await db.select().from(stellarStatusApprovalsTable).where(eq(stellarStatusApprovalsTable.id, id));
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  if (approval.status !== "pending") {
    res.status(400).json({ error: "Approval already processed" });
    return;
  }

  await db.update(membersTable).set({
    stellarStatus: approval.requestedStatus,
    pendingStellarStatus: null,
    stellarStatusApprovedByPastor: true,
  }).where(eq(membersTable.id, approval.memberId));

  const [updated] = await db.update(stellarStatusApprovalsTable)
    .set({ status: "approved", approvedById: pastorId })
    .where(eq(stellarStatusApprovalsTable.id, id))
    .returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, updated.memberId));
  res.json({
    ...updated,
    memberName: member ? `${member.firstName} ${member.lastName}` : "Unknown",
    memberChurchId: member?.churchId ?? "Unknown",
    currentStatus: member?.stellarStatus ?? "SBG",
  });
});

// POST /admin/stellar-status-approvals/:id/reject — Pastor-only
router.post("/admin/stellar-status-approvals/:id/reject", async (req, res): Promise<void> => {
  const pastorId = await requirePastor(req, res);
  if (!pastorId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [approval] = await db.select().from(stellarStatusApprovalsTable).where(eq(stellarStatusApprovalsTable.id, id));
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  if (approval.status !== "pending") {
    res.status(400).json({ error: "Approval already processed" });
    return;
  }

  await db.update(membersTable)
    .set({ pendingStellarStatus: null })
    .where(eq(membersTable.id, approval.memberId));

  const [updated] = await db.update(stellarStatusApprovalsTable)
    .set({ status: "rejected", approvedById: pastorId })
    .where(eq(stellarStatusApprovalsTable.id, id))
    .returning();

  res.json(updated);
});

// ─── MINISTRY ROLES & DISCIPLESHIP (admin-only) ───────────────────────────────

/**
 * PATCH /admin/members/:id/roles
 * Update ministryRoles array and roleGroupMappings; syncs canonical group columns.
 */
router.patch("/admin/members/:id/roles", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const { ministryRoles, roleGroupMappings } = req.body ?? {};
  if (!Array.isArray(ministryRoles)) {
    res.status(400).json({ error: "ministryRoles must be an array" });
    return;
  }

  const updates: Record<string, unknown> = { ministryRoles };
  if (roleGroupMappings !== undefined) updates.roleGroupMappings = roleGroupMappings;

  // Sync canonical group columns from the role group mappings
  if (roleGroupMappings && typeof roleGroupMappings === "object") {
    const m = roleGroupMappings as Record<string, string>;
    if (m.Servant !== undefined) updates.cgNumber = m.Servant || null;
    if (m.CgAuditor !== undefined) updates.cgNumber = m.CgAuditor || null;
    if (m.SharingCaptain !== undefined) updates.sharingHuddleNumber = m.SharingCaptain || null;
    if (m.FamilyLeader !== undefined) updates.familyGroupNumber = m.FamilyLeader || null;
  }

  const [member] = await db.update(membersTable).set(updates as any).where(eq(membersTable.id, id)).returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const { passwordHash: _ph1, ...safe1 } = member;
  res.json(safe1);
});

/**
 * PATCH /admin/members/:id/discipleship
 * Toggle discipleshipEnabled for a member.
 */
router.patch("/admin/members/:id/discipleship", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const { discipleshipEnabled } = req.body ?? {};
  if (typeof discipleshipEnabled !== "boolean") {
    res.status(400).json({ error: "discipleshipEnabled (boolean) required" });
    return;
  }

  const [member] = await db.update(membersTable).set({ discipleshipEnabled }).where(eq(membersTable.id, id)).returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const { passwordHash: _ph2, ...safe2 } = member;
  res.json(safe2);
});

// ─── ANNUAL FRAGMENT RESET ────────────────────────────────────────────────────

/**
 * POST /admin/annual-reset
 * Admin-triggered: re-derive stellarFragments for the given year (defaults to
 * current year) for every discipleship-enabled member.  Safe to call multiple
 * times — the result is always the correct year-scoped count derived from the
 * underlying log tables.  Historical log rows are never deleted.
 */
router.post("/admin/annual-reset", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const rawYear = req.body?.year ?? req.query.year;
  const year = rawYear ? parseInt(String(rawYear), 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2020 || year > 2100) {
    res.status(400).json({ error: "Invalid year" });
    return;
  }

  const result = await recalcAllMembersForYear(year, true);
  res.json({ success: true, year, ...result });
});

export default router;
