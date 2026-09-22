import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardSummary, useGetSpiritualHabits, useGetNotifications } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { objectPathToUrl } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  Clock,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  Award,
  Trophy,
  Heart,
  Sparkles,
  Bell,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
} from "date-fns";

const STELLAR_LEGEND: { code: string; label: string }[] = [
  { code: "SBG", label: "Saved by Grace" },
  { code: "P2S", label: "Permitted to Share" },
  { code: "S2B", label: "Sharing to Bear" },
  { code: "P2G", label: "Pleasing to God" },
];

const HABIT_DEFS = [
  { code: "SHC001", label: "Prayer", type: "daily", max: 7 },
  { code: "SHC002", label: "Devotion", type: "daily", max: 7 },
  { code: "SHC004", label: "Worship Attendance", type: "weekly", max: 1 },
  { code: "SHC006", label: "CG Attendance", type: "weekly", max: 1 },
  { code: "SHC005", label: "Biblical Notes", type: "weekly", max: 1 },
  { code: "SHC003", label: "Member GOT", type: "weekly", max: 1 },
  { code: "SHC007", label: "Sharing Huddle", type: "monthly", max: 1 },
];

const PROGRAM_TOTAL_DAYS = 3 * 365;

export default function Home() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);

  const baseWeek = startOfWeek(new Date(), { weekStartsOn: 0 });
  const selectedWeek = addWeeks(baseWeek, weekOffset);
  const selectedWeekStr = format(selectedWeek, "yyyy-MM-dd");
  const selectedWeekEnd = format(endOfWeek(selectedWeek, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const { data: dashboard, isLoading: dashLoading } = useGetDashboardSummary({
    query: { enabled: !!user, queryKey: ["/api/dashboard", user?.id] },
  });

  const { data: notifications } = useGetNotifications({
    query: { enabled: !!user, queryKey: ["/api/dashboard/notifications", user?.id] },
  });
  const unreadCount = (notifications ?? []).filter(n => !n.read).length;

  const { data: weeklyHabits, isLoading: habitsLoading } = useGetSpiritualHabits(
    { weekStart: selectedWeekStr },
    { query: { queryKey: ["/api/spiritual-habits", selectedWeekStr] } },
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Blessed morning";
    if (hour >= 12 && hour < 17) return "Blessed afternoon";
    return "Blessed evening";
  };

  /* ─── Analytics ────────────────────────────────────────────── */
  const prayerDone = (weeklyHabits?.prayer?.days ?? []).filter((d) => d.completed).length;
  const devotionDone = (weeklyHabits?.devotion?.days ?? []).filter((d) => d.completed).length;
  const worshipDone = weeklyHabits?.worshipAttendance?.attended ? 1 : 0;
  const cgDone = weeklyHabits?.cgAttendance?.attended ? 1 : 0;
  const biblicalDone = weeklyHabits?.biblicalNotes?.isDone ? 1 : 0;
  const gotDone = weeklyHabits?.got?.id ? 1 : 0;
  const huddleDone = weeklyHabits?.sharingHuddle?.attended ? 1 : 0;

  const completedCounts = [prayerDone, devotionDone, worshipDone, cgDone, biblicalDone, gotDone, huddleDone];
  const totalCompleted = completedCounts.reduce((a, b) => a + b, 0);
  const totalPossible = HABIT_DEFS.reduce((a, h) => a + h.max, 0); // 18

  const habitCompleted = (code: string) => {
    const map: Record<string, number> = {
      SHC001: prayerDone,
      SHC002: devotionDone,
      SHC004: worshipDone,
      SHC006: cgDone,
      SHC005: biblicalDone,
      SHC003: gotDone,
      SHC007: huddleDone,
    };
    return map[code] ?? 0;
  };

  /* ─── Bearing Counter ──────────────────────────────────────── */
  const bearingReached =
    user?.stellarStatus === "S2B" || user?.stellarStatus === "P2G";
  const daysLeft = dashboard?.daysRemaining ?? null;
  const elapsed =
    daysLeft !== null ? Math.max(0, PROGRAM_TOTAL_DAYS - daysLeft) : 0;
  const bearingProgress = Math.min(100, (elapsed / PROGRAM_TOTAL_DAYS) * 100);

  /* ─── Stars ────────────────────────────────────────────────── */
  const renderStars = (status?: string) => {
    const activeCount =
      status === "SBG" ? 1 : status === "P2S" ? 2 : status === "S2B" ? 3 : status === "P2G" ? 4 : 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((star) => (
          <Star
            key={star}
            className={`h-6 w-6 ${star <= activeCount ? "text-primary fill-primary" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  /* ─── CSV Export ───────────────────────────────────────────── */
  function handleExport() {
    const rows = [
      ["Week Start", "Week End", "Habit", "Code", "Type", "Completed", "Max Possible"],
      [selectedWeekStr, selectedWeekEnd, "Daily Prayer", "SHC001", "Daily", prayerDone, 7],
      [selectedWeekStr, selectedWeekEnd, "Daily Devotion", "SHC002", "Daily", devotionDone, 7],
      [selectedWeekStr, selectedWeekEnd, "Worship Attendance", "SHC004", "Weekly", worshipDone, 1],
      [selectedWeekStr, selectedWeekEnd, "CG Attendance", "SHC006", "Weekly", cgDone, 1],
      [selectedWeekStr, selectedWeekEnd, "Biblical Notes", "SHC005", "Weekly", biblicalDone, 1],
      [selectedWeekStr, selectedWeekEnd, "Member GOT", "SHC003", "Weekly", gotDone, 1],
      [selectedWeekStr, selectedWeekEnd, "Sharing Huddle", "SHC007", "Monthly", huddleDone, 1],
      ["", "", "TOTAL", "", "", totalCompleted, totalPossible],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habits-${selectedWeekStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (dashLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Greeting ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">
            {getGreeting()}, {user?.firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">Let your light shine before others.</p>
        </div>
        {unreadCount > 0 && (
          <div className="relative shrink-0 mt-1">
            <Bell className="h-6 w-6 text-muted-foreground" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* ── Notifications ── */}
      {unreadCount > 0 && (
        <div className="space-y-2">
          {(notifications ?? []).filter(n => !n.read).slice(0, 3).map(n => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium capitalize text-xs text-primary mb-0.5">{n.type}</p>
                <p className="text-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Row 1: Profile + Bearing Counter ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile & Status */}
        <Card className="lg:col-span-2 border-primary/20 shadow-md bg-card/50 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={objectPathToUrl(user?.profilePicture ?? null)} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {`${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold leading-none">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Profile & Status</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Church ID */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Church ID</span>
              <span className="font-mono font-semibold text-sm bg-muted px-2 py-0.5 rounded tracking-wide">
                {user?.churchId}
              </span>
            </div>

            {/* Status & Fragments */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Stellar Status</p>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/20 text-lg py-1 px-3"
                  >
                    {user?.stellarStatus}
                  </Badge>
                  {renderStars(user?.stellarStatus)}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {STELLAR_LEGEND.find((l) => l.code === user?.stellarStatus)?.label ?? ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                  <Sparkles className="h-3.5 w-3.5" />
                  Stellar Fragments
                </p>
                <p className="text-4xl font-bold text-primary mt-1">
                  {dashboard?.stellarFragments ?? 0}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                Status Legend
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {STELLAR_LEGEND.map(({ code, label }) => (
                  <div key={code} className="flex items-center gap-2 text-sm">
                    <span
                      className={`font-mono font-semibold text-xs px-1.5 py-0.5 rounded ${
                        user?.stellarStatus === code
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {code}
                    </span>
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bearing Counter */}
        <Card
          className={`border shadow-md ${
            bearingReached
              ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/20"
              : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart
                className={`h-5 w-5 ${bearingReached ? "text-green-500 fill-green-500" : "text-amber-500"}`}
              />
              Bearing Journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bearingReached ? (
              <div className="text-center space-y-3 py-2">
                <div className="text-5xl">🎉</div>
                <p className="font-serif font-bold text-green-700 dark:text-green-400 text-lg leading-tight">
                  Congratulations!
                </p>
                <p className="text-sm text-muted-foreground">
                  You have reached <strong>Sharing to Bear</strong> status. Keep bearing fruit for
                  His glory!
                </p>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                  {user?.stellarStatus === "P2G" ? "Pleasing to God ✦" : "Sharing to Bear ✦"}
                </Badge>
              </div>
            ) : (
              <div className="space-y-4">
                {daysLeft !== null ? (
                  <>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-amber-600 dark:text-amber-400">
                        {daysLeft}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">days remaining</p>
                    </div>
                    <Progress
                      value={bearingProgress}
                      className="h-2 bg-amber-100 dark:bg-amber-950"
                    />
                    <p className="text-xs text-center text-muted-foreground">
                      {Math.round(bearingProgress)}% of your 3-year journey
                    </p>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <Award className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  </div>
                )}
                <p className="text-xs text-amber-700 dark:text-amber-400 text-center leading-relaxed border-t border-amber-200 dark:border-amber-800 pt-3">
                  Please be mindful of your days. Work your faith journey to reach{" "}
                  <strong>Sharing to Bear</strong>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Habit Analytics ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Habit Analytics
            </CardTitle>
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[190px] text-center">
                {weekOffset === 0
                  ? "Current Week"
                  : weekOffset === -1
                    ? "Last Week"
                    : format(selectedWeek, "MMM d")} &nbsp;
                <span className="text-xs text-muted-foreground font-normal">
                  ({selectedWeekStr} – {selectedWeekEnd})
                </span>
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
                disabled={weekOffset >= 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Extract Details
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {totalCompleted}
                <span className="text-sm font-normal text-muted-foreground">/{totalPossible}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 text-center">
              <p className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                <Flame className="h-5 w-5" />
                {dashboard?.streakDays ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Day Streak</p>
            </div>
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-1">
                <Sparkles className="h-5 w-5" />
                {dashboard?.stellarFragments ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Fragments</p>
            </div>
          </div>

          {/* Per-habit breakdown */}
          {habitsLoading ? (
            <div className="space-y-2">
              {HABIT_DEFS.map((h) => (
                <Skeleton key={h.code} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {HABIT_DEFS.map((h) => {
                const done = habitCompleted(h.code);
                const pct = Math.round((done / h.max) * 100);
                const perfect = done === h.max;
                return (
                  <div key={h.code} className="flex items-center gap-3">
                    <span
                      className={`font-mono text-xs w-16 shrink-0 px-1.5 py-0.5 rounded text-center ${
                        perfect
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {h.code}
                    </span>
                    <span className="text-sm w-40 shrink-0 text-foreground">{h.label}</span>
                    <div className="flex-1">
                      <Progress value={pct} className="h-2" />
                    </div>
                    <span className="text-xs font-medium w-10 text-right shrink-0 text-muted-foreground">
                      {done}/{h.max}
                    </span>
                    {perfect && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    {!perfect && done === 0 && (
                      <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    {!perfect && done > 0 && (
                      <div className="h-4 w-4 shrink-0 rounded-full border-2 border-primary/60" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: Countdown ── */}
      {user?.discipleshipEnabled && daysLeft !== null && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Remaining Discipleship Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {daysLeft}{" "}
              <span className="text-xl font-normal text-muted-foreground">days</span>
            </div>
            {dashboard?.targetExpiryDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Ends {dashboard.targetExpiryDate}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HabitStatusItem({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3 pr-4">
      {done ? (
        <CheckCircle2 className="h-5 w-5 text-primary" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
