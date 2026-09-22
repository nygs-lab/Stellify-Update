import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, membersTable, stellarStatusApprovalsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

function memberToResponse(m: typeof membersTable.$inferSelect) {
  const { passwordHash: _ph, ...rest } = m;
  return rest;
}

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

router.get("/members", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const { status, accountType, search } = req.query as any;

  const conditions: any[] = [];
  if (status) conditions.push(eq(membersTable.status, status));
  if (accountType) conditions.push(eq(membersTable.accountType, accountType));
  if (search) {
    conditions.push(
      or(
        ilike(membersTable.firstName, `%${search}%`),
        ilike(membersTable.lastName, `%${search}%`),
        ilike(membersTable.churchId, `%${search}%`),
      )
    );
  }

  const members = conditions.length
    ? await db.select().from(membersTable).where(and(...conditions))
    : await db.select().from(membersTable);

  res.json(members.map(memberToResponse));
});

router.post("/members", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const {
    churchId, accountType, password, firstName, lastName,
    role = "Member", discipleshipEnabled = true, stellarStatus = "SBG",
    isTestingAccount = false,
    ...rest
  } = req.body ?? {};
  if (!churchId || !password || !firstName || !lastName) {
    res.status(400).json({ error: "churchId, password, firstName, lastName required" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [member] = await db.insert(membersTable).values({
    churchId, accountType: accountType ?? "PCM", passwordHash,
    firstName, lastName, role, discipleshipEnabled, stellarStatus, isTestingAccount,
    mustChangePassword: false,
    ...rest,
  }).returning();

  res.status(201).json(memberToResponse(member));
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const requesterId = requireAuth(req, res);
  if (!requesterId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // Allow self-fetch for any authenticated member, or Admin/Pastor for any member
  if (requesterId !== id) {
    const [requester] = await db.select().from(membersTable).where(eq(membersTable.id, requesterId));
    if (!requester || (requester.role !== "Admin" && requester.role !== "Pastor")) {
      res.status(403).json({ error: "Admin or Pastor access required to view other members" });
      return;
    }
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(memberToResponse(member));
});

router.patch("/members/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // Strip immutable/system fields AND the approval-gated stellar fields.
  // Stellar status changes MUST go through PATCH /members/:id/stellar-status →
  // POST /admin/stellar-status-approvals/:id/approve (Pastor only).
  const {
    passwordHash: _ph,
    id: _id,
    createdAt: _ca,
    stellarStatus: _ss,
    pendingStellarStatus: _pss,
    stellarStatusApprovedByPastor: _sap,
    ...updates
  } = req.body ?? {};
  const [member] = await db.update(membersTable).set(updates).where(eq(membersTable.id, id)).returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(memberToResponse(member));
});

router.delete("/members/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(membersTable).where(eq(membersTable.id, id));
  res.sendStatus(204);
});

router.patch("/members/:id/status", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status } = req.body ?? {};

  const [member] = await db.update(membersTable).set({ status }).where(eq(membersTable.id, id)).returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(memberToResponse(member));
});

// PATCH /members/:id/stellar-status
// Admin submits a stellar status change → creates an approval record awaiting pastor sign-off.
// Returns StellarStatusChangeResult: { member, approval }
router.patch("/members/:id/stellar-status", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { stellarStatus } = req.body ?? {};

  if (!stellarStatus || !["SBG", "P2S", "S2B", "P2G"].includes(stellarStatus)) {
    res.status(400).json({ error: "Valid stellarStatus required: SBG | P2S | S2B | P2G" });
    return;
  }

  const [existing] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  await db.update(membersTable)
    .set({ pendingStellarStatus: stellarStatus, stellarStatusApprovedByPastor: false })
    .where(eq(membersTable.id, id));

  const [approval] = await db.insert(stellarStatusApprovalsTable).values({
    memberId: id,
    requestedStatus: stellarStatus,
    requestedById: adminId,
    status: "pending",
  }).returning();

  const [updated] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  res.json({
    member: memberToResponse(updated),
    approval,
  });
});

export default router;
