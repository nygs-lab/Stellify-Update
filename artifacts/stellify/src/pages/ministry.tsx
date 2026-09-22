import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, BarChart3, Star, CheckCircle2, XCircle, HandHeart,
  BookOpen, Crown, Inbox, ChevronLeft, ChevronRight, Bell,
  FileText, ClipboardCheck, Building2, Loader2,
  ShieldCheck, AlertTriangle, Clock, ExternalLink, Download, Home,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useListStellarApprovals, useListPrayerRequests, useListCounselingRequests,
  useCompletePrayerRequest, useCompleteCounselingRequest,
  useApproveStellarStatus, useRejectStellarStatus,
  useGetCaringHub, useGetSharingHub, useGetFamilyHub,
  useGetCgAuditView, useSubmitCgAuditSummary, useGetCgAuditHistory,
  useGetChurchAuditView, useSubmitChurchAuditSummary, useGetChurchAuditHistory,
  useGetCgTreasury, useGetChurchTreasury,
  useGetPastorOverview, useSendMemberReminder, useNudgeMember,
  useGetAuditGot, useGetAuditBiblical, useVerifyGotSubmission, useVerifyBiblicalSubmission,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(offset = 0): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + offset * 7);
  return d.toISOString().split("T")[0];
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getCurrentMonth(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function HabitDot({ done, label }: { done?: boolean; label: string }) {
  return (
    <span title={label} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${done ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
      {done ? "✓" : "✗"}
    </span>
  );
}

function ComplianceBar({ pct, label }: { pct?: number; label: string }) {
  const val = Math.round(pct ?? 0);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{val}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${val >= 80 ? "bg-green-500" : val >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${val}%` }}
        />
      </div>
    </div>
  );
}

function WeekNavigator({ weekStart, onPrev, onNext }: { weekStart: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm font-medium min-w-[180px] text-center">{formatWeekLabel(weekStart)}</span>
      <Button variant="outline" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

function MonthNavigator({ month, onPrev, onNext }: { month: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm font-medium min-w-[180px] text-center">{formatMonthLabel(month)}</span>
      <Button variant="outline" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      <Inbox className="h-4 w-4" />
      {label}
    </div>
  );
}

function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const escape = (v: string | number | boolean | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Caring Hub (Servant / CG Auditor) ───────────────────────────────────────

function CaringHubTab({ readonly = false }: { readonly?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);

  const { data, isLoading } = useGetCaringHub(
    { weekStart },
    { query: { queryKey: ["/api/ministry/caring", weekStart] } },
  );

  const nudge = useNudgeMember();

  async function handleRemind(memberId: number, name: string) {
    try {
      await nudge.mutateAsync({ data: { memberId, weekStart, message: "Please complete your spiritual habits for this week." } });
      toast({ title: "Reminder sent", description: `Reminder sent to ${name}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not send reminder." });
    }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const hub = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Care Group {hub?.cgNumber}</h2>
          <p className="text-sm text-muted-foreground">{hub?.totalMembers ?? 0} active members</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekNavigator weekStart={weekStart} onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)} />
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
            if (!hub?.members) return;
            const rows: (string | number | boolean | null | undefined)[][] = [
              ["Church ID", "First Name", "Last Name", "Prayer", "Devotion", "Worship", "GOT", "Biblical Notes", "CG Attendance", "Sharing Huddle", "Personal Done", "Personal Total"],
              ...(hub.members as any[]).map((m: any) => [
                m.churchId, m.firstName, m.lastName,
                m.prayerCompleted ? "Yes" : "No", m.devotionCompleted ? "Yes" : "No",
                m.worshipAttended ? "Yes" : "No", m.gotSubmitted ? "Yes" : "No",
                m.biblicalDone ? "Yes" : "No", m.cgAttended ? "Yes" : "No",
                m.huddleAttended ? "Yes" : "No", m.personalDone ?? 0, m.personalTotal ?? 0,
              ]),
            ];
            downloadCsv(`caring-cg${hub.cgNumber}-${weekStart}.csv`, rows);
          }}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Compliance bars */}
      {hub && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly Compliance</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComplianceBar pct={hub.prayerCompliance} label="Prayer" />
            <ComplianceBar pct={hub.devotionCompliance} label="Devotion" />
            <ComplianceBar pct={hub.worshipCompliance} label="Worship" />
            <ComplianceBar pct={hub.gotCompliance} label="GOT" />
            <ComplianceBar pct={hub.biblicalCompliance} label="Biblical Notes" />
            <ComplianceBar pct={hub.cgAttendanceCompliance} label="CG Attendance" />
            <ComplianceBar pct={hub.huddleCompliance} label="Sharing Huddle" />
          </CardContent>
        </Card>
      )}

      {/* Member rows */}
      {!hub?.members?.length ? (
        <EmptyState label="No members found in your Care Group." />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Member Habits</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">Member</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Prayer">🙏</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Devotion">📖</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="GOT (Treasury)">💰</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Worship">⛪</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Biblical Notes">📝</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="CG Attendance">👥</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Sharing Huddle">🤝</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Personal Habits">Personal</th>
                    {!readonly && <th className="px-3 py-2.5 font-medium"></th>}
                  </tr>
                </thead>
                <tbody>
                  {hub.members.map((m: any) => (
                    <tr key={m.memberId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.churchId}</p>
                        </div>
                      </td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.prayerCompleted} label="Prayer" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.devotionCompleted} label="Devotion" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.gotSubmitted} label="GOT" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.worshipAttended} label="Worship" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.biblicalDone} label="Biblical Notes" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.cgAttended} label="CG Attendance" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.huddleAttended} label="Sharing Huddle" /></td>
                      <td className="text-center px-2 py-2.5">
                        <span className="text-xs text-muted-foreground">
                          {m.personalDone ?? 0}/{m.personalTotal ?? 0}
                        </span>
                      </td>
                      {!readonly && (
                        <td className="px-3 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs text-primary"
                            onClick={() => handleRemind(m.memberId, `${m.firstName} ${m.lastName}`)}
                            disabled={nudge.isPending}
                          >
                            <Bell className="h-3 w-3" />
                            Remind
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sharing Hub (Captain) ────────────────────────────────────────────────────

function SharingHubTab() {
  const { toast } = useToast();
  const [monthOffset, setMonthOffset] = useState(0);
  const month = getCurrentMonth(monthOffset);
  const nudge = useNudgeMember();

  async function handleRemind(memberId: number, name: string) {
    try {
      await nudge.mutateAsync({ data: { memberId } });
      toast({ title: "Reminder sent", description: `${name} has been nudged to keep sharing.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not send reminder." });
    }
  }

  const { data, isLoading } = useGetSharingHub(
    { month } as any,
    { query: { queryKey: ["/api/ministry/sharing", month] } },
  );

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const hub = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sharing Huddle {hub?.sharingHuddleNumber}</h2>
          <p className="text-sm text-muted-foreground">{hub?.totalMembers ?? 0} active members</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthNavigator month={month} onPrev={() => setMonthOffset(o => o - 1)} onNext={() => setMonthOffset(o => o + 1)} />
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
            if (!hub?.members) return;
            const rows: (string | number | boolean | null | undefined)[][] = [
              ["Church ID", "First Name", "Last Name", "Preparations", "Attempts", "Bearings", "Stellar Fragments"],
              ...(hub.members as any[]).map((m: any) => [
                m.churchId, m.firstName, m.lastName, m.preparations, m.attempts, m.bearings, m.stellarFragments,
              ]),
            ];
            downloadCsv(`sharing-h${hub.sharingHuddleNumber}-${month}.csv`, rows);
          }}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Totals */}
      {hub && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-blue-600">{hub.totalPreparations ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Preparations</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-amber-600">{hub.totalAttempts ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Attempts</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-bold text-green-600">{hub.totalBearings ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Bearings</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member rows */}
      {!hub?.members?.length ? (
        <EmptyState label="No members found in your Sharing Huddle." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">Member</th>
                    <th className="text-center px-3 py-2.5 font-medium">Preparations</th>
                    <th className="text-center px-3 py-2.5 font-medium">Attempts</th>
                    <th className="text-center px-3 py-2.5 font-medium">Bearings</th>
                    <th className="text-center px-3 py-2.5 font-medium">Fragments</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {(hub.members as any[]).map((m: any) => (
                    <tr key={m.memberId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.churchId}</p>
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <Badge variant={m.preparations > 0 ? "default" : "secondary"} className="text-xs">{m.preparations}</Badge>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <Badge variant={m.attempts > 0 ? "default" : "secondary"} className="text-xs">{m.attempts}</Badge>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <Badge variant={m.bearings > 0 ? "default" : "secondary"} className={`text-xs ${m.bearings > 0 ? "bg-green-500 hover:bg-green-600" : ""}`}>{m.bearings}</Badge>
                      </td>
                      <td className="text-center px-3 py-2.5 text-muted-foreground text-xs">✦ {m.stellarFragments}</td>
                      <td className="px-3 py-2.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-primary"
                          onClick={() => handleRemind(m.memberId, `${m.firstName} ${m.lastName}`)}
                          disabled={nudge.isPending}
                        >
                          <Bell className="h-3 w-3" />
                          Remind
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Family Hub (Family Leader) ───────────────────────────────────────────────

function FamilyHubTab() {
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);

  const { data, isLoading } = useGetFamilyHub(
    { weekStart },
    { query: { queryKey: ["/api/ministry/family", weekStart] } },
  );

  const nudge = useNudgeMember();

  async function handleRemind(memberId: number, name: string) {
    try {
      await nudge.mutateAsync({ data: { memberId, weekStart, message: "Please complete your spiritual habits for this week." } });
      toast({ title: "Reminder sent", description: `Reminder sent to ${name}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not send reminder." });
    }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const hub = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Family Group {hub?.familyGroupNumber}</h2>
          <p className="text-sm text-muted-foreground">{hub?.totalMembers ?? 0} active members</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekNavigator weekStart={weekStart} onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)} />
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
            if (!hub?.members) return;
            const rows: (string | number | boolean | null | undefined)[][] = [
              ["Church ID", "First Name", "Last Name", "Prayer", "Devotion", "Worship", "GOT", "Biblical Notes", "CG Attendance", "Sharing Huddle"],
              ...(hub.members as any[]).map((m: any) => [
                m.churchId, m.firstName, m.lastName,
                m.prayerCompleted ? "Yes" : "No", m.devotionCompleted ? "Yes" : "No",
                m.worshipAttended ? "Yes" : "No", m.gotSubmitted ? "Yes" : "No",
                m.biblicalDone ? "Yes" : "No", m.cgAttended ? "Yes" : "No",
                m.huddleAttended ? "Yes" : "No",
              ]),
            ];
            downloadCsv(`family-fg${hub.familyGroupNumber}-${weekStart}.csv`, rows);
          }}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {hub && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly Compliance</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ComplianceBar pct={hub.prayerCompliance} label="Prayer" />
            <ComplianceBar pct={hub.devotionCompliance} label="Devotion" />
            <ComplianceBar pct={hub.worshipCompliance} label="Worship" />
            <ComplianceBar pct={hub.gotCompliance} label="GOT" />
            <ComplianceBar pct={hub.biblicalCompliance} label="Biblical Notes" />
            <ComplianceBar pct={hub.cgAttendanceCompliance} label="CG Attendance" />
            <ComplianceBar pct={hub.huddleCompliance} label="Sharing Huddle" />
          </CardContent>
        </Card>
      )}

      {!hub?.members?.length ? (
        <EmptyState label="No members found in your Family Group." />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Member Habits</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">Member</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Prayer">🙏</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Devotion">📖</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="GOT">💰</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Worship">⛪</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Biblical Notes">📝</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="CG Attendance">👥</th>
                    <th className="text-center px-2 py-2.5 font-medium" title="Sharing Huddle">🤝</th>
                    <th className="px-3 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(hub.members as any[]).map((m: any) => (
                    <tr key={m.memberId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.churchId}</p>
                      </td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.prayerCompleted} label="Prayer" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.devotionCompleted} label="Devotion" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.gotSubmitted} label="GOT" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.worshipAttended} label="Worship" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.biblicalDone} label="Biblical Notes" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.cgAttended} label="CG Attendance" /></td>
                      <td className="text-center px-2 py-2.5"><HabitDot done={m.huddleAttended} label="Sharing Huddle" /></td>
                      <td className="px-3 py-2.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-primary"
                          onClick={() => handleRemind(m.memberId, `${m.firstName} ${m.lastName}`)}
                          disabled={nudge.isPending}
                        >
                          <Bell className="h-3 w-3" />
                          Remind
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── CG Audit Tab ─────────────────────────────────────────────────────────────

function CgAuditTab({ financialOnly = false }: { financialOnly?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
  const [summary, setSummary] = useState("");
  const [observations, setObservations] = useState("");

  // For Servants/Pastors: full habit compliance view
  const { data: auditData, isLoading } = useGetCgAuditView(
    { weekStart },
    { query: { queryKey: ["/api/ministry/audit/cg", weekStart], enabled: !financialOnly } },
  );

  // For CgAuditors: actual financial data (gift/offering/tithes/bob/total)
  const { data: treasuryData, isLoading: treasuryLoading } = useGetCgTreasury(
    { weekStart },
    { query: { queryKey: ["/api/ministry/treasury/cg", weekStart], enabled: financialOnly } },
  );

  const isLoadingData = financialOnly ? treasuryLoading : isLoading;

  // Narrative history — only for Servants/Pastors; CgAuditors are financial-only.
  const { data: history, isLoading: loadingHistory } = useGetCgAuditHistory({
    query: { queryKey: ["/api/ministry/audit/cg/history"], enabled: !financialOnly },
  });

  const submit = useSubmitCgAuditSummary();

  async function handleSubmit() {
    if (!summary.trim()) {
      toast({ variant: "destructive", title: "Required", description: "Please enter a summary." });
      return;
    }
    try {
      await submit.mutateAsync({ data: { weekStart, summary: summary.trim(), observations: observations.trim() || undefined } });
      queryClient.invalidateQueries({ queryKey: ["/api/ministry/audit/cg/history"] });
      toast({ title: "Submitted", description: "Your CG summary has been submitted for church review." });
      setSummary("");
      setObservations("");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not submit summary." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">CG Audit — {financialOnly ? (treasuryData as any)?.cgNumber : auditData?.cgNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {financialOnly ? "Review CG GOT financial data (tithes, offering, gift, BoB) and submit your weekly audit report." : "View weekly habits, then submit summary to church."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekNavigator weekStart={weekStart} onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)} />
          {/* CSV export — financial view for CgAuditors */}
          {financialOnly && (treasuryData as any)?.entries?.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
              const td = treasuryData as any;
              downloadCsv(`treasury-cg${td.cgNumber}-${weekStart}.csv`, [
                ["Church ID", "First Name", "Last Name", "Gift", "Offering", "Tithes", "BoB Deduction", "Total"],
                ...td.entries.map((e: any) => [e.churchId, e.firstName, e.lastName, e.giftAmount ?? 0, e.offeringAmount ?? 0, e.tithesAmount ?? 0, e.bobDeduction ?? 0, e.totalSubmission ?? 0]),
              ]);
            }}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
          {/* CSV export — habit compliance view for Servants/Pastors */}
          {!financialOnly && (auditData?.members as any)?.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
              downloadCsv(`cg-audit-${auditData!.cgNumber}-${weekStart}.csv`, [
                ["Church ID", "First Name", "Last Name", "Prayer", "Devotion", "GOT", "Worship", "Biblical Notes", "CG Attendance", "Huddle"],
                ...(auditData!.members as any[]).map((m: any) => [
                  m.churchId, m.firstName, m.lastName,
                  m.prayerCompleted ? "Yes" : "No", m.devotionCompleted ? "Yes" : "No", m.gotSubmitted ? "Yes" : "No",
                  m.worshipAttended ? "Yes" : "No", m.biblicalDone ? "Yes" : "No", m.cgAttended ? "Yes" : "No", m.huddleAttended ? "Yes" : "No",
                ]),
              ]);
            }}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* ── CgAuditor: real financial data from treasury endpoint ── */}
      {financialOnly && (
        <>
          {isLoadingData ? (
            <Skeleton className="h-32 w-full" />
          ) : (treasuryData as any) && (
            <>
              {/* Summary totals */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(["Gift", "Offering", "Tithes"] as const).map(label => {
                  const key = label.toLowerCase() + "Amount" as "giftAmount" | "offeringAmount" | "tithesAmount";
                  const totalKey = ("total" + label) as "totalGift" | "totalOffering" | "totalTithes";
                  return (
                    <Card key={label} className="text-center">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xl font-bold text-primary">{((treasuryData as any)[totalKey] ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </CardContent>
                    </Card>
                  );
                })}
                <Card className="text-center">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xl font-bold text-amber-600">{((treasuryData as any).totalBob ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">BoB Deduction</p>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xl font-bold text-green-600">{((treasuryData as any).grandTotal ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Grand Total</p>
                  </CardContent>
                </Card>
              </div>
              {/* Member-level financial breakdown */}
              {(treasuryData as any).entries?.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-4 py-2.5 font-medium">Member</th>
                            <th className="text-right px-3 py-2.5 font-medium">Gift</th>
                            <th className="text-right px-3 py-2.5 font-medium">Offering</th>
                            <th className="text-right px-3 py-2.5 font-medium">Tithes</th>
                            <th className="text-right px-3 py-2.5 font-medium">BoB</th>
                            <th className="text-right px-3 py-2.5 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((treasuryData as any).entries as any[]).map((e: any) => (
                            <tr key={e.memberId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="font-medium">{e.firstName} {e.lastName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{e.churchId}</p>
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums">{e.giftAmount != null ? e.giftAmount.toFixed(2) : "—"}</td>
                              <td className="text-right px-3 py-2.5 tabular-nums">{e.offeringAmount != null ? e.offeringAmount.toFixed(2) : "—"}</td>
                              <td className="text-right px-3 py-2.5 tabular-nums">{e.tithesAmount != null ? e.tithesAmount.toFixed(2) : "—"}</td>
                              <td className="text-right px-3 py-2.5 tabular-nums">{e.bobDeduction != null ? e.bobDeduction.toFixed(2) : "—"}</td>
                              <td className="text-right px-3 py-2.5 tabular-nums font-semibold">{e.totalSubmission != null ? e.totalSubmission.toFixed(2) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ── Servants / Pastors: full habit compliance view ── */}
      {!financialOnly && (
        <>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : auditData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Compliance Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ComplianceBar pct={auditData.gotCompliance} label="GOT" />
                <ComplianceBar pct={auditData.prayerCompliance} label="Prayer" />
                <ComplianceBar pct={auditData.devotionCompliance} label="Devotion" />
                <ComplianceBar pct={auditData.worshipCompliance} label="Worship" />
                <ComplianceBar pct={auditData.biblicalCompliance} label="Biblical Notes" />
                <ComplianceBar pct={auditData.cgAttendanceCompliance} label="CG Attendance" />
                <ComplianceBar pct={auditData.huddleCompliance} label="Sharing Huddle" />
              </CardContent>
            </Card>
          )}
          {!isLoading && auditData?.members && auditData.members.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium">Member</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="GOT">💰</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="Prayer">🙏</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="Devotion">📖</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="Worship">⛪</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="Biblical Notes">📝</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="CG Attendance">👥</th>
                        <th className="text-center px-2 py-2.5 font-medium" title="Sharing Huddle">🤝</th>
                        <th className="text-center px-2 py-2.5 font-medium">Personal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(auditData.members as any[]).map((m: any) => (
                        <tr key={m.memberId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{m.firstName} {m.lastName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{m.churchId}</p>
                          </td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.gotSubmitted} label="GOT" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.prayerCompleted} label="Prayer" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.devotionCompleted} label="Devotion" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.worshipAttended} label="Worship" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.biblicalDone} label="Biblical Notes" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.cgAttended} label="CG Attendance" /></td>
                          <td className="text-center px-2 py-2.5"><HabitDot done={m.huddleAttended} label="Sharing Huddle" /></td>
                          <td className="text-center px-2 py-2.5 text-xs text-muted-foreground">{m.personalDone}/{m.personalTotal}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )}

      {/* Submit summary — Servants/Pastors only; CgAuditors are financial-only and cannot submit narratives */}
      {!financialOnly && (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Submit Weekly Summary
          </CardTitle>
          <CardDescription>Write your observations for this week and submit them for church-level review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Summary <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Overall summary of this week's CG performance…"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observations (optional)</label>
            <Textarea
              placeholder="Notable observations, concerns, or praise reports…"
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submit.isPending} className="gap-2">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Submit to Church
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Past submissions — Servants/Pastors only */}
      {!financialOnly && (
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Past Submissions
        </h3>
        {loadingHistory ? (
          <Skeleton className="h-20 w-full" />
        ) : !history?.length ? (
          <EmptyState label="No summaries submitted yet." />
        ) : (
          <div className="space-y-2">
            {(history as any[]).map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Week of {formatWeekLabel(r.weekStart)}</span>
                        <Badge variant={r.status === "reviewed" ? "default" : "secondary"} className="text-xs">
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.summary}</p>
                      {r.observations && <p className="text-xs text-muted-foreground italic">{r.observations}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}

// ─── Church Audit Tab ─────────────────────────────────────────────────────────

function ChurchAuditTab({ financialOnly = false }: { financialOnly?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
  const [summary, setSummary] = useState("");
  const [observations, setObservations] = useState("");

  // Narrative audit data (Admin/Pastor only). Disabled for ChurchAuditors (financial-only).
  const { data: view, isLoading } = useGetChurchAuditView(
    { weekStart },
    { query: { queryKey: ["/api/ministry/audit/church", weekStart], enabled: !financialOnly } },
  );

  // Global financial summary — church-wide GOT data across all CGs
  const { data: churchTreasury, isLoading: treasuryLoading } = useGetChurchTreasury(
    { weekStart },
    { query: { queryKey: ["/api/ministry/treasury/church", weekStart] } },
  );

  // History and submit only available to Admin/Pastor (not ChurchAuditor financial-only view).
  const { data: history, isLoading: loadingHistory } = useGetChurchAuditHistory({
    query: { queryKey: ["/api/ministry/audit/church/history"], enabled: !financialOnly },
  });

  const submit = useSubmitChurchAuditSummary();

  async function handleSubmit() {
    if (!summary.trim()) {
      toast({ variant: "destructive", title: "Required", description: "Please enter a summary." });
      return;
    }
    const totalCgsReported = view?.cgSummaries?.length ?? undefined;
    try {
      await submit.mutateAsync({ data: { weekStart, summary: summary.trim(), observations: observations.trim() || undefined, totalCgsReported } });
      queryClient.invalidateQueries({ queryKey: ["/api/ministry/audit/church/history"] });
      toast({ title: "Submitted", description: "Church summary submitted successfully." });
      setSummary("");
      setObservations("");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not submit summary." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Church Audit</h2>
          <p className="text-sm text-muted-foreground">Review all CG summaries and submit a church-level report.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WeekNavigator weekStart={weekStart} onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)} />
          {!!churchTreasury?.cgSummaries?.length && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => {
              const ct = churchTreasury;
              if (!ct) return;
              downloadCsv(`church-treasury-${weekStart}.csv`, [
                ["CG", "Total Gift", "Total Offering", "Total Tithes", "Total BoB", "Grand Total"],
                ...ct.cgSummaries.map((cg) => [cg.cgNumber, cg.totalGift ?? 0, cg.totalOffering ?? 0, cg.totalTithes ?? 0, cg.totalBob ?? 0, cg.grandTotal ?? 0]),
                ["CHURCH TOTAL", ct.churchTotal.totalGift, ct.churchTotal.totalOffering, ct.churchTotal.totalTithes, ct.churchTotal.totalBob, ct.churchTotal.grandTotal],
              ]);
            }}>
              <Download className="h-3.5 w-3.5" />
              Export Financial CSV
            </Button>
          )}
        </div>
      </div>

      {/* Global financial summary — church-wide GOT data */}
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Church Treasury Summary
        </h3>
        {treasuryLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : churchTreasury?.cgSummaries?.length ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(["totalGift", "totalOffering", "totalTithes", "totalBob", "grandTotal"] as const).map(key => {
                const labels: Record<string, string> = { totalGift: "Gift", totalOffering: "Offering", totalTithes: "Tithes", totalBob: "BoB Deduction", grandTotal: "Grand Total" };
                const colors: Record<string, string> = { grandTotal: "text-green-600", totalBob: "text-amber-600" };
                const val = churchTreasury.churchTotal[key];
                return (
                  <Card key={key} className="text-center">
                    <CardContent className="pt-4 pb-3">
                      <p className={`text-xl font-bold ${colors[key] ?? "text-primary"}`}>{val.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{labels[key]}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium">CG</th>
                        <th className="text-right px-3 py-2.5 font-medium">Gift</th>
                        <th className="text-right px-3 py-2.5 font-medium">Offering</th>
                        <th className="text-right px-3 py-2.5 font-medium">Tithes</th>
                        <th className="text-right px-3 py-2.5 font-medium">BoB</th>
                        <th className="text-right px-3 py-2.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {churchTreasury.cgSummaries.map((cg) => (
                        <tr key={cg.cgNumber} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">CG {cg.cgNumber}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{(cg.totalGift ?? 0).toFixed(2)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{(cg.totalOffering ?? 0).toFixed(2)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{(cg.totalTithes ?? 0).toFixed(2)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{(cg.totalBob ?? 0).toFixed(2)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums font-semibold">{(cg.grandTotal ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState label="No treasury data found for this week." />
        )}
      </section>

      {/* CG narrative summaries — Admin/Pastor only (ChurchAuditors are financial-only) */}
      {!financialOnly && (
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          CG Submitted Summaries
          {view?.cgSummaries?.length ? (
            <Badge variant="secondary">{view.cgSummaries.length} received</Badge>
          ) : null}
        </h3>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !view?.cgSummaries?.length ? (
          <EmptyState label="No CG summaries submitted for this week yet." />
        ) : (
          <div className="space-y-2">
            {(view.cgSummaries as any[]).map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">CG {r.cgNumber}</span>
                        <Badge variant={r.status === "reviewed" ? "default" : "outline"} className="text-xs">{r.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.summary}</p>
                      {r.observations && <p className="text-xs text-muted-foreground italic">{r.observations}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(r.submittedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Existing church summary if any — Admin/Pastor only */}
      {!financialOnly && view?.existingChurchSummary && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">✓ Church summary already submitted</p>
            <p className="text-sm text-muted-foreground">{(view.existingChurchSummary as any).summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Submit church summary — Admin/Pastor only */}
      {!financialOnly && (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Submit Church Summary
          </CardTitle>
          <CardDescription>Consolidate all CG reports into a church-level summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Church Summary <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Overall church compliance and highlights for this week…"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observations (optional)</label>
            <Textarea
              placeholder="Key concerns, praises, or action items for church leadership…"
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submit.isPending} className="gap-2">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Submit Church Report
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Past church summaries — Admin/Pastor only */}
      {!financialOnly && (
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Past Church Reports
        </h3>
        {loadingHistory ? (
          <Skeleton className="h-20 w-full" />
        ) : !history?.length ? (
          <EmptyState label="No church reports submitted yet." />
        ) : (
          <div className="space-y-2">
            {(history as any[]).map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium">Week of {formatWeekLabel(r.weekStart)}</p>
                      <p className="text-sm text-muted-foreground">{r.summary}</p>
                      {r.observations && <p className="text-xs text-muted-foreground italic">{r.observations}</p>}
                      {r.totalCgsReported && <p className="text-xs text-muted-foreground">CGs reported: {r.totalCgsReported}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(r.submittedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}

// ─── Pastor Overview ──────────────────────────────────────────────────────────

function PastorOverviewTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = getWeekStart(weekOffset);
  const [expandedCg, setExpandedCg] = useState<string | null>(null);

  const { data, isLoading } = useGetPastorOverview(
    { weekStart },
    { query: { queryKey: ["/api/ministry/pastor/overview", weekStart] } },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Church-wide Overview</h2>
          <p className="text-sm text-muted-foreground">{data?.totalCgs ?? 0} care groups</p>
        </div>
        <WeekNavigator weekStart={weekStart} onPrev={() => setWeekOffset(o => o - 1)} onNext={() => setWeekOffset(o => o + 1)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !data?.cgs?.length ? (
        <EmptyState label="No care groups found." />
      ) : (
        <div className="space-y-3">
          {(data.cgs as any[]).map((cg: any) => (
            <Card key={cg.cgNumber} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedCg(expandedCg === cg.cgNumber ? null : cg.cgNumber)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Care Group {cg.cgNumber}</CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{cg.totalMembers} members</span>
                      <span className="text-xs text-muted-foreground">{expandedCg === cg.cgNumber ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    <ComplianceBar pct={cg.prayerCompliance} label="Prayer" />
                    <ComplianceBar pct={cg.devotionCompliance} label="Devotion" />
                    <ComplianceBar pct={cg.worshipCompliance} label="Worship" />
                    <ComplianceBar pct={cg.gotCompliance} label="GOT" />
                  </div>
                </CardHeader>
              </button>

              {expandedCg === cg.cgNumber && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <ComplianceBar pct={cg.biblicalCompliance} label="Biblical Notes" />
                    <ComplianceBar pct={cg.cgAttendanceCompliance} label="CG Attendance" />
                    <ComplianceBar pct={cg.huddleCompliance} label="Sharing Huddle" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-3 py-2 font-medium">Member</th>
                          <th className="text-center px-2 py-2">🙏</th>
                          <th className="text-center px-2 py-2">📖</th>
                          <th className="text-center px-2 py-2">💰</th>
                          <th className="text-center px-2 py-2">⛪</th>
                          <th className="text-center px-2 py-2">📝</th>
                          <th className="text-center px-2 py-2">👥</th>
                          <th className="text-center px-2 py-2">🤝</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cg.members as any[]).map((m: any) => (
                          <tr key={m.memberId} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium text-xs">{m.firstName} {m.lastName}</p>
                            </td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.prayerCompleted} label="Prayer" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.devotionCompleted} label="Devotion" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.gotSubmitted} label="GOT" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.worshipAttended} label="Worship" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.biblicalDone} label="Biblical Notes" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.cgAttended} label="CG Attendance" /></td>
                            <td className="text-center px-2 py-2"><HabitDot done={m.huddleAttended} label="Sharing Huddle" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pastor Panel ─────────────────────────────────────────────────────────────

function PastorPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: approvals, isLoading: loadingApprovals } = useListStellarApprovals(undefined, {
    query: { queryKey: ["/api/admin/stellar-status-approvals"] },
  });
  const { data: prayers, isLoading: loadingPrayers } = useListPrayerRequests({
    query: { queryKey: ["/api/engagement/prayer-requests"] },
  });
  const { data: counseling, isLoading: loadingCounseling } = useListCounselingRequests({
    query: { queryKey: ["/api/engagement/counseling"] },
  });

  const approveStellar = useApproveStellarStatus();
  const rejectStellar = useRejectStellarStatus();
  const completePrayer = useCompletePrayerRequest();
  const completeCounseling = useCompleteCounselingRequest();

  const pendingApprovals = (approvals ?? []).filter(a => a.status === "pending");
  const pendingPrayers = (prayers ?? []).filter(p => !p.isDone);
  const pendingCounseling = (counseling ?? []).filter(c => !c.isDone && c.counselorTarget === "Pastor");

  async function handleApprove(id: number) {
    try {
      await approveStellar.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stellar-status-approvals"] });
      toast({ title: "Approved", description: "Stellar status upgrade approved." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not approve request." });
    }
  }

  async function handleReject(id: number) {
    try {
      await rejectStellar.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stellar-status-approvals"] });
      toast({ title: "Rejected", description: "Stellar status request rejected." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not reject request." });
    }
  }

  async function handleCompletePrayer(id: number) {
    try {
      await completePrayer.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement/prayer-requests"] });
      toast({ title: "Done", description: "Prayer request marked as completed." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not update request." });
    }
  }

  async function handleCompleteCounseling(id: number) {
    try {
      await completeCounseling.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement/counseling"] });
      toast({ title: "Done", description: "Counseling request marked as completed." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not update request." });
    }
  }

  if (loadingApprovals || loadingPrayers || loadingCounseling) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Stellar Status Approvals</h2>
          {pendingApprovals.length > 0 && <Badge variant="destructive" className="text-xs">{pendingApprovals.length} pending</Badge>}
        </div>
        {pendingApprovals.length === 0 ? (
          <EmptyState label="No pending stellar status requests" />
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map(approval => (
              <Card key={approval.id} className="border-primary/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">{approval.memberName ?? "Member"}</p>
                      <p className="text-sm text-muted-foreground">Church ID: <span className="font-mono">{approval.memberChurchId ?? "—"}</span></p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Requesting:</span>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{approval.currentStatus ?? "—"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">{approval.requestedStatus}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleReject(approval.id)} disabled={rejectStellar.isPending}>
                        <XCircle className="h-3.5 w-3.5" />Reject
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => handleApprove(approval.id)} disabled={approveStellar.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5" />Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HandHeart className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Prayer Requests</h2>
          {pendingPrayers.length > 0 && <Badge variant="secondary" className="text-xs">{pendingPrayers.length} open</Badge>}
        </div>
        {pendingPrayers.length === 0 ? (
          <EmptyState label="No open prayer requests" />
        ) : (
          <div className="space-y-3">
            {pendingPrayers.map(req => (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{req.memberName ?? "Anonymous"}</p>
                        <Badge variant="outline" className="text-xs">{req.visibility}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => handleCompletePrayer(req.id)} disabled={completePrayer.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Done
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold">Counseling Requests</h2>
          {pendingCounseling.length > 0 && <Badge variant="secondary" className="text-xs">{pendingCounseling.length} open</Badge>}
        </div>
        {pendingCounseling.length === 0 ? (
          <EmptyState label="No open counseling requests for you" />
        ) : (
          <div className="space-y-3">
            {pendingCounseling.map(req => (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="font-medium text-sm">{req.memberName ?? "Member"}</p>
                      <p className="text-sm text-muted-foreground">{req.reason}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Preferred: {req.preferredDate}</span>
                        <span>Mode: {req.connectType}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => handleCompleteCounseling(req.id)} disabled={completeCounseling.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Done
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VerificationBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "Pending";
  if (s === "Verified") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </Badge>
    );
  }
  if (s === "Flagged") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        Flagged
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

function AuditPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [weekStart] = useState<string>(() => {
    const d = new Date();
    const diff = d.getDate() - d.getDay();
    const sun = new Date(d);
    sun.setDate(diff);
    return sun.toISOString().split("T")[0];
  });
  const [auditTab, setAuditTab] = useState<"got" | "biblical">("got");

  const gotQueryKey = ["/api/ministry/audit/got", weekStart];
  const biblicalQueryKey = ["/api/ministry/audit/biblical", weekStart];

  const { data: gotAudit, isLoading: loadingGot } = useGetAuditGot(
    { weekStart },
    { query: { queryKey: gotQueryKey } },
  );
  const { data: biblicalAudit, isLoading: loadingBiblical } = useGetAuditBiblical(
    { weekStart },
    { query: { queryKey: biblicalQueryKey } },
  );

  const verifyGot = useVerifyGotSubmission();
  const verifyBiblical = useVerifyBiblicalSubmission();

  async function handleGotVerify(id: number, verificationStatus: "Verified" | "Flagged" | "Pending") {
    try {
      await verifyGot.mutateAsync({ id, data: { verificationStatus } });
      queryClient.invalidateQueries({ queryKey: gotQueryKey });
      toast({ title: verificationStatus === "Verified" ? "Verified" : verificationStatus === "Flagged" ? "Flagged" : "Reset", description: `GOT submission marked as ${verificationStatus}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not update verification." });
    }
  }

  async function handleBiblicalVerify(id: number, verificationStatus: "Verified" | "Flagged" | "Pending") {
    try {
      await verifyBiblical.mutateAsync({ id, data: { verificationStatus } });
      queryClient.invalidateQueries({ queryKey: biblicalQueryKey });
      toast({ title: verificationStatus === "Verified" ? "Verified" : verificationStatus === "Flagged" ? "Flagged" : "Reset", description: `Biblical Notes submission marked as ${verificationStatus}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not update verification." });
    }
  }

  const scope = gotAudit?.scope ?? biblicalAudit?.scope;
  const scopeLabel = scope === "all" ? "All CGs" : scope ? `CG ${scope}` : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Submission Audit
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Week of <span className="font-mono">{weekStart}</span> · Scope: {scopeLabel}
          </p>
        </div>
      </div>

      <Tabs value={auditTab} onValueChange={(v) => setAuditTab(v as "got" | "biblical")}>
        <TabsList className="mb-4">
          <TabsTrigger value="got" className="gap-1.5">
            <span className="text-base leading-none">₽</span>
            GOT Submissions
            {gotAudit && gotAudit.entries.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{gotAudit.entries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="biblical" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Biblical Notes
            {biblicalAudit && biblicalAudit.entries.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{biblicalAudit.entries.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="got">
          {loadingGot ? (
            <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : !gotAudit || gotAudit.entries.length === 0 ? (
            <EmptyState label="No GOT submissions this week" />
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-800">Total submissions this week</span>
                <span className="text-lg font-bold text-yellow-900">
                  ₱{gotAudit.totalSubmission?.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                </span>
              </div>
              {gotAudit.entries.map((entry) => (
                <Card key={entry.id} className={entry.verificationStatus === "Verified" ? "border-green-200 bg-green-50/30" : entry.verificationStatus === "Flagged" ? "border-amber-200 bg-amber-50/30" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{entry.firstName} {entry.lastName}</p>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.churchId}</span>
                          <VerificationBadge status={entry.verificationStatus} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                          <div><span className="text-muted-foreground text-xs">Gift</span><p className="font-mono">{entry.giftAmount != null ? `₱${entry.giftAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Offering</span><p className="font-mono">{entry.offeringAmount != null ? `₱${entry.offeringAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Tithes</span><p className="font-mono">{entry.tithesAmount != null ? `₱${entry.tithesAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">BOB Deduction</span><p className="font-mono">{entry.bobDeduction != null ? `₱${entry.bobDeduction.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div><span className="text-muted-foreground text-xs">Total</span><p className="font-semibold font-mono text-primary">{entry.totalSubmission != null ? `₱${entry.totalSubmission.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</p></div>
                          {entry.submissionMethod && <div><span className="text-muted-foreground text-xs">Method</span><p>{entry.submissionMethod}</p></div>}
                          {entry.bobReason && <div><span className="text-muted-foreground text-xs">BOB Reason</span><p>{entry.bobReason}</p></div>}
                          {entry.screenshotLink && (
                            <a href={entry.screenshotLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" />View receipt
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 self-start">
                        {entry.verificationStatus !== "Verified" && (
                          <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleGotVerify(entry.id, "Verified")} disabled={verifyGot.isPending}>
                            <ShieldCheck className="h-3.5 w-3.5" />Verify
                          </Button>
                        )}
                        {entry.verificationStatus !== "Flagged" ? (
                          <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => handleGotVerify(entry.id, "Flagged")} disabled={verifyGot.isPending}>
                            <AlertTriangle className="h-3.5 w-3.5" />Flag
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleGotVerify(entry.id, "Pending")} disabled={verifyGot.isPending}>
                            <Clock className="h-3.5 w-3.5" />Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="biblical">
          {loadingBiblical ? (
            <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : !biblicalAudit || biblicalAudit.entries.length === 0 ? (
            <EmptyState label="No Biblical Notes submissions this week" />
          ) : (
            <div className="space-y-3">
              {biblicalAudit.entries.map((entry) => (
                <Card key={entry.id} className={entry.verificationStatus === "Verified" ? "border-green-200 bg-green-50/30" : entry.verificationStatus === "Flagged" ? "border-amber-200 bg-amber-50/30" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3 justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{entry.firstName} {entry.lastName}</p>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{entry.churchId}</span>
                          <VerificationBadge status={entry.verificationStatus} />
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <div><span className="text-muted-foreground text-xs">Date</span><p className="font-mono">{entry.noteDate}</p></div>
                          <div>
                            <span className="text-muted-foreground text-xs">Note Type</span>
                            <p>{entry.noteType ? <Badge variant="outline" className="text-xs font-normal">{entry.noteType === "HandWritten" ? "Handwritten" : entry.noteType}</Badge> : "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Status</span>
                            <p>{entry.isDone ? <span className="text-green-600 text-xs font-medium">Completed</span> : <span className="text-muted-foreground text-xs">Not done</span>}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 self-start">
                        {entry.verificationStatus !== "Verified" && (
                          <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleBiblicalVerify(entry.id, "Verified")} disabled={verifyBiblical.isPending}>
                            <ShieldCheck className="h-3.5 w-3.5" />Verify
                          </Button>
                        )}
                        {entry.verificationStatus !== "Flagged" ? (
                          <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => handleBiblicalVerify(entry.id, "Flagged")} disabled={verifyBiblical.isPending}>
                            <AlertTriangle className="h-3.5 w-3.5" />Flag
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleBiblicalVerify(entry.id, "Pending")} disabled={verifyBiblical.isPending}>
                            <Clock className="h-3.5 w-3.5" />Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Ministry Hub ────────────────────────────────────────────────────────

export default function MinistryHub() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  // Merge primary role with additional ministry roles so multi-role members see all
  // tabs they are entitled to, even when their primary role is still "Member".
  const extraRoles = Array.isArray(user?.ministryRoles) ? (user.ministryRoles as string[]) : [];
  const hasMinistryRole = (r: string) => role === r || extraRoles.includes(r);

  const isServant = hasMinistryRole("Servant");
  const isCaptain = hasMinistryRole("SharingCaptain");
  const isCgAuditor = hasMinistryRole("CgAuditor");
  const isChurchAuditor = hasMinistryRole("ChurchAuditor");
  const isPastor = hasMinistryRole("Pastor") || hasMinistryRole("Admin");
  const isFamilyLeader = hasMinistryRole("FamilyLeader") || user?.familyRole === "FamilyLeader";

  const hasAccess = isServant || isCaptain || isCgAuditor || isChurchAuditor || isPastor || isFamilyLeader;

  if (!hasAccess) {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  // Build tab list based on role
  const tabs: { value: string; label: string; icon: React.ReactNode }[] = [];
  if (isServant || isPastor) tabs.push({ value: "caring", label: "Caring Hub", icon: <Users className="h-3.5 w-3.5" /> });
  if (isFamilyLeader || isPastor) tabs.push({ value: "family", label: "Family Hub", icon: <Home className="h-3.5 w-3.5" /> });
  if (isCaptain || isPastor) tabs.push({ value: "sharing", label: "Sharing Hub", icon: <BarChart3 className="h-3.5 w-3.5" /> });
  if (isCgAuditor || isPastor) tabs.push({ value: "cg-audit", label: "CG Audit", icon: <ClipboardCheck className="h-3.5 w-3.5" /> });
  if (isChurchAuditor || isPastor) tabs.push({ value: "church-audit", label: "Church Audit", icon: <Building2 className="h-3.5 w-3.5" /> });
  const canAudit = isServant || isPastor;
  if (canAudit) tabs.push({ value: "audit", label: "GOT & Notes Audit", icon: <ShieldCheck className="h-3.5 w-3.5" /> });
  if (isPastor) tabs.push({ value: "overview", label: "All CGs", icon: <Star className="h-3.5 w-3.5" /> });
  if (isPastor) tabs.push({ value: "pastor-panel", label: "Pastor Panel", icon: <Crown className="h-3.5 w-3.5" /> });

  const defaultTab = tabs[0]?.value ?? "caring";

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Ministry Hub
        </h1>
        <p className="text-muted-foreground mt-2">
          {isServant && "Oversight and compliance dashboards for your Care Group."}
          {isCaptain && "Track sharing progress for your Sharing Huddle."}
          {isCgAuditor && "Audit your Care Group's weekly habits and submit reports."}
          {isChurchAuditor && "Review CG summaries and submit church-level reports."}
          {isPastor && "Full oversight across all care groups, sharing teams, and reports."}
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`flex flex-wrap gap-1 h-auto mb-6 ${tabs.length > 3 ? "justify-start" : ""}`}>
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs sm:text-sm">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(isServant || isPastor) && (
          <TabsContent value="caring">
            <CaringHubTab />
          </TabsContent>
        )}

        {(isFamilyLeader || isPastor) && (
          <TabsContent value="family">
            <FamilyHubTab />
          </TabsContent>
        )}

        {(isCaptain || isPastor) && (
          <TabsContent value="sharing">
            <SharingHubTab />
          </TabsContent>
        )}

        {(isCgAuditor || isPastor) && (
          <TabsContent value="cg-audit">
            {/* isPastor already includes Admin; Pastors/Admins always get full view regardless of auditor roles */}
            <CgAuditTab financialOnly={isCgAuditor && !isPastor} />
          </TabsContent>
        )}

        {(isChurchAuditor || isPastor) && (
          <TabsContent value="church-audit">
            {/* isPastor includes Admin; Pastors/Admins always get full narrative + financial view */}
            <ChurchAuditTab financialOnly={isChurchAuditor && !isPastor} />
          </TabsContent>
        )}

        {canAudit && (
          <TabsContent value="audit">
            <AuditPanel />
          </TabsContent>
        )}

        {isPastor && (
          <TabsContent value="overview">
            <PastorOverviewTab />
          </TabsContent>
        )}

        {isPastor && (
          <TabsContent value="pastor-panel">
            <PastorPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
