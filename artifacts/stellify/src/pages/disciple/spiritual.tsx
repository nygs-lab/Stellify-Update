import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle,
  Save,
  RotateCcw,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Unlock,
} from "lucide-react";
import {
  useGetSpiritualHabits,
  useLogSpiritualHabit,
  useLogWorshipAttendance,
  useLogSharingHuddle,
  useLogGotHabit,
  useLogBiblicalNotes,
  useLogCgAttendance,
  useUnlockHabitWeekAlias,
  type HabitDay,
  type SpiritualHabitLogInputHabitCode,
  type BiblicalNotesInput,
  type GotHabitInput,
  GotHabitInputBobReason,
  GotHabitInputSubmissionMethod,
  BiblicalNotesInputNoteType,
  type WorshipAttendanceInputAttendanceType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addWeeks } from "date-fns";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initDays(existing: HabitDay[] | undefined): HabitDay[] {
  const byDay = new Map<number, HabitDay>();
  for (let i = 0; i < 7; i++) {
    byDay.set(i, { dayOfWeek: i, completed: false, compliant: false, committed: true });
  }
  for (const d of existing ?? []) {
    byDay.set(d.dayOfWeek, { ...byDay.get(d.dayOfWeek)!, ...d, committed: true });
  }
  return Array.from(byDay.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function SHCBadge({ code }: { code: string }) {
  return (
    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-mono rounded border border-primary/20 shrink-0">
      {code}
    </span>
  );
}

function ClosedWeekBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      This week is closed — logging is no longer allowed for this period.
    </div>
  );
}

/* ─── SHC001 Prayer ──────────────────────────────────────────────────── */

function PrayerCard({
  days,
  weekStart,
  isLocked,
}: {
  days: HabitDay[] | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logHabit = useLogSpiritualHabit();
  const [pendingDays, setPendingDays] = useState<HabitDay[]>(() => initDays(days));
  const [isDirty, setIsDirty] = useState(false);
  const hasSavedData = days?.some(d => d.completed) ?? false;
  const [isEditing, setIsEditing] = useState(!hasSavedData);

  useEffect(() => {
    if (!isDirty) setPendingDays(initDays(days));
  }, [days, isDirty]);

  function toggleDay(i: number) {
    if (isLocked) return;
    setPendingDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === i ? { ...d, completed: !d.completed, compliant: !d.completed } : d,
      ),
    );
    setIsDirty(true);
  }

  function setDuration(i: number, val: string) {
    const mins = parseInt(val, 10) || null;
    setPendingDays((prev) =>
      prev.map((d) => (d.dayOfWeek === i ? { ...d, durationMinutes: mins } : d)),
    );
    setIsDirty(true);
  }

  async function handleSave() {
    const totalDuration = pendingDays.reduce((s, d) => s + (d.durationMinutes ?? 0), 0) || null;
    try {
      await logHabit.mutateAsync({
        data: { habitCode: "SHC001" as SpiritualHabitLogInputHabitCode, weekStart, days: pendingDays, totalDuration },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "Prayer log updated." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Daily Prayer</CardTitle>
            <CardDescription>L1 completion · L3B duration (minutes). Spend time talking and listening to God daily.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedData && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <SHCBadge code="SHC001" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-2">
              {(days ?? []).concat(Array.from({ length: Math.max(0, 7 - (days?.length ?? 0)) }, (_, i) => ({ dayOfWeek: (days?.length ?? 0) + i, completed: false, compliant: false, committed: true }))).sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((d) => (
                <div key={d.dayOfWeek} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{DAY_LABELS[d.dayOfWeek]}</span>
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${d.completed ? "bg-primary border-primary" : "bg-muted/30 border-border"}`}>
                    {d.completed && <CheckCircle className="h-4 w-4 text-primary-foreground" />}
                  </div>
                  {d.completed && (d as HabitDay).durationMinutes ? <span className="text-xs text-muted-foreground">{(d as HabitDay).durationMinutes}m</span> : null}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{(days ?? []).filter(d => d.completed).length}/7 days completed</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {pendingDays.map((d) => (
                <div key={d.dayOfWeek} className="flex flex-col items-center gap-1.5 p-2 rounded-md border border-border bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">{DAY_LABELS[d.dayOfWeek]}</span>
                  <button
                    type="button"
                    onClick={() => toggleDay(d.dayOfWeek)}
                    disabled={isLocked}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                      d.completed ? "bg-primary border-primary text-primary-foreground" : "hover:bg-accent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <CheckCircle className={`h-4 w-4 ${d.completed ? "text-primary-foreground" : "text-muted-foreground/30"}`} />
                  </button>
                  {d.completed && (
                    <Input
                      type="number"
                      min={0}
                      placeholder="min"
                      className="h-6 w-full text-xs text-center px-1"
                      value={d.durationMinutes ?? ""}
                      onChange={(e) => setDuration(d.dayOfWeek, e.target.value)}
                      disabled={isLocked}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              {hasSavedData && (
                <Button variant="ghost" size="sm" onClick={() => { setPendingDays(initDays(days)); setIsDirty(false); setIsEditing(false); }} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={() => { setPendingDays(initDays(days)); setIsDirty(false); }} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={logHabit.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logHabit.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC002 Devotion ────────────────────────────────────────────────── */
function DevotionCard({
  days,
  weekStart,
  isLocked,
}: {
  days: HabitDay[] | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logHabit = useLogSpiritualHabit();
  const [pendingDays, setPendingDays] = useState<HabitDay[]>(() => initDays(days));
  const [isDirty, setIsDirty] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const hasSavedData = days?.some(d => d.completed) ?? false;
  const [isEditing, setIsEditing] = useState(!hasSavedData);

  useEffect(() => {
    if (!isDirty) setPendingDays(initDays(days));
  }, [days, isDirty]);

  const DEVOTION_TYPES = ["Review Slide", "Watch Recording", "Audiobook", "Read Bible"];

  function toggleDay(i: number) {
    if (isLocked) return;
    setPendingDays((prev) =>
      prev.map((d) => (d.dayOfWeek === i ? { ...d, completed: !d.completed, compliant: !d.completed } : d)),
    );
    setIsDirty(true);
    if (!pendingDays.find((d) => d.dayOfWeek === i)?.completed) setExpandedDay(i);
    else setExpandedDay(null);
  }

  function setField(i: number, field: keyof HabitDay, val: string | number | null | boolean) {
    setPendingDays((prev) => prev.map((d) => (d.dayOfWeek === i ? { ...d, [field]: val } : d)));
    setIsDirty(true);
  }

  async function handleSave() {
    try {
      await logHabit.mutateAsync({
        data: { habitCode: "SHC002" as SpiritualHabitLogInputHabitCode, weekStart, days: pendingDays },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "Devotion log updated." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Daily Devotion</CardTitle>
            <CardDescription>Track scripture immersion. Select type and log details (max 2000 chars).</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedData && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <SHCBadge code="SHC002" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing ? (
          <div className="space-y-1">
            {(days ?? []).filter(d => d.completed).map(d => (
              <div key={d.dayOfWeek} className="flex items-center gap-2 text-sm py-1">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium w-8">{DAY_LABELS[d.dayOfWeek]}</span>
                <span className="text-muted-foreground">{d.devotionType ?? "—"}</span>
              </div>
            ))}
            {(days ?? []).filter(d => d.completed).length === 0 && (
              <p className="text-sm text-muted-foreground">No days logged yet.</p>
            )}
          </div>
        ) : (
          <>
            {pendingDays.map((d) => (
              <div key={d.dayOfWeek} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <span className="text-xs font-medium w-8 text-muted-foreground">{DAY_LABELS[d.dayOfWeek]}</span>
                  <button
                    type="button"
                    onClick={() => toggleDay(d.dayOfWeek)}
                    disabled={isLocked}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                      d.completed ? "bg-primary border-primary text-primary-foreground" : "hover:bg-accent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <CheckCircle className={`h-3.5 w-3.5 ${d.completed ? "text-primary-foreground" : "text-muted-foreground/30"}`} />
                  </button>
                  {d.completed && (
                    <span className="text-xs text-muted-foreground flex-1">
                      {d.devotionType ?? "No type selected"}
                    </span>
                  )}
                  {d.completed && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(expandedDay === d.dayOfWeek ? null : d.dayOfWeek)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {expandedDay === d.dayOfWeek ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                {d.completed && expandedDay === d.dayOfWeek && (
                  <div className="px-3 pb-3 space-y-3 border-t bg-muted/20 pt-3">
                    <div>
                      <Label className="text-xs">Devotion Type</Label>
                      <Select
                        value={d.devotionType ?? ""}
                        onValueChange={(v) => setField(d.dayOfWeek, "devotionType", v)}
                        disabled={isLocked}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1">
                          <SelectValue placeholder="Select type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVOTION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs flex justify-between">
                        Details
                        <span className="text-muted-foreground">{(d.devotionDetails ?? "").length}/2000</span>
                      </Label>
                      <Textarea
                        className="text-sm mt-1 resize-none"
                        rows={3}
                        maxLength={2000}
                        placeholder="What did you meditate on today?"
                        value={d.devotionDetails ?? ""}
                        onChange={(e) => setField(d.dayOfWeek, "devotionDetails", e.target.value)}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2 border-t">
              {hasSavedData && (
                <Button variant="ghost" size="sm" onClick={() => { setPendingDays(initDays(days)); setIsDirty(false); setIsEditing(false); }} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={() => { setPendingDays(initDays(days)); setIsDirty(false); }} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={logHabit.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logHabit.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC003 GOT / Treasury ──────────────────────────────────────────── */
function GotCard({
  existing,
  weekStart,
  isLocked,
}: {
  existing: { id?: number | null; giftAmount?: number | null; offeringAmount?: number | null; tithesAmount?: number | null; bobDeduction?: number | null; bobReason?: string | null; submissionMethod?: string | null; } | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logGot = useLogGotHabit();
  const submitted = existing?.id != null;
  const [isEditing, setIsEditing] = useState(!submitted);

  const [gift, setGift] = useState(String(existing?.giftAmount ?? ""));
  const [offering, setOffering] = useState(String(existing?.offeringAmount ?? ""));
  const [tithes, setTithes] = useState(String(existing?.tithesAmount ?? ""));
  const [bob, setBob] = useState(String(existing?.bobDeduction ?? ""));
  const [bobReason, setBobReason] = useState<string>(existing?.bobReason ?? "");
  const [method, setMethod] = useState<string>(existing?.submissionMethod ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const giftN = parseFloat(gift) || 0;
  const offeringN = parseFloat(offering) || 0;
  const tithesN = parseFloat(tithes) || 0;
  const bobN = parseFloat(bob) || 0;
  const total = giftN + offeringN + tithesN - bobN;

  function markDirty() { setIsDirty(true); }

  async function handleSave() {
    const payload: GotHabitInput = {
      weekStart,
      submitted: true,
      giftAmount: giftN || null,
      offeringAmount: offeringN || null,
      tithesAmount: tithesN || null,
      bobDeduction: bobN || null,
      bobReason: (bobReason as GotHabitInput["bobReason"]) || null,
      totalSubmission: total || null,
      submissionMethod: (method as GotHabitInput["submissionMethod"]) || null,
    };
    try {
      await logGot.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "GOT / Treasury submitted." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Precious Church Treasury (GOT)</CardTitle>
            <CardDescription>Gift + Offering + Tithes − Breaking of Bread = Total Submission</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {submitted && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {submitted && <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">Submitted</Badge>}
            <SHCBadge code="SHC003" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing && submitted ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Gift:</span> {Number(existing?.giftAmount ?? 0).toFixed(2)}</div>
              <div><span className="text-muted-foreground">Offering:</span> {Number(existing?.offeringAmount ?? 0).toFixed(2)}</div>
              <div><span className="text-muted-foreground">Tithes:</span> {Number(existing?.tithesAmount ?? 0).toFixed(2)}</div>
              <div><span className="text-muted-foreground">BOB Deduction:</span> {Number(existing?.bobDeduction ?? 0).toFixed(2)}</div>
            </div>
            <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-4 py-3">
              <span className="text-sm font-medium">Total Submission</span>
              <span className="text-xl font-bold text-primary">
                {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {existing?.submissionMethod && <p className="text-xs text-muted-foreground">Method: {existing.submissionMethod}</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Gift (G)</Label>
                <Input type="number" min={0} step="0.01" className="mt-1" placeholder="0.00"
                  value={gift} onChange={(e) => { setGift(e.target.value); markDirty(); }} disabled={isLocked} />
              </div>
              <div>
                <Label className="text-xs">Offering (O)</Label>
                <Input type="number" min={0} step="0.01" className="mt-1" placeholder="0.00"
                  value={offering} onChange={(e) => { setOffering(e.target.value); markDirty(); }} disabled={isLocked} />
              </div>
              <div>
                <Label className="text-xs">Tithes (T)</Label>
                <Input type="number" min={0} step="0.01" className="mt-1" placeholder="0.00"
                  value={tithes} onChange={(e) => { setTithes(e.target.value); markDirty(); }} disabled={isLocked} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <Label className="text-xs">Breaking of Bread (BOB) Deduction</Label>
                <Input type="number" min={0} step="0.01" className="mt-1" placeholder="0.00"
                  value={bob} onChange={(e) => { setBob(e.target.value); markDirty(); }} disabled={isLocked} />
              </div>
              <div>
                <Label className="text-xs">BOB Reason</Label>
                <Select value={bobReason} onValueChange={(v) => { setBobReason(v); markDirty(); }} disabled={isLocked}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(GotHabitInputBobReason).filter(Boolean).map((r) => (
                      <SelectItem key={r!} value={r!}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-4 py-3">
              <span className="text-sm font-medium">Total Submission</span>
              <span className="text-xl font-bold text-primary">
                {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <Label className="text-xs">Submission Method</Label>
              <Select value={method} onValueChange={(v) => { setMethod(v); markDirty(); }} disabled={isLocked}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select method…" /></SelectTrigger>
                <SelectContent>
                  {Object.values(GotHabitInputSubmissionMethod).filter(Boolean).map((m) => (
                    <SelectItem key={m!} value={m!}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              {submitted && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={logGot.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logGot.isPending ? "Saving…" : submitted ? "Update GOT" : "Submit GOT"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC004 Worship ─────────────────────────────────────────────────── */
function WorshipCard({
  existing,
  weekStart,
  isLocked,
}: {
  existing: { id?: number | null; attended?: boolean | null; attendanceType?: string | null; absenceReason?: string | null } | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logWorship = useLogWorshipAttendance();
  const hasSavedDataWorship = (existing?.id ?? 0) > 0;
  const [isEditing, setIsEditing] = useState(!hasSavedDataWorship);

  const [attended, setAttended] = useState<boolean | null>(existing?.attended ?? null);
  const [attendanceType, setAttendanceType] = useState(existing?.attendanceType ?? "");
  const [absenceReason, setAbsenceReason] = useState(existing?.absenceReason ?? "");
  const [isDirty, setIsDirty] = useState(false);

  async function handleSave(att: boolean) {
    try {
      await logWorship.mutateAsync({
        data: {
          weekStart,
          attended: att,
          attendanceType: att ? ((attendanceType as WorshipAttendanceInputAttendanceType) || null) : null,
          absenceReason: att ? null : (absenceReason || null),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "Worship attendance recorded." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Worship Service Attendance</CardTitle>
            <CardDescription>Record your attendance mode. If absent, provide a valid reason.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDataWorship && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <SHCBadge code="SHC004" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing && hasSavedDataWorship ? (
          <div className="flex items-center gap-2 text-sm">
            {existing?.attended ? (
              <>
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">{existing.attendanceType ?? "Attended"}</span>
              </>
            ) : (
              <>
                <span className="font-medium text-destructive">Absent</span>
                {existing?.absenceReason && <span className="text-muted-foreground">({existing.absenceReason})</span>}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              {["Online", "Onsite"].map((type) => (
                <Button
                  key={type}
                  variant={attended && attendanceType === type ? "default" : "outline"}
                  disabled={isLocked}
                  onClick={() => {
                    setAttended(true);
                    setAttendanceType(type);
                    setAbsenceReason("");
                    setIsDirty(true);
                  }}
                  className="flex-1 gap-2"
                >
                  {attended && attendanceType === type && <CheckCircle className="h-4 w-4" />}
                  {type}
                </Button>
              ))}
              <Button
                variant={attended === false ? "destructive" : "outline"}
                disabled={isLocked}
                onClick={() => {
                  setAttended(false);
                  setAttendanceType("");
                  setIsDirty(true);
                }}
                className="flex-1"
              >
                Absent
              </Button>
            </div>

            {attended === false && (
              <div>
                <Label className="text-xs">Absence Reason</Label>
                <Select
                  value={absenceReason}
                  onValueChange={(v) => { setAbsenceReason(v); setIsDirty(true); }}
                  disabled={isLocked}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {["Medical", "Academic", "Invalid"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t">
              {hasSavedDataWorship && (
                <Button variant="ghost" size="sm"
                  onClick={() => {
                    setAttended(existing?.attended ?? null);
                    setAttendanceType(existing?.attendanceType ?? "");
                    setAbsenceReason(existing?.absenceReason ?? "");
                    setIsDirty(false);
                    setIsEditing(false);
                  }}
                  className="gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button size="sm" onClick={() => handleSave(attended ?? false)} disabled={logWorship.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logWorship.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC005 Biblical Notes ──────────────────────────────────────────── */
const BSF_FIELDS: { key: keyof BiblicalNotesInput; label: string; multi?: boolean }[] = [
  { key: "bsfWholeContext", label: "Whole Context", multi: true },
  { key: "bsfSource", label: "The Source" },
  { key: "bsfReceiver", label: "The Receiver" },
  { key: "bsfRelation", label: "Relation" },
  { key: "bsfSpecificTopic", label: "Specific Topic" },
  { key: "bsfOutline", label: "Outline", multi: true },
  { key: "bsfApplication", label: "Application", multi: true },
  { key: "notes", label: "Member Notes", multi: true },
];

const BUP_OPTIONS = [
  "Direct God",
  "Direct Prophet",
  "Written Prophet",
  "Direct Jesus",
  "Direct Disciples",
  "Written Disciples",
];

function BiblicalCard({
  existing,
  weekStart,
  isLocked,
}: {
  existing: {
    isDone?: boolean;
    noteType?: string | null;
    notes?: string | null;
    bsfWholeContext?: string | null;
    bsfSource?: string | null;
    bsfReceiver?: string | null;
    bsfRelation?: string | null;
    bsfSpecificTopic?: string | null;
    bsfOutline?: string | null;
    bsfApplication?: string | null;
    bupSelection?: string | null;
  } | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logBiblical = useLogBiblicalNotes();
  const hasSavedDataBib = existing?.isDone ?? false;
  const [isEditing, setIsEditing] = useState(!hasSavedDataBib);

  const [noteType, setNoteType] = useState<string>(existing?.noteType ?? "");
  const [bsf, setBsf] = useState<Record<string, string>>({
    bsfWholeContext: existing?.bsfWholeContext ?? "",
    bsfSource: existing?.bsfSource ?? "",
    bsfReceiver: existing?.bsfReceiver ?? "",
    bsfRelation: existing?.bsfRelation ?? "",
    bsfSpecificTopic: existing?.bsfSpecificTopic ?? "",
    bsfOutline: existing?.bsfOutline ?? "",
    bsfApplication: existing?.bsfApplication ?? "",
    notes: existing?.notes ?? "",
  });
  const [bup, setBup] = useState<string[]>(
    existing?.bupSelection
      ? existing.bupSelection.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  const [isDirty, setIsDirty] = useState(false);

  function toggleBup(opt: string) {
    setBup((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
    );
    setIsDirty(true);
  }

  function updateBsf(key: string, val: string) {
    setBsf((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  }

  async function handleSave() {
    try {
      await logBiblical.mutateAsync({
        data: {
          weekStart,
          isDone: true,
          noteType: (noteType as BiblicalNotesInput["noteType"]) || null,
          notes: bsf.notes || null,
          bsfWholeContext: bsf.bsfWholeContext || null,
          bsfSource: bsf.bsfSource || null,
          bsfReceiver: bsf.bsfReceiver || null,
          bsfRelation: bsf.bsfRelation || null,
          bsfSpecificTopic: bsf.bsfSpecificTopic || null,
          bsfOutline: bsf.bsfOutline || null,
          bsfApplication: bsf.bsfApplication || null,
          bupSelection: bup.length > 0 ? bup.join(", ") : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "Biblical notes submitted." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  const isDone = existing?.isDone;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Biblical Message Notes</CardTitle>
            <CardDescription>Digital form (BSF + BUP) or handwritten photo. Validates scripture engagement.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDataBib && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {isDone && <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">Done</Badge>}
            <SHCBadge code="SHC005" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing && hasSavedDataBib ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">{existing?.noteType === "HandWritten" ? "Handwritten Notes Submitted" : "Digital Notes (BSF + BUP)"}</span>
            </div>
            {existing?.bupSelection && <p className="text-xs text-muted-foreground">BUP: {existing.bupSelection}</p>}
            {existing?.notes && <p className="text-xs text-muted-foreground line-clamp-2">Notes: {existing.notes}</p>}
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs font-semibold">Notes Type</Label>
              <div className="flex gap-3 mt-2">
            {Object.entries(BiblicalNotesInputNoteType).map(([, v]) => (
              <Button
                key={v}
                variant={noteType === v ? "default" : "outline"}
                size="sm"
                disabled={isLocked}
                onClick={() => { setNoteType(v); setIsDirty(true); }}
                className="flex-1"
              >
                {v === "HandWritten" ? "Handwritten Photo" : "Digital Notes"}
              </Button>
            ))}
          </div>
        </div>

        {noteType === "HandWritten" && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
            Photo upload coming soon. Mark as done once you have uploaded via the admin.
            <div className="mt-3">
              <Button size="sm" onClick={handleSave} disabled={logBiblical.isPending || isLocked}>
                Mark as Done
              </Button>
            </div>
          </div>
        )}

        {noteType === "Digital" && (
          <div className="space-y-4">
            {/* BUP Section — above BSF */}
            <div className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">BUP — Biblical Underlying Principle</p>
                {bup.length > 0 && (
                  <span className="text-xs text-primary font-medium">
                    {bup.length} selected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Select all that apply — who the message is from:</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {BUP_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={isLocked}
                    onClick={() => toggleBup(opt)}
                    className={`text-sm px-3 py-2 rounded-lg border text-left transition-colors ${
                      bup.includes(opt)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* BSF Section */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">BSF — Biblical Security Features</p>
              {BSF_FIELDS.map(({ key, label, multi }) => (
                <div key={String(key)}>
                  <Label className="text-xs">{label}</Label>
                  {multi ? (
                    <Textarea
                      className="text-sm mt-1 resize-none"
                      rows={2}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      value={bsf[String(key)] ?? ""}
                      onChange={(e) => updateBsf(String(key), e.target.value)}
                      disabled={isLocked}
                    />
                  ) : (
                    <Input
                      className="text-sm mt-1"
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      value={bsf[String(key)] ?? ""}
                      onChange={(e) => updateBsf(String(key), e.target.value)}
                      disabled={isLocked}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              {hasSavedDataBib && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={logBiblical.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logBiblical.isPending ? "Saving…" : "Save Notes"}
              </Button>
            </div>
          </div>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC006 CG Attendance ───────────────────────────────────────────── */
type CgStatus = "attended" | "absent" | "no-session" | null;

function deriveCgStatus(existing: { attended?: boolean | null; absenceReason?: string | null } | undefined): CgStatus {
  if (!existing || existing.attended == null) return null;
  if (existing.attended) return "attended";
  if (existing.absenceReason === "No CG Session") return "no-session";
  return "absent";
}

function CgCard({
  existing,
  weekStart,
  isLocked,
}: {
  existing: { attended?: boolean | null; absenceReason?: string | null; weeklyQuestion?: string | null; weeklyAnswer?: string | null } | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logCg = useLogCgAttendance();
  const hasSavedDataCg = deriveCgStatus(existing) !== null;
  const [isEditing, setIsEditing] = useState(!hasSavedDataCg);

  const [cgStatus, setCgStatus] = useState<CgStatus>(() => deriveCgStatus(existing));
  const [absenceReason, setAbsenceReason] = useState(
    existing?.absenceReason && existing.absenceReason !== "No CG Session" ? existing.absenceReason : "",
  );
  const [weeklyQuestion, setWeeklyQuestion] = useState(existing?.weeklyQuestion ?? "");
  const [weeklyAnswer, setWeeklyAnswer] = useState(existing?.weeklyAnswer ?? "");
  const [isDirty, setIsDirty] = useState(false);

  async function handleSave(status: CgStatus) {
    const att = status === "attended";
    const reason = status === "no-session" ? "No CG Session" : status === "absent" ? (absenceReason || null) : null;
    try {
      await logCg.mutateAsync({
        data: {
          weekStart,
          attended: att,
          absenceReason: reason,
          weeklyQuestion: weeklyQuestion || null,
          weeklyAnswer: weeklyAnswer || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "CG attendance recorded." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  function selectStatus(s: CgStatus) {
    setCgStatus(s);
    setIsDirty(true);
    if (s === "attended") setAbsenceReason("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Caregroup Attendance & Engagement</CardTitle>
            <CardDescription>Attend your care group. Log the weekly question & answer. Validated by CG Servant.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDataCg && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <SHCBadge code="SHC006" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing && hasSavedDataCg ? (
          <div className="space-y-2">
            {cgStatus === "attended" ? (
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /><span className="font-medium text-sm">Attended</span></div>
            ) : cgStatus === "absent" ? (
              <div className="flex items-center gap-2 text-sm"><span className="font-medium text-destructive">Absent</span>{absenceReason && <span className="text-muted-foreground">({absenceReason})</span>}</div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="font-medium">No CG Session</span></div>
            )}
            {existing?.weeklyQuestion && <p className="text-xs text-muted-foreground mt-1">Q: {existing.weeklyQuestion}</p>}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button variant={cgStatus === "attended" ? "default" : "outline"} disabled={isLocked} onClick={() => selectStatus("attended")} className="flex-1 gap-2">
                {cgStatus === "attended" && <CheckCircle className="h-4 w-4" />} Attended
              </Button>
              <Button variant={cgStatus === "absent" ? "destructive" : "outline"} disabled={isLocked} onClick={() => selectStatus("absent")} className="flex-1">
                Absent
              </Button>
              <Button variant={cgStatus === "no-session" ? "secondary" : "outline"} disabled={isLocked} onClick={() => selectStatus("no-session")} className="flex-1 text-xs">
                No CG Session
              </Button>
            </div>

            {cgStatus === "absent" && (
              <div>
                <Label className="text-xs">Absence Reason</Label>
                <Select value={absenceReason} onValueChange={(v) => { setAbsenceReason(v); setIsDirty(true); }} disabled={isLocked}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {["Medical", "Academic", "Family Emergency", "Invalid"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {cgStatus === "no-session" && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                No CG session was held this week. Please still answer the weekly question below.
              </p>
            )}

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Weekly CG Q&A</p>
              <div>
                <Label className="text-xs">Weekly Question</Label>
                <Input className="mt-1 text-sm" placeholder="Enter the weekly CG question…" value={weeklyQuestion}
                  onChange={(e) => { setWeeklyQuestion(e.target.value); setIsDirty(true); }} disabled={isLocked} />
              </div>
              <div>
                <Label className="text-xs">Your Answer</Label>
                <Textarea className="mt-1 text-sm resize-none" rows={3} placeholder="Share your reflection…" value={weeklyAnswer}
                  onChange={(e) => { setWeeklyAnswer(e.target.value); setIsDirty(true); }} disabled={isLocked} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              {hasSavedDataCg && (
                <Button variant="ghost" size="sm"
                  onClick={() => {
                    setCgStatus(deriveCgStatus(existing));
                    setAbsenceReason(existing?.absenceReason && existing.absenceReason !== "No CG Session" ? existing.absenceReason : "");
                    setWeeklyQuestion(existing?.weeklyQuestion ?? "");
                    setWeeklyAnswer(existing?.weeklyAnswer ?? "");
                    setIsDirty(false);
                    setIsEditing(false);
                  }}
                  className="gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button size="sm" onClick={() => handleSave(cgStatus)} disabled={logCg.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logCg.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SHC007 Sharing Huddle ──────────────────────────────────────────── */
function HuddleCard({
  existing,
  weekStart,
  isLocked,
}: {
  existing: { id?: number | null; attended?: boolean | null; absenceReason?: string | null; monthlyQuestion?: string | null; monthlyAnswer?: string | null } | undefined;
  weekStart: string;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logHuddle = useLogSharingHuddle();
  const hasSavedDataHuddle = (existing?.id ?? 0) > 0;
  const [isEditing, setIsEditing] = useState(!hasSavedDataHuddle);

  const [attended, setAttended] = useState<boolean>(existing?.attended ?? false);
  const [absenceReason, setAbsenceReason] = useState(existing?.absenceReason ?? "");
  const [monthlyQuestion, setMonthlyQuestion] = useState(existing?.monthlyQuestion ?? "");
  const [monthlyAnswer, setMonthlyAnswer] = useState(existing?.monthlyAnswer ?? "");
  const [isDirty, setIsDirty] = useState(false);

  async function handleSave(att: boolean) {
    try {
      await logHuddle.mutateAsync({
        data: {
          weekStart,
          attended: att,
          absenceReason: att ? null : (absenceReason || null),
          monthlyQuestion: monthlyQuestion || null,
          monthlyAnswer: monthlyAnswer || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stellarboard"] });
      setIsDirty(false);
      setIsEditing(false);
      toast({ title: "Saved", description: "Sharing huddle recorded." });
    } catch {
      toast({ variant: "destructive", title: "Could not save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Sharing Huddle Attendance</CardTitle>
            <CardDescription>Monthly evangelism alignment meeting. Validated by Sharing Captain.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSavedDataHuddle && !isEditing && !isLocked && (
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs px-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            <SHCBadge code="SHC007" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && <ClosedWeekBanner />}
        {!isEditing && hasSavedDataHuddle ? (
          <div className="flex items-center gap-2 text-sm">
            {existing?.attended ? (
              <><CheckCircle className="h-5 w-5 text-primary" /><span className="font-medium">Attended</span></>
            ) : (
              <><span className="font-medium text-destructive">Absent</span>{existing?.absenceReason && <span className="text-muted-foreground">({existing.absenceReason})</span>}</>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <Button variant={attended ? "default" : "outline"} disabled={isLocked}
                onClick={() => { setAttended(true); setAbsenceReason(""); setIsDirty(true); }} className="flex-1 gap-2">
                {attended && <CheckCircle className="h-4 w-4" />} Attended
              </Button>
              <Button variant={!attended ? "destructive" : "outline"} disabled={isLocked}
                onClick={() => { setAttended(false); setIsDirty(true); }} className="flex-1">
                Absent
              </Button>
            </div>

            {!attended && (
              <div>
                <Label className="text-xs">Absence Reason</Label>
                <Select value={absenceReason} onValueChange={(v) => { setAbsenceReason(v); setIsDirty(true); }} disabled={isLocked}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {["Medical", "Academic", "Family Emergency", "Invalid"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Monthly Huddle Q&A</p>
              <div>
                <Label className="text-xs">Monthly Question</Label>
                <Input className="mt-1 text-sm" placeholder="Enter the monthly huddle question…" value={monthlyQuestion}
                  onChange={(e) => { setMonthlyQuestion(e.target.value); setIsDirty(true); }} disabled={isLocked} />
              </div>
              <div>
                <Label className="text-xs">Your Answer</Label>
                <Textarea className="mt-1 text-sm resize-none" rows={3} placeholder="Share your evangelism reflection…" value={monthlyAnswer}
                  onChange={(e) => { setMonthlyAnswer(e.target.value); setIsDirty(true); }} disabled={isLocked} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              {hasSavedDataHuddle && (
                <Button variant="ghost" size="sm"
                  onClick={() => {
                    setAttended(existing?.attended ?? false);
                    setAbsenceReason(existing?.absenceReason ?? "");
                    setMonthlyQuestion(existing?.monthlyQuestion ?? "");
                    setMonthlyAnswer(existing?.monthlyAnswer ?? "");
                    setIsDirty(false);
                    setIsEditing(false);
                  }}
                  className="gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
              <Button size="sm" onClick={() => handleSave(attended)} disabled={logHuddle.isPending || isLocked} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {logHuddle.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function SpiritualTracker() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const unlockWeek = useUnlockHabitWeekAlias();

  const currentWeek = startOfWeek(new Date(), { weekStartsOn: 0 });
  const selectedWeek = addWeeks(currentWeek, weekOffset);
  const dateStr = format(selectedWeek, "yyyy-MM-dd");

  const { data: habits, isLoading } = useGetSpiritualHabits(
    { weekStart: dateStr },
  );

  // Locking rule: submissions close next Sunday at 7:30 AM
  const lockDeadline = addWeeks(selectedWeek, 1);
  lockDeadline.setHours(7, 30, 0, 0);
  const isDeadlinePassed = new Date() > lockDeadline;
  const isPastWeek = weekOffset < 0;
  const isServerUnlocked = habits?.isUnlocked ?? false;
  const isLocked = (isDeadlinePassed || isPastWeek) && !isServerUnlocked;
  const daysUntilLock = Math.max(0, Math.ceil((lockDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const isAdmin = user?.role === "Admin";
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  async function handleUnlockWeek() {
    try {
      await unlockWeek.mutateAsync({ data: { weekStart: dateStr, memberId: user?.id } });
      queryClient.invalidateQueries({ queryKey: ["/api/habits/spiritual"] });
      toast({ title: "Week unlocked", description: `Habit logging re-opened for the week of ${format(selectedWeek, "MMMM d")}.` });
    } catch {
      toast({ variant: "destructive", title: "Unlock failed", description: "Could not unlock this week." });
    }
  }

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

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          Spiritual Habits
        </h1>
        <p className="text-muted-foreground mt-1">All 7 SHC disciplines</p>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => o - 1)}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">
            {weekOffset === 0 ? "Current Week" : weekOffset === -1 ? "Last Week" : weekOffset < 0 ? `${Math.abs(weekOffset)} weeks ago` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(selectedWeek, "MMM d")} – {format(addWeeks(selectedWeek, 1), "MMM d, yyyy")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
          disabled={weekOffset >= 0}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Post-unlock admin banner */}
      {isServerUnlocked && (isDeadlinePassed || isPastWeek) && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Unlock className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong>Unlocked by Admin</strong> — editing window re-opened. Closes{" "}
            {format(lockDeadline, "EEEE, MMMM d")} at 7:30 AM.
          </span>
        </div>
      )}

      {/* Lock / deadline banner */}
      {isLocked ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            This week is locked. The editing window closed on{" "}
            {format(lockDeadline, "EEEE, MMMM d")} at 7:30 AM.
          </span>
          {isAdmin && !isServerUnlocked && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setShowUnlockConfirm(true)}
              disabled={unlockWeek.isPending}
            >
              <Unlock className="h-3.5 w-3.5" />
              Unlock Week
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Clock className="h-4 w-4 shrink-0" />
          Habit submissions close{" "}
          <strong>
            {format(lockDeadline, "EEEE, MMMM d")} at 7:30 AM
          </strong>
          &nbsp;— {daysUntilLock} day{daysUntilLock !== 1 ? "s" : ""} remaining.
        </div>
      )}

      {/* Admin unlock confirmation dialog */}
      <AlertDialog open={showUnlockConfirm} onOpenChange={setShowUnlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this week?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-open habit logging for the week of{" "}
              <strong>{format(selectedWeek, "MMMM d, yyyy")}</strong> for this member.
              The editing window was originally scheduled to close on{" "}
              {format(lockDeadline, "EEEE, MMMM d")} at 7:30 AM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowUnlockConfirm(false); handleUnlockWeek(); }}
              disabled={unlockWeek.isPending}
            >
              {unlockWeek.isPending ? "Unlocking…" : "Yes, unlock week"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="daily">Daily Habits</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Habits</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Habit</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : (
            <>
              <PrayerCard key={dateStr} days={habits?.prayer?.days} weekStart={dateStr} isLocked={isLocked} />
              <DevotionCard key={dateStr} days={habits?.devotion?.days} weekStart={dateStr} isLocked={isLocked} />
            </>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : (
            <>
              <GotCard key={dateStr} existing={habits?.got} weekStart={dateStr} isLocked={isLocked} />
              <WorshipCard key={dateStr} existing={habits?.worshipAttendance} weekStart={dateStr} isLocked={isLocked} />
              <BiblicalCard key={dateStr} existing={habits?.biblicalNotes} weekStart={dateStr} isLocked={isLocked} />
              <CgCard key={dateStr} existing={habits?.cgAttendance} weekStart={dateStr} isLocked={isLocked} />
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : (
            <HuddleCard key={dateStr} existing={habits?.sharingHuddle} weekStart={dateStr} isLocked={isLocked} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
