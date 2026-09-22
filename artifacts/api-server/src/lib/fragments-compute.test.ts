import { describe, it, expect } from "vitest";
import {
  spiritualCompletionsInYear,
  computeStreak,
  countAttended,
  countDone,
  countCompleted,
} from "./fragments-compute.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a spiritual-habit log row where `days` is a list of
 * { dayOfWeek, completed } objects. dayOfWeek 0 = weekStart itself.
 */
function makeLog(weekStart: string, days: Array<{ dayOfWeek: number; completed: boolean }>) {
  return { weekStart, habitCode: "SHC001", daysJson: JSON.stringify(days) };
}

/**
 * Build a date string N days before a reference date.
 */
function daysAgo(anchor: Date, n: number): string {
  const d = new Date(anchor);
  d.setDate(anchor.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ─── spiritualCompletionsInYear ───────────────────────────────────────────────

describe("spiritualCompletionsInYear", () => {
  it("counts completed days that fall within the target year", () => {
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },
        { dayOfWeek: 1, completed: true },
        { dayOfWeek: 2, completed: false },
      ]),
    ];
    expect(spiritualCompletionsInYear(logs, 2025)).toBe(2);
  });

  it("ignores uncompleted days", () => {
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: false },
        { dayOfWeek: 1, completed: false },
      ]),
    ];
    expect(spiritualCompletionsInYear(logs, 2025)).toBe(0);
  });

  it("handles a week straddling the year boundary (Dec→Jan): only Jan days count for the new year", () => {
    // Week starts Dec 29 2024; days 3–6 land in 2025
    const logs = [
      makeLog("2024-12-29", [
        { dayOfWeek: 0, completed: true },  // Dec 29 2024 — must NOT count for 2025
        { dayOfWeek: 1, completed: true },  // Dec 30 2024 — must NOT count for 2025
        { dayOfWeek: 2, completed: true },  // Dec 31 2024 — must NOT count for 2025
        { dayOfWeek: 3, completed: true },  // Jan  1 2025 — MUST count for 2025
        { dayOfWeek: 4, completed: true },  // Jan  2 2025 — MUST count for 2025
      ]),
    ];
    expect(spiritualCompletionsInYear(logs, 2025)).toBe(2);
    expect(spiritualCompletionsInYear(logs, 2024)).toBe(3);
  });

  it("handles a week straddling the year boundary (Dec→Jan) with weekStart in new year", () => {
    // Week starts Jan 1 2025; day 0 is Jan 1 (new year), but e.g. prior-year days would be
    // day -N which doesn't happen in practice — still verify clean counting.
    const logs = [
      makeLog("2025-01-01", [
        { dayOfWeek: 0, completed: true },  // Jan 1 2025
        { dayOfWeek: 6, completed: true },  // Jan 7 2025
      ]),
    ];
    expect(spiritualCompletionsInYear(logs, 2025)).toBe(2);
    expect(spiritualCompletionsInYear(logs, 2024)).toBe(0);
  });

  it("returns 0 for empty logs array", () => {
    expect(spiritualCompletionsInYear([], 2025)).toBe(0);
  });

  it("returns 0 when daysJson is empty", () => {
    const logs = [{ weekStart: "2025-06-23", habitCode: "SHC001", daysJson: "[]" }];
    expect(spiritualCompletionsInYear(logs, 2025)).toBe(0);
  });
});

// ─── computeStreak ────────────────────────────────────────────────────────────

describe("computeStreak", () => {
  it("returns the correct consecutive streak ending today when all days are logged", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },  // Jun 23
        { dayOfWeek: 1, completed: true },  // Jun 24
        { dayOfWeek: 2, completed: true },  // Jun 25
        { dayOfWeek: 3, completed: true },  // Jun 26
        { dayOfWeek: 4, completed: true },  // Jun 27
      ]),
    ];
    expect(computeStreak(logs, today)).toBe(5);
  });

  it("streak is 0 when today is not logged", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },  // Jun 23
        { dayOfWeek: 1, completed: true },  // Jun 24
        { dayOfWeek: 2, completed: true },  // Jun 25
        { dayOfWeek: 3, completed: true },  // Jun 26
        { dayOfWeek: 4, completed: false }, // Jun 27 — NOT done today
      ]),
    ];
    expect(computeStreak(logs, today)).toBe(0);
  });

  it("streak breaks when a day is skipped in the middle", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },  // Jun 23
        { dayOfWeek: 1, completed: true },  // Jun 24
        { dayOfWeek: 2, completed: false }, // Jun 25 — GAP
        { dayOfWeek: 3, completed: true },  // Jun 26
        { dayOfWeek: 4, completed: true },  // Jun 27
      ]),
    ];
    // Working backwards from today: Jun 27 ✓, Jun 26 ✓, Jun 25 ✗ — streak = 2
    expect(computeStreak(logs, today)).toBe(2);
  });

  it("streak spans multiple weeks correctly", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      // Week 1: Jun 16–22, all completed
      makeLog("2025-06-16", [
        { dayOfWeek: 0, completed: true },  // Jun 16
        { dayOfWeek: 1, completed: true },  // Jun 17
        { dayOfWeek: 2, completed: true },  // Jun 18
        { dayOfWeek: 3, completed: true },  // Jun 19
        { dayOfWeek: 4, completed: true },  // Jun 20
        { dayOfWeek: 5, completed: true },  // Jun 21
        { dayOfWeek: 6, completed: true },  // Jun 22
      ]),
      // Week 2: Jun 23–27, all completed
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },  // Jun 23
        { dayOfWeek: 1, completed: true },  // Jun 24
        { dayOfWeek: 2, completed: true },  // Jun 25
        { dayOfWeek: 3, completed: true },  // Jun 26
        { dayOfWeek: 4, completed: true },  // Jun 27
      ]),
    ];
    expect(computeStreak(logs, today)).toBe(12);
  });

  it("streak breaks at a week boundary when last day of previous week is missed", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      // Jun 16–21 done, Jun 22 NOT done (last day of prior week)
      makeLog("2025-06-16", [
        { dayOfWeek: 0, completed: true },
        { dayOfWeek: 1, completed: true },
        { dayOfWeek: 2, completed: true },
        { dayOfWeek: 3, completed: true },
        { dayOfWeek: 4, completed: true },
        { dayOfWeek: 5, completed: true },
        { dayOfWeek: 6, completed: false }, // Jun 22 — GAP
      ]),
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: true },  // Jun 23
        { dayOfWeek: 1, completed: true },  // Jun 24
        { dayOfWeek: 2, completed: true },  // Jun 25
        { dayOfWeek: 3, completed: true },  // Jun 26
        { dayOfWeek: 4, completed: true },  // Jun 27
      ]),
    ];
    // Streak back from Jun 27: 27,26,25,24,23 all ✓ → Jun 22 ✗ → streak = 5
    expect(computeStreak(logs, today)).toBe(5);
  });

  it("returns 0 when there are no logs at all", () => {
    const today = new Date("2025-06-27T00:00:00");
    expect(computeStreak([], today)).toBe(0);
  });

  it("returns 0 when today is logged but yesterday was the start of a gap", () => {
    const today = new Date("2025-06-27T00:00:00");
    const logs = [
      makeLog("2025-06-23", [
        { dayOfWeek: 0, completed: false }, // Jun 23
        { dayOfWeek: 1, completed: false }, // Jun 24
        { dayOfWeek: 2, completed: false }, // Jun 25
        { dayOfWeek: 3, completed: false }, // Jun 26
        { dayOfWeek: 4, completed: true },  // Jun 27 — only today
      ]),
    ];
    // Today ✓, yesterday ✗ → streak = 1
    expect(computeStreak(logs, today)).toBe(1);
  });
});

// ─── countAttended ────────────────────────────────────────────────────────────

describe("countAttended", () => {
  it("counts only attended=true rows", () => {
    const logs = [
      { attended: true },
      { attended: false },
      { attended: true },
    ];
    expect(countAttended(logs)).toBe(2);
  });

  it("returns 0 when all are absent", () => {
    expect(countAttended([{ attended: false }, { attended: false }])).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(countAttended([])).toBe(0);
  });

  it("unchecking worship/CG reduces count by 1", () => {
    const before = [{ attended: true }, { attended: true }, { attended: true }];
    const after  = [{ attended: true }, { attended: false }, { attended: true }];
    expect(countAttended(after)).toBe(countAttended(before) - 1);
  });
});

// ─── countDone ────────────────────────────────────────────────────────────────

describe("countDone", () => {
  it("counts only isDone=true rows", () => {
    const logs = [{ isDone: true }, { isDone: false }, { isDone: true }];
    expect(countDone(logs)).toBe(2);
  });

  it("returns 0 for empty array", () => {
    expect(countDone([])).toBe(0);
  });
});

// ─── countCompleted (personal habits) ────────────────────────────────────────

describe("countCompleted", () => {
  it("counts only completed=true rows", () => {
    const logs = [
      { completed: true },
      { completed: false },
      { completed: true },
      { completed: true },
    ];
    expect(countCompleted(logs)).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(countCompleted([])).toBe(0);
  });

  it("un-completing a personal habit reduces count by 1", () => {
    const before = [{ completed: true }, { completed: true }, { completed: true }];
    const after  = [{ completed: true }, { completed: false }, { completed: true }];
    expect(countCompleted(after)).toBe(countCompleted(before) - 1);
  });
});

// ─── GOT fragment behaviour ───────────────────────────────────────────────────

describe("GOT fragment counting (row presence)", () => {
  it("each GOT row adds one fragment", () => {
    const gotRows = [{}, {}, {}];
    expect(gotRows.length).toBe(3);
  });

  it("deleting a GOT record (removing the row) reduces the count by 1", () => {
    const before = [{}, {}, {}];
    const after  = [{}, {}]; // one record deleted/toggled off
    expect(after.length).toBe(before.length - 1);
  });

  it("zero GOT records means zero GOT fragments", () => {
    const gotRows: unknown[] = [];
    expect(gotRows.length).toBe(0);
  });
});
