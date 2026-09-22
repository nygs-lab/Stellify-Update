import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { signToken, signResetToken, verifyResetToken } from "../lib/auth";

const router: IRouter = Router();

function memberToResponse(m: typeof membersTable.$inferSelect) {
  const { passwordHash: _ph, ...rest } = m;
  return rest;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { churchId, password } = req.body ?? {};
  if (!churchId || !password) {
    res.status(400).json({ error: "churchId and password required" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.churchId, churchId));
  if (!member) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (member.status === "Deleted" || member.status === "Deactivated") {
    res.status(401).json({ error: "Account is not active" });
    return;
  }

  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const response: { member: ReturnType<typeof memberToResponse>; token: string; passwordChangeRequired?: boolean } = {
    member: memberToResponse(member),
    token: signToken(member.id),
  };
  if (member.mustChangePassword) {
    response.passwordChangeRequired = true;
  }
  res.json(response);
});

router.post("/auth/logout", (_req, res): void => {
  // Stateless JWT: logout is handled client-side by discarding the token.
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const memberId = (req as any).session?.memberId ?? (req as any).memberId;
  if (!memberId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(memberToResponse(member));
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const memberId = (req as any).session?.memberId ?? (req as any).memberId;
  if (!memberId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { currentPassword, newPassword, memberId: targetId } = req.body ?? {};

  // Admin can change for another member
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!me) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const resolvedId = (me.role === "Admin" && targetId) ? targetId : memberId;
  const [target] = await db.select().from(membersTable).where(eq(membersTable.id, resolvedId));
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // If changing own password, verify current
  if (resolvedId === memberId) {
    const valid = await bcrypt.compare(currentPassword, target.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password incorrect" });
      return;
    }
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(membersTable)
    .set({ passwordHash: hash, mustChangePassword: false })
    .where(eq(membersTable.id, resolvedId));
  res.sendStatus(204);
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { churchId, email } = req.body ?? {};
  if (!churchId || !email) {
    res.status(400).json({ error: "churchId and email required" });
    return;
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.churchId, churchId));
  if (!member || !member.email || member.email.toLowerCase() !== String(email).toLowerCase()) {
    res.status(404).json({ error: "No account matches that Church ID and email" });
    return;
  }
  if (member.status === "Deleted" || member.status === "Deactivated") {
    res.status(404).json({ error: "Account is not active" });
    return;
  }

  res.json({ resetToken: signResetToken(member.id) });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { resetToken, newPassword } = req.body ?? {};
  if (!resetToken || !newPassword) {
    res.status(400).json({ error: "resetToken and newPassword required" });
    return;
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const memberId = verifyResetToken(resetToken);
  if (!memberId) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(membersTable).set({ passwordHash: hash }).where(eq(membersTable.id, memberId));
  res.sendStatus(204);
});

export default router;
