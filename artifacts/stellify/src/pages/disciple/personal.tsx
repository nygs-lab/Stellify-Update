import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetPersonalHabitsWeek,
  useAddPersonalHabit,
  useRemovePersonalHabit,
  useLogPersonalHabit,
  getGetPersonalHabitsWeekQueryKey,
  type PersonalHabitWeek,
  type PersonalHabitDayLog,
  PersonalHabitInputAspect,
  PersonalHabitInputFrequency,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Star,
  Target,
  Library,
  Pencil,
  Check,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// ─── PHC Library ─────────────────────────────────────────────────────────────

type PhcEntry = {
  habitCode: string;
  habitName: string;
  aspect: PersonalHabitInputAspect;
  frequency: PersonalHabitInputFrequency;
  description: string;
  boundType: string | null;
  targetValue: number | null;
  targetUnit: string | null;
};

const PHC_LIBRARY: PhcEntry[] = [
  {
    habitCode: "PHC001",
    habitName: "Quality Sleep",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "7–9 hours of consistent nightly sleep for full restoration.",
    boundType: "time",
    targetValue: 7,
    targetUnit: "hours",
  },
  {
    habitCode: "PHC002",
    habitName: "Meditation & Gratitude",
    aspect: PersonalHabitInputAspect.Mental,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Quiet reflection, gratitude journaling, or centering prayer.",
    boundType: "time",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC003",
    habitName: "Workout / Exercise",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Any intentional physical exercise — gym, run, stretching.",
    boundType: "time",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC004",
    habitName: "Proper Diet",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Eating balanced, wholesome meals. Log % dietary adherence.",
    boundType: "calorie",
    targetValue: null,
    targetUnit: "%",
  },
  {
    habitCode: "PHC005",
    habitName: "Hydration",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "At least 8 glasses / 2L of water daily.",
    boundType: "volume",
    targetValue: 2,
    targetUnit: "liters",
  },
  {
    habitCode: "PHC006",
    habitName: "Medication / Supplement",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Take prescribed medication or daily vitamins on time.",
    boundType: "count",
    targetValue: 1,
    targetUnit: "dose",
  },
  {
    habitCode: "PHC007",
    habitName: "Reading",
    aspect: PersonalHabitInputAspect.Mental,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Read books, articles, or devotionals intentionally.",
    boundType: "time",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC008",
    habitName: "Learn Something New",
    aspect: PersonalHabitInputAspect.Mental,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Study a skill, language, or subject. Log time invested.",
    boundType: "time",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC009",
    habitName: "Financial Stewardship",
    aspect: PersonalHabitInputAspect.Financial,
    frequency: PersonalHabitInputFrequency.Weekly,
    description: "Budget review and responsible spending within your plan.",
    boundType: "custom",
    targetValue: null,
    targetUnit: null,
  },
  {
    habitCode: "PHC010",
    habitName: "Minimize Social Media",
    aspect: PersonalHabitInputAspect.SelfControl,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Intentionally limit social media screen time each day.",
    boundType: "negative",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC011",
    habitName: "Minimize Binge Watching",
    aspect: PersonalHabitInputAspect.SelfControl,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Limit streaming and binge-watching to healthy levels.",
    boundType: "negative",
    targetValue: null,
    targetUnit: "minutes",
  },
  {
    habitCode: "PHC012",
    habitName: "Blood Pressure Monitor",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Daily,
    description: "Log systolic BP reading daily. Note in the metric column.",
    boundType: "bp",
    targetValue: null,
    targetUnit: "mmHg",
  },
  {
    habitCode: "PHC013",
    habitName: "Weight Tracking",
    aspect: PersonalHabitInputAspect.Physical,
    frequency: PersonalHabitInputFrequency.Weekly,
    description: "Saturday weigh-in. Log weight in kg for BMI tracking.",
    boundType: "weight",
    targetValue: null,
    targetUnit: "kg",
  },
  {
    habitCode: "PHC014",
    habitName: "Financial Side Hustle",
    aspect: PersonalHabitInputAspect.Financial,
    frequency: PersonalHabitInputFrequency.Custom,
    description: "Track time invested in side income-generating activities.",
    boundType: "time",
    targetValue: null,
    targetUnit: "minutes",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDates(weekStart: string): string[] {
  return DAYS.map((_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function getSundayDate(offset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

const ASPECT_COLORS: Record<string, string> = {
  Physical: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Mental: "bg-violet-100 text-violet-800 border-violet-200",
  Financial: "bg-amber-100 text-amber-800 border-amber-200",
  SelfControl: "bg-rose-100 text-rose-800 border-rose-200",
};

function hasMetric(boundType: string | null | undefined): boolean {
  return !!boundType && !["custom", null].includes(boundType);
}

function metricLabel(boundType: string | null | undefined, targetUnit: string | null | undefined): string {
  switch (boundType) {
    case "time": return `Duration (${targetUnit ?? "min"})`;
    case "volume": return `Volume (${targetUnit ?? "L"})`;
    case "count": return `Count (${targetUnit ?? "dose"})`;
    case "calorie": return `Adherence (${targetUnit ?? "%"})`;
    case "negative": return `Used (${targetUnit ?? "min"})`;
    case "bp": return `Systolic (${targetUnit ?? "mmHg"})`;
    case "weight": return `Weight (${targetUnit ?? "kg"})`;
    default: return "Metric";
  }
}

function targetLabel(targetValue: number | null | undefined, targetUnit: string | null | undefined): string {
  if (!targetValue) return "";
  return `Target ≥ ${targetValue} ${targetUnit ?? ""}`;
}

// ─── Habit Card ───────────────────────────────────────────────────────────────

function PersonalHabitCard({
  habit,
  weekStart,
  isPhowWindow,
  onRemove,
}: {
  habit: PersonalHabitWeek;
  weekStart: string;
  isPhowWindow: boolean;
  onRemove: (id: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logHabit = useLogPersonalHabit();

  // Local pending edits for L3B (metric/duration) fields — saved on blur
  const [pendingMetrics, setPendingMetrics] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Level tracking — persisted in localStorage per habit ID
  const [l2On, setL2On] = useState<boolean>(() => {
    try { return localStorage.getItem(`stellify_phc_l2_${habit.id}`) !== "0"; } catch { return true; }
  });
  const [l3On, setL3On] = useState<boolean>(() => {
    try { return localStorage.getItem(`stellify_phc_l3_${habit.id}`) !== "0"; } catch { return true; }
  });

  function toggleL2() {
    const next = !l2On;
    setL2On(next);
    if (!next) { setL3On(false); try { localStorage.setItem(`stellify_phc_l3_${habit.id}`, "0"); } catch {} }
    try { localStorage.setItem(`stellify_phc_l2_${habit.id}`, next ? "1" : "0"); } catch {}
  }

  function toggleL3() {
    if (!l2On) return;
    const next = !l3On;
    setL3On(next);
    try { localStorage.setItem(`stellify_phc_l3_${habit.id}`, next ? "1" : "0"); } catch {}
  }

  const today = toDateString(new Date());
  const weekDates = getWeekDates(weekStart);

  // Per-column date guards
  function isDateFuture(di: number): boolean {
    return weekDates[di] > today;
  }
  function isDatePreHabit(di: number): boolean {
    return !!habit.createdAt && weekDates[di] < habit.createdAt;
  }
  function isColumnDisabled(di: number): boolean {
    return isDateFuture(di) || isDatePreHabit(di);
  }
  function columnTitle(di: number): string | undefined {
    if (isDateFuture(di)) return "Can't log a future date";
    if (isDatePreHabit(di)) return "Can't log before this habit was added";
    return undefined;
  }

  function getLog(dayIdx: number): PersonalHabitDayLog {
    return (
      habit.weekLogs[dayIdx] ?? {
        dayOfWeek: dayIdx,
        logDate: "",
        completed: false,
        compliant: false,
        committed: false,
        durationMinutes: null,
        metricValue: null,
        notes: null,
      }
    );
  }

  async function toggleField(
    dayIdx: number,
    field: "completed" | "compliant" | "committed"
  ) {
    const log = getLog(dayIdx);
    const newVal = !log[field];
    // If unchecking completed, also clear compliant + committed
    const patch: Record<string, boolean> = { [field]: newVal };
    if (field === "completed" && !newVal) {
      patch.compliant = false;
      patch.committed = false;
    }
    try {
      await logHabit.mutateAsync({
        id: habit.id,
        data: {
          logDate: log.logDate || weekStart,
          completed: field === "completed" ? newVal : !!log.completed,
          compliant: field === "compliant" ? newVal : !!log.compliant,
          committed: field === "committed" ? newVal : !!log.committed,
          durationMinutes: log.durationMinutes ?? undefined,
          metricValue: log.metricValue ?? undefined,
          notes: log.notes ?? undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetPersonalHabitsWeekQueryKey({ weekStart }) });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
    } catch {
      toast({ variant: "destructive", title: "Couldn't save", description: "Please try again." });
    }
  }

  async function saveMetric(dayIdx: number) {
    const log = getLog(dayIdx);
    const rawKey = `${habit.id}:${dayIdx}`;
    const rawVal = pendingMetrics[rawKey];
    if (rawVal === undefined) return;
    const numVal = rawVal === "" ? null : parseFloat(rawVal);
    setSaving((s) => ({ ...s, [rawKey]: true }));
    try {
      await logHabit.mutateAsync({
        id: habit.id,
        data: {
          logDate: log.logDate || weekStart,
          completed: !!log.completed,
          compliant: !!log.compliant,
          committed: !!log.committed,
          durationMinutes: undefined,
          metricValue: numVal ?? undefined,
          notes: log.notes ?? undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetPersonalHabitsWeekQueryKey({ weekStart }) });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setPendingMetrics((p) => {
        const n = { ...p };
        delete n[rawKey];
        return n;
      });
    } catch {
      toast({ variant: "destructive", title: "Couldn't save metric", description: "Please try again." });
    } finally {
      setSaving((s) => ({ ...s, [rawKey]: false }));
    }
  }

  // ─── Summary calculations ───────────────────────────────────────────────

  const logs = habit.weekLogs;
  const daysCompleted = logs.filter((l) => l.completed).length;
  const daysCompliant = logs.filter((l) => l.compliant).length;
  const daysCommitted = logs.filter((l) => l.committed).length;
  const totalMetric = logs.reduce((sum, l) => sum + (l.metricValue ?? 0), 0);
  const expectedDays = habit.frequency === "Weekly" ? 1 : 7;
  const pctComplete = expectedDays > 0 ? Math.round((daysCompleted / expectedDays) * 100) : 0;

  const showMetric = hasMetric(habit.boundType);
  const hasTarget = !!habit.targetValue;

  const isCurrentWeek = weekStart === toDateString(getSundayDate(0));

  return (
    <div className="rounded-2xl overflow-hidden border border-blue-200 shadow-md">
      {/* ── Blue Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Left: logo + habit info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-300 fill-yellow-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded">
                  {habit.habitCode}
                </span>
                <h3 className="font-semibold text-sm leading-tight">{habit.habitName}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-medium ${
                    ASPECT_COLORS[habit.aspect] ?? "bg-white/20 text-white border-white/20"
                  }`}
                >
                  {habit.aspect}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-blue-200">
                <span>{habit.frequency}</span>
                {habit.description && (
                  <span className="truncate max-w-[220px]">{habit.description}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: status + remove */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isCurrentWeek
                  ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/40"
                  : "bg-white/10 text-blue-200 border border-white/20"
              }`}
            >
              {isCurrentWeek ? "On-Going" : "Past Week"}
            </span>
            {isPhowWindow && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-red-300 hover:bg-white/10"
                onClick={() => onRemove(habit.id)}
                aria-label="Remove habit"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats pills row */}
        <div className="flex flex-wrap gap-2 mt-2.5 text-xs text-blue-100">
          <span className="bg-white/10 px-2 py-0.5 rounded">
            🔥 {habit.currentStreak ?? 0} day streak
          </span>
          <span className="bg-white/10 px-2 py-0.5 rounded">
            ✦ {habit.stellarFragments ?? 0} fragments
          </span>
          {hasTarget && (
            <span className="bg-white/10 px-2 py-0.5 rounded">
              🎯 {targetLabel(habit.targetValue, habit.targetUnit)}
            </span>
          )}
        </div>

        {/* Level ON/OFF toggles */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-white/10 text-xs">
          <span className="text-blue-300 mr-0.5">Track Levels:</span>
          <span className="bg-emerald-500/40 text-white border border-emerald-400/50 px-2 py-0.5 rounded font-medium">
            L1 ON
          </span>
          <button
            type="button"
            onClick={toggleL2}
            className={`px-2 py-0.5 rounded font-medium border transition-colors ${
              l2On
                ? "bg-emerald-500/40 text-white border-emerald-400/50"
                : "bg-white/10 text-blue-300 border-white/20"
            }`}
          >
            L2 {l2On ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={toggleL3}
            disabled={!l2On}
            className={`px-2 py-0.5 rounded font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              l3On && l2On
                ? "bg-emerald-500/40 text-white border-emerald-400/50"
                : "bg-white/10 text-blue-300 border-white/20"
            }`}
          >
            L3 {l3On && l2On ? "ON" : "OFF"}
          </button>
          <span className="text-blue-300 ml-1">
            · {l3On && l2On ? "Max fragments" : l2On ? "Medium fragments" : "Basic fragments"}
          </span>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────── */}
      <div className="bg-white overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-100">
              <th className="text-left px-3 py-2 font-semibold text-blue-900 w-32 min-w-[7rem]">
                Level
              </th>
              {DAYS.map((d, di) => {
                const disabled = isColumnDisabled(di);
                const hint = columnTitle(di);
                return (
                  <th
                    key={d}
                    title={hint}
                    className={`px-1 py-2 font-semibold text-center w-10 ${
                      disabled ? "text-gray-300" : "text-blue-800"
                    }`}
                  >
                    <div>{d}</div>
                    <div className={`text-[9px] font-normal leading-tight ${disabled ? "text-gray-300" : "text-blue-400"}`}>
                      {weekDates[di].slice(5)}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2 font-semibold text-blue-900 text-right min-w-[5rem]">
                Summary
              </th>
            </tr>
          </thead>
          <tbody>
            {/* L1: Task Completion */}
            <tr className="border-b border-gray-100 hover:bg-blue-50/30">
              <td className="px-3 py-2 text-gray-700">
                <div className="font-medium text-blue-800">L1 Completion</div>
                <div className="text-gray-400 text-[10px]">Did you do it?</div>
              </td>
              {DAYS.map((_, di) => {
                const log = getLog(di);
                const disabled = isColumnDisabled(di);
                return (
                  <td key={di} className="px-1 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!log.completed}
                      disabled={disabled}
                      title={columnTitle(di)}
                      onChange={() => toggleField(di, "completed")}
                      className="h-4 w-4 rounded border-2 border-blue-300 accent-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                    />
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-semibold text-blue-800">
                {daysCompleted}/{Math.min(7, expectedDays * 7)} done
              </td>
            </tr>

            {/* L2: Task Compliance — hidden when l2On is OFF */}
            {l2On && (
              <tr className="border-b border-gray-100 hover:bg-blue-50/30">
                <td className="px-3 py-2 text-gray-700">
                  <div className="font-medium text-indigo-700">L2 Compliance</div>
                  <div className="text-gray-400 text-[10px]">Done correctly?</div>
                </td>
                {DAYS.map((_, di) => {
                  const log = getLog(di);
                  const disabled = isColumnDisabled(di);
                  return (
                    <td key={di} className="px-1 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!log.compliant}
                        disabled={disabled || !log.completed}
                        title={columnTitle(di)}
                        onChange={() => toggleField(di, "compliant")}
                        className="h-4 w-4 rounded border-2 border-indigo-300 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                  {daysCompliant}/{daysCompleted} compliant
                </td>
              </tr>
            )}

            {/* L3A: Time Committed — only when l3On + l2On + showMetric */}
            {l2On && l3On && showMetric && habit.boundType !== "bp" && habit.boundType !== "weight" && (
              <tr className="border-b border-gray-100 hover:bg-blue-50/30">
                <td className="px-3 py-2 text-gray-700">
                  <div className="font-medium text-teal-700">L3A Committed</div>
                  <div className="text-gray-400 text-[10px]">
                    {habit.boundType === "negative" ? "Within limit?" : hasTarget ? `Met target?` : "Time committed?"}
                  </div>
                </td>
                {DAYS.map((_, di) => {
                  const log = getLog(di);
                  const disabled = isColumnDisabled(di);
                  return (
                    <td key={di} className="px-1 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!log.committed}
                        disabled={disabled || !log.completed}
                        title={columnTitle(di)}
                        onChange={() => toggleField(di, "committed")}
                        className="h-4 w-4 rounded border-2 border-teal-300 accent-teal-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-teal-700">
                  {daysCommitted}/{daysCompleted} committed
                </td>
              </tr>
            )}

            {/* L3B: Metric / Duration — only when l3On + l2On + showMetric */}
            {l2On && l3On && showMetric && (
              <tr className="hover:bg-blue-50/30">
                <td className="px-3 py-2 text-gray-700">
                  <div className="font-medium text-amber-700">L3B {habit.boundType === "bp" || habit.boundType === "weight" ? "Reading" : "Duration"}</div>
                  <div className="text-gray-400 text-[10px]">
                    {metricLabel(habit.boundType, habit.targetUnit)}
                  </div>
                </td>
                {DAYS.map((_, di) => {
                  const log = getLog(di);
                  const disabled = isColumnDisabled(di);
                  const key = `${habit.id}:${di}`;
                  const displayVal =
                    key in pendingMetrics
                      ? pendingMetrics[key]
                      : log.metricValue !== null && log.metricValue !== undefined
                      ? String(log.metricValue)
                      : "";
                  return (
                    <td key={di} className="px-1 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        step={habit.boundType === "weight" ? 0.1 : 1}
                        value={displayVal}
                        disabled={disabled}
                        title={columnTitle(di)}
                        placeholder="—"
                        onChange={(e) =>
                          setPendingMetrics((p) => ({ ...p, [key]: e.target.value }))
                        }
                        onBlur={() => saveMetric(di)}
                        className={`w-9 h-6 text-center text-[10px] border rounded bg-white border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-30 disabled:cursor-not-allowed ${
                          saving[key] ? "opacity-50" : ""
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-amber-700">
                  Σ {Math.round(totalMetric * 10) / 10} {habit.targetUnit ?? ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer summary bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
          <span>Week completion: <strong>{daysCompleted}</strong> of {expectedDays === 1 ? "1 required day" : "7 days"}</span>
          <span className={`font-bold ${pctComplete >= 80 ? "text-emerald-600" : pctComplete >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {pctComplete}%
          </span>
        </div>

        {/* Date restriction notice */}
        {(() => {
          const hasFuture = DAYS.some((_, di) => isDateFuture(di));
          const hasPreHabit = DAYS.some((_, di) => isDatePreHabit(di));
          if (!hasFuture && !hasPreHabit) return null;
          return (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0">ⓘ</span>
              <span>
                {hasFuture && hasPreHabit
                  ? "Greyed-out columns are either in the future or before this habit was added — logging is only allowed for eligible past dates."
                  : hasFuture
                  ? "Future dates are greyed out — you can only log today or earlier."
                  : "Some dates are greyed out because this habit hadn't been added yet on those days."}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Library Card (for picker dialog) ────────────────────────────────────────

function LibraryCard({
  entry,
  isAdded,
  onAdd,
  disabled,
}: {
  entry: PhcEntry;
  isAdded: boolean;
  onAdd: (entry: PhcEntry) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
        isAdded
          ? "bg-blue-50 border-blue-300"
          : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {entry.habitCode}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                ASPECT_COLORS[entry.aspect] ?? "bg-gray-100 text-gray-700 border-gray-200"
              }`}
            >
              {entry.aspect}
            </span>
          </div>
          <p className="font-semibold text-sm text-gray-800 mt-1 leading-tight">{entry.habitName}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-tight">{entry.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{entry.frequency}</span>
        <Button
          size="sm"
          variant={isAdded ? "secondary" : "default"}
          className="h-7 text-xs px-3"
          disabled={disabled || isAdded}
          onClick={() => onAdd(entry)}
        >
          {isAdded ? (
            <>
              <Check className="h-3 w-3 mr-1" /> Added
            </>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" /> Add
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PersonalTracker() {
  const { user } = useAuth();

  if (user && !user.discipleshipEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Discipleship Disabled</h2>
        <p className="text-muted-foreground max-w-sm">
          Your discipleship tracking has been disabled by an administrator. Please contact your church admin for assistance.
        </p>
      </div>
    );
  }

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = toDateString(getSundayDate(weekOffset));
  const weekEnd = toDateString(getSundayDate(weekOffset + 1 - 1 / 7));

  const { data: habits, isLoading } = useGetPersonalHabitsWeek({ weekStart });

  const addHabit = useAddPersonalHabit();
  const removeHabit = useRemovePersonalHabit();

  // PHOW enforcement temporarily disabled — re-enable by restoring the 3 lines below:
  // const isSunday = new Date().getDay() === 0;
  // const currentHour = new Date().getHours();
  // const isPhowWindow = isSunday && currentHour >= 8 && currentHour < 20;
  const isPhowWindow = true;

  const [addOpen, setAddOpen] = useState(false);

  // Custom tab state
  const [customName, setCustomName] = useState("");
  const [customAspect, setCustomAspect] = useState<PersonalHabitInputAspect>(
    PersonalHabitInputAspect.Physical
  );
  const [customFreq, setCustomFreq] = useState<PersonalHabitInputFrequency>(
    PersonalHabitInputFrequency.Daily
  );
  const [customDesc, setCustomDesc] = useState("");

  const activeCodes = new Set(habits?.map((h) => h.habitCode) ?? []);

  async function handleAddLibrary(entry: PhcEntry) {
    try {
      await addHabit.mutateAsync({
        data: {
          habitCode: entry.habitCode,
          habitName: entry.habitName,
          aspect: entry.aspect,
          frequency: entry.frequency,
          description: entry.description,
          isCustom: false,
          boundType: entry.boundType,
          targetValue: entry.targetValue,
          targetUnit: entry.targetUnit,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetPersonalHabitsWeekQueryKey({ weekStart }) });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      toast({ title: `${entry.habitName} added`, description: "It's now part of your routine." });
    } catch {
      toast({ variant: "destructive", title: "Could not add habit" });
    }
  }

  async function handleAddCustom() {
    if (!customName.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    try {
      await addHabit.mutateAsync({
        data: {
          habitCode: `CUSTOM-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          habitName: customName.trim(),
          aspect: customAspect,
          frequency: customFreq,
          description: customDesc.trim() || null,
          isCustom: true,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetPersonalHabitsWeekQueryKey({ weekStart }) });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      toast({ title: "Custom habit added" });
      setAddOpen(false);
      setCustomName("");
      setCustomDesc("");
    } catch {
      toast({ variant: "destructive", title: "Could not add habit" });
    }
  }

  async function handleRemove(id: number) {
    try {
      await removeHabit.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetPersonalHabitsWeekQueryKey({ weekStart }) });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      toast({ title: "Habit removed" });
    } catch {
      toast({ variant: "destructive", title: "Could not remove habit" });
    }
  }

  const sundayDate = getSundayDate(weekOffset);
  const saturdayDate = getSundayDate(weekOffset);
  saturdayDate.setDate(saturdayDate.getDate() + 6);
  const weekLabel = `${format(sundayDate, "MMM d")} – ${format(saturdayDate, "MMM d, yyyy")}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Personal Habits
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Physical · Mental · Financial · Self-Control disciplines
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week Navigator */}
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-700"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-blue-800 px-1 min-w-[130px] text-center">
              {weekLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-700"
              onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isPhowWindow && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add Habit
            </Button>
          )}
        </div>
      </div>

      {/* ── PHOW Banner ────────────────────────────────────── */}
      {!isPhowWindow && (
        <Alert className="bg-blue-50 border-blue-200">
          <Library className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">PHOW Window Closed</AlertTitle>
          <AlertDescription className="text-blue-700">
            Habits can only be added or removed on Sundays between 8:00 AM and 8:00 PM (Personal Habit Optimization Window). Logging is always available.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Habit Cards ─────────────────────────────────────── */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading habit cards…</div>
      ) : !habits || habits.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
            <Star className="h-7 w-7 text-blue-500 fill-blue-200" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">No Personal Habit Cards Yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mt-1">
              {isPhowWindow
                ? "Browse the habit library and add disciplines for this season."
                : "Come back on Sunday (8AM–8PM) to select habits from the library."}
            </p>
          </div>
          {isPhowWindow && (
            <Button
              className="bg-blue-700 hover:bg-blue-800 text-white gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <Library className="h-4 w-4" /> Browse Library
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {habits.map((habit) => (
            <PersonalHabitCard
              key={habit.id}
              habit={habit}
              weekStart={weekStart}
              isPhowWindow={isPhowWindow}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* ── Add Habit Dialog ─────────────────────────────────── */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) { setCustomName(""); setCustomDesc(""); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              Add Personal Habit Card
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="library" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="library">
                <Library className="h-3.5 w-3.5 mr-1.5" /> Pre-Made Library
              </TabsTrigger>
              <TabsTrigger value="custom">
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Custom Habit
              </TabsTrigger>
            </TabsList>

            {/* Library Tab */}
            <TabsContent value="library" className="flex-1 overflow-y-auto mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                {PHC_LIBRARY.map((entry) => (
                  <LibraryCard
                    key={entry.habitCode}
                    entry={entry}
                    isAdded={activeCodes.has(entry.habitCode)}
                    onAdd={handleAddLibrary}
                    disabled={addHabit.isPending}
                  />
                ))}
              </div>
            </TabsContent>

            {/* Custom Tab */}
            <TabsContent value="custom" className="mt-3">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Habit Name</Label>
                  <Input
                    placeholder="e.g. Morning Journaling"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Aspect</Label>
                    <Select
                      value={customAspect}
                      onValueChange={(v) => setCustomAspect(v as PersonalHabitInputAspect)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PersonalHabitInputAspect).map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frequency</Label>
                    <Select
                      value={customFreq}
                      onValueChange={(v) => setCustomFreq(v as PersonalHabitInputFrequency)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PersonalHabitInputFrequency).map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="What does success look like for this habit?"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                  onClick={handleAddCustom}
                  disabled={addHabit.isPending}
                >
                  {addHabit.isPending ? "Adding…" : "Add Custom Habit"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
