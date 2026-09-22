import { Router, type IRouter } from "express";
import { db, membersTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { computeFragmentsForMember } from "../lib/fragments.js";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const id = req.session?.memberId ?? req.memberId;
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return id;
}

router.get("/stellarboard", async (req, res): Promise<void> => {
  const memberId = requireAuth(req, res);
  if (!memberId) return;

  const currentYear = new Date().getFullYear();
  const year = req.query.year ? parseInt(req.query.year as string, 10) : currentYear;
  const isPastYear = year < currentYear;

  // Fetch the caller to determine if they are a test account
  const [me] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  const callerIsTest = me?.isTestingAccount ?? false;

  // Filter by active + discipleship enabled + matching isTestingAccount
  const members = await db
    .select()
    .from(membersTable)
    .where(
      and(
        eq(membersTable.status, "Active"),
        eq(membersTable.discipleshipEnabled, true),
        eq(membersTable.isTestingAccount, callerIsTest),
      )
    );

  // For the current year use the live stellarFragments column.
  // For past years, aggregate directly from the habit log tables so the
  // historical ranking is correct regardless of subsequent resets.
  let rankings: {
    rank: number;
    churchId: string;
    stellarFragments: number;
    spiritualFragments: number;
    personalFragments: number;
    bestStreak: number;
    stellarStatus: string | null;
  }[];

  if (isPastYear) {
    const withFragments: { member: (typeof members)[0]; fragments: number }[] = [];
    for (const m of members) {
      withFragments.push({
        member: m,
        fragments: await computeFragmentsForMember(m.id, year),
      });
    }

    withFragments.sort((a, b) => b.fragments - a.fragments);

    rankings = withFragments.map(({ member: m, fragments }, idx) => ({
      rank: idx + 1,
      churchId: m.churchId,
      stellarFragments: fragments,
      spiritualFragments: Math.floor(fragments * 0.6),
      personalFragments: Math.floor(fragments * 0.4),
      bestStreak: m.currentStreak,
      stellarStatus: m.stellarStatus,
    }));
  } else {
    const sorted = [...members].sort(
      (a, b) => b.stellarFragments - a.stellarFragments
    );

    rankings = sorted.map((m, idx) => ({
      rank: idx + 1,
      churchId: m.churchId,
      stellarFragments: m.stellarFragments,
      spiritualFragments: Math.floor(m.stellarFragments * 0.6),
      personalFragments: Math.floor(m.stellarFragments * 0.4),
      bestStreak: m.currentStreak,
      stellarStatus: m.stellarStatus,
    }));
  }

  res.json({
    year,
    rankings,
    lastReset: `${year}-01-01`,
    isTestMode: callerIsTest,
  });
});

export default router;
