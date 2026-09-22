import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, groupsTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.memberId ?? req.memberId;
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return id;
}

async function requireAdmin(memberId: number, res: any): Promise<boolean> {
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!me || me.role !== "Admin") {
    res.status(403).json({ error: "Admin only" });
    return false;
  }
  return true;
}

router.get("/groups", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { type } = req.query as { type?: string };
  const groups = type
    ? await db.select().from(groupsTable).where(eq(groupsTable.type, type))
    : await db.select().from(groupsTable);
  res.json(groups);
});

router.post("/groups", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;
  if (!(await requireAdmin(memberId, res))) return;

  const { type, number, name, leaderId, description } = req.body ?? {};
  if (!type || !number) {
    res.status(400).json({ error: "type and number required" });
    return;
  }

  const [group] = await db.insert(groupsTable).values({ type, number, name, leaderId, description }).returning();
  res.status(201).json(group);
});

router.patch("/groups/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;
  if (!(await requireAdmin(memberId, res))) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { number, name, leaderId, description } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (number !== undefined) updates.number = number;
  if (name !== undefined) updates.name = name;
  if (leaderId !== undefined) updates.leaderId = leaderId;
  if (description !== undefined) updates.description = description;

  const [group] = await db.update(groupsTable).set(updates).where(eq(groupsTable.id, id)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(group);
});

router.delete("/groups/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;
  if (!(await requireAdmin(memberId, res))) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(groupsTable).where(eq(groupsTable.id, id));
  res.sendStatus(204);
});

export default router;
