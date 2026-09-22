import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  sermonsTable,
  churchEventsTable,
  guidesTable,
  prayerRequestsTable,
  counselingRequestsTable,
  brethrenWatchTable,
  feedbackTable,
  membersTable,
} from "@workspace/db";

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

// ─── SERMONS ──────────────────────────────────────────────────────────────────

router.get("/church/sermons", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const sermons = await db.select().from(sermonsTable).orderBy(desc(sermonsTable.publishDate));
  res.json(sermons);
});

router.post("/church/sermons", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const { title, speaker, publishDate, shortDescription, driveLink } = req.body ?? {};
  if (!title || !speaker || !publishDate) {
    res.status(400).json({ error: "title, speaker, publishDate required" });
    return;
  }

  const [sermon] = await db.insert(sermonsTable).values({ title, speaker, publishDate, shortDescription, driveLink }).returning();
  res.status(201).json(sermon);
});

router.patch("/church/sermons/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, speaker, publishDate, shortDescription, driveLink } = req.body ?? {};
  const [sermon] = await db.update(sermonsTable).set({ title, speaker, publishDate, shortDescription, driveLink }).where(eq(sermonsTable.id, id)).returning();
  if (!sermon) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(sermon);
});

router.delete("/church/sermons/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(sermonsTable).where(eq(sermonsTable.id, id));
  res.sendStatus(204);
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────

router.get("/church/events", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const events = await db.select().from(churchEventsTable).orderBy(churchEventsTable.eventDate);
  res.json(events);
});

router.post("/church/events", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const { title, eventDate, location, meetLink, description, eventType } = req.body ?? {};
  if (!title || !eventDate || !eventType) {
    res.status(400).json({ error: "title, eventDate, eventType required" });
    return;
  }

  const [event] = await db.insert(churchEventsTable).values({ title, eventDate, location, meetLink, description, eventType }).returning();
  res.status(201).json(event);
});

router.patch("/church/events/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, eventDate, location, meetLink, description, eventType } = req.body ?? {};
  const [event] = await db.update(churchEventsTable).set({ title, eventDate, location, meetLink, description, eventType }).where(eq(churchEventsTable.id, id)).returning();
  if (!event) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(event);
});

router.delete("/church/events/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(churchEventsTable).where(eq(churchEventsTable.id, id));
  res.sendStatus(204);
});

// ─── GUIDES ───────────────────────────────────────────────────────────────────

router.get("/church/guides", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const guides = await db.select().from(guidesTable).orderBy(desc(guidesTable.createdAt));
  res.json(guides);
});

router.post("/church/guides", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const { title, description, driveLink, guideType, targetLevel } = req.body ?? {};
  if (!title || !guideType || !targetLevel) {
    res.status(400).json({ error: "title, guideType, targetLevel required" });
    return;
  }

  const [guide] = await db.insert(guidesTable).values({ title, description, driveLink, guideType, targetLevel }).returning();
  res.status(201).json(guide);
});

// Admin-only: update a guide
router.patch("/church/guides/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, description, driveLink, guideType, targetLevel } = req.body ?? {};
  const [guide] = await db.update(guidesTable)
    .set({ title, description, driveLink, guideType, targetLevel })
    .where(eq(guidesTable.id, id))
    .returning();
  if (!guide) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(guide);
});

// Admin-only: delete a guide
router.delete("/church/guides/:id", async (req, res): Promise<void> => {
  const memberId = await requireAdmin(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(guidesTable).where(eq(guidesTable.id, id));
  res.sendStatus(204);
});

// ─── PRAYER REQUESTS ──────────────────────────────────────────────────────────

router.get("/engagement/prayer-requests", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [allRequests, allMembers] = await Promise.all([
    db.select().from(prayerRequestsTable).orderBy(desc(prayerRequestsTable.createdAt)),
    db.select().from(membersTable),
  ]);
  const memberMap = new Map(allMembers.map(m => [m.id, m]));
  const me = memberMap.get(memberId);

  const filtered = allRequests.filter(r => {
    if (r.memberId === memberId) return true;
    if (me?.role === "Admin" || me?.role === "Pastor") return true;

    const requestor = memberMap.get(r.memberId);

    if (r.visibility === "Church") return true;
    if (r.visibility === "PastorOnly") return false;

    // ServantOnly: any member in the same CG as the requestor sees this (for group solidarity)
    if (r.visibility === "ServantOnly") {
      return me?.cgNumber != null && requestor?.cgNumber === me.cgNumber;
    }
    // CaptainOnly: any member in the same sharing huddle as the requestor sees this
    if (r.visibility === "CaptainOnly") {
      return me?.sharingHuddleNumber != null && requestor?.sharingHuddleNumber === me.sharingHuddleNumber;
    }
    return false;
  });

  const enriched = filtered.map(r => {
    const m = memberMap.get(r.memberId);
    const d = r.doneById ? memberMap.get(r.doneById) : undefined;
    return {
      ...r,
      memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown",
      doneByName: d ? `${d.firstName} ${d.lastName}` : null,
    };
  });

  res.json(enriched);
});

router.post("/engagement/prayer-requests", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { description, visibility = "Church" } = req.body ?? {};
  if (!description) {
    res.status(400).json({ error: "description required" });
    return;
  }

  const [pr] = await db.insert(prayerRequestsTable).values({ memberId, description, visibility, isDone: false }).returning();
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.status(201).json({ ...pr, memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown", doneByName: null });
});

router.patch("/engagement/prayer-requests/:id/complete", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const leaderRoles = ["Pastor", "Admin", "Servant", "SharingCaptain"] as const;
  if (!me || !(leaderRoles as readonly string[]).includes(me.role)) {
    res.status(403).json({ error: "Leader role required" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(prayerRequestsTable).where(eq(prayerRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [requestor] = await db.select().from(membersTable).where(eq(membersTable.id, existing.memberId));

  const canComplete =
    me.role === "Admin" || me.role === "Pastor"
      ? true
      : existing.visibility === "Church"
        ? me.role === "Servant" || me.role === "SharingCaptain"
        : existing.visibility === "ServantOnly"
          ? me.role === "Servant" && me.cgNumber != null && requestor?.cgNumber === me.cgNumber
          : existing.visibility === "CaptainOnly"
            ? me.role === "SharingCaptain" && me.sharingHuddleNumber != null && requestor?.sharingHuddleNumber === me.sharingHuddleNumber
            : false;

  if (!canComplete) { res.status(403).json({ error: "This request is not in your scope" }); return; }

  const [pr] = await db.update(prayerRequestsTable).set({ isDone: true, doneById: memberId }).where(eq(prayerRequestsTable.id, id)).returning();
  const [doneBy] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.json({ ...pr, memberName: requestor ? `${requestor.firstName} ${requestor.lastName}` : "Unknown", doneByName: doneBy ? `${doneBy.firstName} ${doneBy.lastName}` : null });
});

// ─── COUNSELING REQUESTS ──────────────────────────────────────────────────────

// GET /engagement/counseling-requests/leaders
// Returns counseling candidates scoped to caller's CG/huddle context:
//   - All active Pastors (always available)
//   - Servants whose cgNumber matches caller's cgNumber (fallback: all Servants if caller has none)
//   - SharingCaptains whose sharingHuddleNumber matches caller's (fallback: all if none)
router.get("/engagement/counseling-requests/leaders", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const allLeaders = await db.select().from(membersTable)
    .where(
      and(
        eq(membersTable.status, "Active"),
        inArray(membersTable.role, ["Pastor", "Servant", "SharingCaptain"])
      )
    );

  const result = allLeaders.filter(m => {
    if (m.role === "Pastor") return true;

    if (m.role === "Servant") {
      // If caller has a CG, only show servants in the same CG
      if (me?.cgNumber) return m.cgNumber === me.cgNumber;
      // Otherwise show all servants
      return true;
    }

    if (m.role === "SharingCaptain") {
      // If caller has a sharing huddle, only show captains in the same huddle
      if (me?.sharingHuddleNumber) return m.sharingHuddleNumber === me.sharingHuddleNumber;
      return true;
    }

    return false;
  });

  res.json(result.map(m => ({
    id: m.id,
    churchId: m.churchId,
    firstName: m.firstName,
    lastName: m.lastName,
    role: m.role,
  })));
});

router.get("/engagement/counseling", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [allRequests, allMembers] = await Promise.all([
    db.select().from(counselingRequestsTable).orderBy(desc(counselingRequestsTable.createdAt)),
    db.select().from(membersTable),
  ]);
  const memberMap = new Map(allMembers.map(m => [m.id, m]));
  const me = memberMap.get(memberId);

  const filtered = allRequests.filter(r => {
    if (r.memberId === memberId) return true;
    if (me?.role === "Admin" || me?.role === "Pastor") return true;

    const requestor = memberMap.get(r.memberId);

    if (r.counselorTarget === "Servant") {
      return me?.role === "Servant" && me.cgNumber != null && requestor?.cgNumber === me.cgNumber;
    }
    if (r.counselorTarget === "Captain") {
      return me?.role === "SharingCaptain" && me.sharingHuddleNumber != null && requestor?.sharingHuddleNumber === me.sharingHuddleNumber;
    }
    return false;
  });

  res.json(filtered.map(r => {
    const m = memberMap.get(r.memberId);
    return { ...r, memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown" };
  }));
});

router.post("/engagement/counseling", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { reason, preferredDate, connectType, counselorTarget } = req.body ?? {};
  if (!reason || !preferredDate || !connectType || !counselorTarget) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  const [cr] = await db.insert(counselingRequestsTable).values({ memberId, reason, preferredDate, connectType, counselorTarget, isDone: false }).returning();
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.status(201).json({ ...cr, memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown" });
});

router.patch("/engagement/counseling/:id/complete", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const leaderRoles = ["Pastor", "Admin", "Servant", "SharingCaptain"] as const;
  if (!me || !(leaderRoles as readonly string[]).includes(me.role)) {
    res.status(403).json({ error: "Leader role required" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(counselingRequestsTable).where(eq(counselingRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [requestor] = await db.select().from(membersTable).where(eq(membersTable.id, existing.memberId));

  const canComplete =
    me.role === "Admin" || me.role === "Pastor"
      ? true
      : existing.counselorTarget === "Servant"
        ? me.role === "Servant" && me.cgNumber != null && requestor?.cgNumber === me.cgNumber
        : existing.counselorTarget === "Captain"
          ? me.role === "SharingCaptain" && me.sharingHuddleNumber != null && requestor?.sharingHuddleNumber === me.sharingHuddleNumber
          : false;

  if (!canComplete) { res.status(403).json({ error: "This request is not targeted at your role" }); return; }

  const [cr] = await db.update(counselingRequestsTable).set({ isDone: true }).where(eq(counselingRequestsTable.id, id)).returning();
  res.json({ ...cr, memberName: requestor ? `${requestor.firstName} ${requestor.lastName}` : "Unknown" });
});

// ─── BRETHREN WATCH ───────────────────────────────────────────────────────────

router.post("/engagement/brethren-watch", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { reportedMemberId, leaderRoute, incidentDescription } = req.body ?? {};
  if (!reportedMemberId || !leaderRoute || !incidentDescription) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  const [bw] = await db.insert(brethrenWatchTable).values({
    reporterId: memberId, reportedMemberId, leaderRoute, incidentDescription, isResolved: false,
  }).returning();
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, reportedMemberId));
  res.status(201).json({ ...bw, reportedMemberName: m ? `${m.firstName} ${m.lastName}` : "Unknown" });
});

router.patch("/engagement/brethren-watch/:id/resolve", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [bw] = await db.update(brethrenWatchTable).set({ isResolved: true }).where(eq(brethrenWatchTable.id, id)).returning();
  if (!bw) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, bw.reportedMemberId));
  res.json({ ...bw, reportedMemberName: m ? `${m.firstName} ${m.lastName}` : "Unknown" });
});

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

// GET /engagement/feedback
// Admin/Pastor see all submissions with real identity.
// Other roles see only non-anonymous items (+ their own); anonymous items show "Anonymous Member".
router.get("/engagement/feedback", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const isPrivileged = me?.role === "Admin" || me?.role === "Pastor";

  const items = await db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));

  // All feedback visible to all authenticated users; identity masked for anonymous items
  // viewed by non-privileged users who are not the submitter.
  res.json(items.map(f => {
    if (f.isAnonymous && !isPrivileged && f.memberId !== memberId) {
      return { ...f, memberId: null };
    }
    return f;
  }));
});

router.post("/engagement/feedback", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const { categoryTitle, description, isAnonymous = false } = req.body ?? {};
  if (!categoryTitle || !description) {
    res.status(400).json({ error: "categoryTitle and description required" });
    return;
  }

  const [fb] = await db.insert(feedbackTable).values({
    memberId,
    categoryTitle,
    description,
    isAnonymous,
    status: "Pending",
  }).returning();
  res.status(201).json(fb);
});

// ─── MEMBER EDIT: PRAYER REQUEST ──────────────────────────────────────────────
router.patch("/engagement/prayer-requests/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [existing] = await db.select().from(prayerRequestsTable).where(eq(prayerRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.memberId !== memberId) { res.status(403).json({ error: "Can only edit your own requests" }); return; }
  if (existing.isDone) { res.status(400).json({ error: "Cannot edit a completed request" }); return; }

  const { description, visibility } = req.body ?? {};
  const [pr] = await db.update(prayerRequestsTable)
    .set({ ...(description && { description }), ...(visibility && { visibility }) })
    .where(eq(prayerRequestsTable.id, id))
    .returning();
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, pr.memberId));
  res.json({ ...pr, memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown", doneByName: null });
});

// ─── MEMBER EDIT: COUNSELING REQUEST ──────────────────────────────────────────
router.patch("/engagement/counseling/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [existing] = await db.select().from(counselingRequestsTable).where(eq(counselingRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.memberId !== memberId) { res.status(403).json({ error: "Can only edit your own requests" }); return; }
  if (existing.isDone) { res.status(400).json({ error: "Cannot edit a completed request" }); return; }

  const { reason, preferredDate, connectType, counselorTarget } = req.body ?? {};
  const [cr] = await db.update(counselingRequestsTable)
    .set({
      ...(reason && { reason }),
      ...(preferredDate && { preferredDate }),
      ...(connectType && { connectType }),
      ...(counselorTarget && { counselorTarget }),
    })
    .where(eq(counselingRequestsTable.id, id))
    .returning();
  const [m] = await db.select().from(membersTable).where(eq(membersTable.id, cr.memberId));
  res.json({ ...cr, memberName: m ? `${m.firstName} ${m.lastName}` : "Unknown" });
});

// ─── MEMBER EDIT: FEEDBACK ────────────────────────────────────────────────────
router.patch("/engagement/feedback/:id", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [existing] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.memberId !== memberId) { res.status(403).json({ error: "Can only edit your own feedback" }); return; }
  if (existing.status !== "Pending") { res.status(400).json({ error: "Cannot edit feedback that is no longer pending" }); return; }

  const { categoryTitle, description, isAnonymous } = req.body ?? {};
  const [fb] = await db.update(feedbackTable)
    .set({
      ...(categoryTitle && { categoryTitle }),
      ...(description && { description }),
      ...(isAnonymous !== undefined && { isAnonymous }),
    })
    .where(eq(feedbackTable.id, id))
    .returning();
  res.json(fb);
});

// ─── LEADER ACTION: FEEDBACK ADVISE ──────────────────────────────────────────
router.patch("/engagement/feedback/:id/advise", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const leaderRoles = ["Pastor", "Servant", "SharingCaptain", "Admin"];
  if (!me || !leaderRoles.includes(me.role)) {
    res.status(403).json({ error: "Leader role required" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [fb] = await db.update(feedbackTable)
    .set({ status: "TakenIntoAdvisement" })
    .where(eq(feedbackTable.id, id))
    .returning();
  if (!fb) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fb);
});

export default router;
