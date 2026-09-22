import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, membersTable, spiritualHabitLogsTable, gotLogsTable, worshipAttendanceLogsTable, notificationsTable } from "@workspace/db";

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

router.get("/profile", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member) {
    res.status(401).json({ error: "Not found" });
    return;
  }
  res.json(memberToResponse(member));
});

router.patch("/profile", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  // Only allow member-editable fields
  const {
    firstName, middleName, lastName, nickname, gender, birthday, civilStatus, weddingAnniversary,
    email, contactNumber, profilePicture, foodPreferences, medicalCondition, bloodType,
    emergencyContactName, emergencyContactRelationship, emergencyContactNumber, socialMediaLinks,
    timezone,
  } = req.body ?? {};

  const updates: Record<string, unknown> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (middleName !== undefined) updates.middleName = middleName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (nickname !== undefined) updates.nickname = nickname;
  if (gender !== undefined) updates.gender = gender;
  if (birthday !== undefined) updates.birthday = birthday;
  if (civilStatus !== undefined) updates.civilStatus = civilStatus;
  if (weddingAnniversary !== undefined) updates.weddingAnniversary = weddingAnniversary;
  if (email !== undefined) updates.email = email;
  if (contactNumber !== undefined) updates.contactNumber = contactNumber;
  if (profilePicture !== undefined) updates.profilePicture = profilePicture;
  if (foodPreferences !== undefined) updates.foodPreferences = foodPreferences;
  if (medicalCondition !== undefined) updates.medicalCondition = medicalCondition;
  if (bloodType !== undefined) updates.bloodType = bloodType;
  if (emergencyContactName !== undefined) updates.emergencyContactName = emergencyContactName;
  if (emergencyContactRelationship !== undefined) updates.emergencyContactRelationship = emergencyContactRelationship;
  if (emergencyContactNumber !== undefined) updates.emergencyContactNumber = emergencyContactNumber;
  if (socialMediaLinks !== undefined) updates.socialMediaLinks = socialMediaLinks;
  if (timezone !== undefined) {
    if (timezone !== null) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        res.status(400).json({ error: "Invalid IANA timezone string" });
        return;
      }
    }
    updates.timezone = timezone;
  }

  const [member] = await db.update(membersTable).set(updates).where(eq(membersTable.id, memberId)).returning();
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(memberToResponse(member));
});

router.put("/profile/push-token", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { token } = req.body ?? {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token is required" });
    return;
  }

  await db
    .update(membersTable)
    .set({ expoPushToken: token })
    .where(eq(membersTable.id, memberId));

  res.status(204).end();
});

router.put("/profile/timezone", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { timezone } = req.body ?? {};
  if (!timezone || typeof timezone !== "string") {
    res.status(400).json({ error: "timezone is required" });
    return;
  }

  // Validate that it is a recognised IANA timezone before persisting.
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    res.status(400).json({ error: "Invalid IANA timezone string" });
    return;
  }

  await db
    .update(membersTable)
    .set({ timezone })
    .where(eq(membersTable.id, memberId));

  res.status(204).end();
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member) {
    res.status(401).json({ error: "Not found" });
    return;
  }

  // Calculate days remaining if sbgEndDate is set
  let daysRemaining: number | null = null;
  let targetExpiryDate: string | null = null;
  if (member.sbgEndDate && member.discipleshipEnabled) {
    const end = new Date(member.sbgEndDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, diff);
    targetExpiryDate = member.sbgEndDate;
  }

  // Today's habit status (mock: check if any log exists today)
  const todayHabitStatus = {
    prayerLogged: false,
    devotionLogged: false,
    worshipAttendanceLogged: false,
  };

  res.json({
    member: memberToResponse(member),
    daysRemaining,
    targetExpiryDate,
    stellarFragments: member.stellarFragments,
    streakDays: member.currentStreak,
    todayHabitStatus,
    recentActivity: [],
    pendingRequests: [],
  });
});

router.get("/dashboard/notifications", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;
  const notifs = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.recipientId, memberId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifs.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    read: n.isRead,
    createdAt: n.createdAt.toISOString(),
  })));
});

export default router;
