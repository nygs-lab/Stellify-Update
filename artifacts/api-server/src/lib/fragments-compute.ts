/**
 * Pure computation functions for fragment and streak calculation.
 *
 * These functions have NO database dependency — all inputs are plain data
 * arrays. They are separated from fragments.ts so they can be unit-tested
 * without a live database.
 */

export interface SpiritualLogRow {
  weekStart: string;
  habitCode: string;
  daysJson: string;
}

export interface DayEntry {
  dayOfWeek: number;
  completed: boolean;
}

/**
 * Compute the number of completed prayer days (SHC001) that fall within the
 * target year, correctly handling weeks that start in late December but have
 * days in January (and vice-versa).
 */
export function spiritualCompletionsInYear(
  logs: SpiritualLogRow[],
  year: number,
): number {
  let count = 0;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  for (const log of logs) {
    const days: DayEntry[] = JSON.parse(log.daysJson || "[]");
    if (days.length === 0) continue;

    const weekStart = new Date(log.weekStart + "T00:00:00");
    for (const day of days) {
      if (!day.completed) continue;
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + day.dayOfWeek);
      const dateStr = d.toISOString().split("T")[0];
      if (dateStr >= yearStart && dateStr <= yearEnd) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Compute consecutive prayer streak ending on (and including) `today`.
 * Looks back up to 3650 days. If today is not in the set, streak is 0.
 *
 * @param prayerLogs  - All SHC001 log rows for the member (any year).
 * @param today       - Anchor date (defaults to the real current date).
 */
export function computeStreak(
  prayerLogs: SpiritualLogRow[],
  today?: Date,
): number {
  const prayerCompletedDates = new Set<string>();

  for (const log of prayerLogs) {
    const days: DayEntry[] = JSON.parse(log.daysJson || "[]");
    const weekStart = new Date(log.weekStart + "T00:00:00");
    for (const day of days) {
      if (day.completed) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + day.dayOfWeek);
        prayerCompletedDates.add(d.toISOString().split("T")[0]);
      }
    }
  }

  const anchor = today ? new Date(today) : new Date();
  anchor.setHours(0, 0, 0, 0);

  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (prayerCompletedDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Count rows where attended === true.
 * Accepts `boolean | null` because DB columns may be nullable.
 */
export function countAttended(logs: { attended: boolean | null }[]): number {
  return logs.filter((l) => l.attended === true).length;
}

/**
 * Count rows where isDone === true (biblical notes).
 * Accepts `boolean | null` because DB columns may be nullable.
 */
export function countDone(logs: { isDone: boolean | null }[]): number {
  return logs.filter((l) => l.isDone === true).length;
}

/**
 * Count rows where completed === true (personal habit logs).
 * Accepts `boolean | null` because DB columns may be nullable.
 */
export function countCompleted(logs: { completed: boolean | null }[]): number {
  return logs.filter((l) => l.completed === true).length;
}
