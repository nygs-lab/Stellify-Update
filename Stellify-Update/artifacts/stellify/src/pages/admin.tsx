import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, ExternalLink, KeyRound, AlertTriangle, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetAdminStats,
  useListMembers,
  useCreateMember,
  useUpdateMember,
  useUpdateMemberStatus,
  useUpdateStellarStatus,
  useDeleteMember,
  useListGroups,
  useCreateGroup,
  useDeleteGroup,
  useBulkImportMembers,
  useListStellarApprovals,
  useApproveStellarStatus,
  useRejectStellarStatus,
  useAdminResetMemberPassword,
  useAdminBulkResetPasswords,
  useAdminAnnualReset,
  useUpdateMemberRoles,
  useUpdateMemberDiscipleship,
  MemberInputAccountType,
  MemberInputRole,
  MemberInputStellarStatus,
  StellarStatusUpdateStellarStatus,
  GroupInputType,
  type MemberInput,
  type MemberUpdate,
  type MemberStatusUpdateStatus,
  type BulkImportResult,
  type Member,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const STATUS_OPTIONS: MemberStatusUpdateStatus[] = ["Active", "Deactivated", "Retired", "Deleted"];

// ─── Emergency contact data-quality helpers ────────────────────────────────────

function looksLikePhone(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("+")) return true;
  const stripped = value.replace(/[\s\-()]/g, "");
  return stripped.length > 0 && /^\d+$/.test(stripped);
}

function looksLikeWord(value: string): boolean {
  if (!value) return false;
  return /^[A-Za-z\s\-']+$/.test(value.trim());
}

/**
 * Returns a human-readable warning string when emergency contact fields
 * appear to be swapped or contain obviously wrong values, or null if clean.
 */
function contactFieldWarning(member: Member): string | null {
  const rel = member.emergencyContactRelationship ?? "";
  const num = member.emergencyContactNumber ?? "";
  const issues: string[] = [];
  if (rel && looksLikePhone(rel)) issues.push(`Relationship field looks like a phone number ("${rel}")`);
  if (num && looksLikeWord(num)) issues.push(`Contact number field looks like a word ("${num}")`);
  return issues.length > 0 ? issues.join("; ") : null;
}

const BULK_HEADER = "churchId,accountType,firstName,lastName,role,stellarStatus,email,password";

function parseBulkCsv(text: string): MemberInput[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const rows = lines.slice(1);
  return rows.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const get = (name: string) => { const i = idx(name); return i >= 0 ? cols[i] ?? "" : ""; };
    return {
      churchId: get("churchId"),
      accountType: (get("accountType") || "PCM") as MemberInput["accountType"],
      password: get("password") || "member123",
      firstName: get("firstName"),
      lastName: get("lastName"),
      role: (get("role") || "Member") as MemberInput["role"],
      stellarStatus: (get("stellarStatus") || "SBG") as MemberInput["stellarStatus"],
      email: get("email") || null,
    } satisfies MemberInput;
  });
}

// ─── Ministry role configuration ──────────────────────────────────────────────

const MINISTRY_ROLE_OPTIONS: Array<{
  role: string;
  label: string;
  groupKey: string | null;
  groupLabel?: string;
  placeholder?: string;
}> = [
  { role: "Member", label: "Regular Member", groupKey: null },
  { role: "FamilyLeader", label: "Family Leader", groupKey: "FamilyLeader", groupLabel: "Family Group #", placeholder: "e.g. FG-01" },
  { role: "Servant", label: "CG Servant", groupKey: "Servant", groupLabel: "CG Number", placeholder: "e.g. CG-03" },
  { role: "CgAuditor", label: "CG Auditor", groupKey: "CgAuditor", groupLabel: "CG Number", placeholder: "e.g. CG-03" },
  { role: "SharingCaptain", label: "Sharing Captain", groupKey: "SharingCaptain", groupLabel: "Sharing Huddle #", placeholder: "e.g. SH-02" },
  { role: "ChurchAuditor", label: "Church Auditor", groupKey: null },
  { role: "Pastor", label: "Pastor", groupKey: null },
  { role: "Admin", label: "Admin", groupKey: null },
];

// ─── Expandable member details row ────────────────────────────────────────────
interface MemberExpandedProps {
  member: Member;
  onClose: () => void;
}

function MemberExpandedRow({ member, onClose }: MemberExpandedProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const updateMember = useUpdateMember();
  const updateStellarStatus = useUpdateStellarStatus();
  const resetPassword = useAdminResetMemberPassword();
  const updateRoles = useUpdateMemberRoles();
  const updateDiscipleship = useUpdateMemberDiscipleship();

  const [resetPwd, setResetPwd] = useState("");
  const [resetTemporary, setResetTemporary] = useState(false);

  const [fields, setFields] = useState<Partial<MemberUpdate>>({
    salvationDate: member.salvationDate ?? "",
    bearingDate: member.bearingDate ?? "",
    dedicationDate: member.dedicationDate ?? "",
    sharingPermissionDate: member.sharingPermissionDate ?? "",
    isTestingAccount: member.isTestingAccount,
    role: (member.role ?? "Member") as MemberUpdate["role"],
    cgRole: member.cgRole ?? "",
    familyRole: member.familyRole ?? "",
    sharingHuddleRole: member.sharingHuddleRole ?? "",
  });

  // Separate state for ministry roles (jsonb array) and group mappings.
  // Pre-populate roleGroupMappings from existing canonical group columns for members
  // who had those fields set before the multi-role system was introduced.
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    Array.isArray(member.ministryRoles) ? member.ministryRoles : []
  );
  const [roleGroupMappings, setRoleGroupMappings] = useState<Record<string, string>>(() => {
    const stored = (member.roleGroupMappings as Record<string, string> | null) ?? {};
    const seed: Record<string, string> = {};
    if (!stored.Servant && member.cgNumber) seed.Servant = member.cgNumber;
    if (!stored.CgAuditor && member.cgNumber) seed.CgAuditor = member.cgNumber;
    if (!stored.SharingCaptain && member.sharingHuddleNumber) seed.SharingCaptain = member.sharingHuddleNumber;
    if (!stored.FamilyLeader && member.familyGroupNumber) seed.FamilyLeader = member.familyGroupNumber;
    return { ...seed, ...stored };
  });
  const [discipleshipEnabled, setDiscipleshipEnabled] = useState<boolean>(member.discipleshipEnabled);

  // Roles that are checked and require a group number
  const rolesNeedingGroup = selectedRoles.filter(r => {
    const opt = MINISTRY_ROLE_OPTIONS.find(o => o.role === r);
    return opt?.groupKey != null;
  });
  const allGroupNumbersFilled = rolesNeedingGroup.every(r => {
    const opt = MINISTRY_ROLE_OPTIONS.find(o => o.role === r)!;
    return (roleGroupMappings[opt.groupKey!] ?? "").trim() !== "";
  });
  const canSave = allGroupNumbersFilled;

  const [pendingStellar, setPendingStellar] = useState<string>(member.stellarStatus);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stellar-status-approvals"] });
  }

  async function handleResetPassword() {
    if (!resetPwd || resetPwd.length < 6) {
      toast({ variant: "destructive", title: "Invalid password", description: "Password must be at least 6 characters." });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: member.id, data: { password: resetPwd, temporary: resetTemporary } });
      setResetPwd("");
      toast({
        title: "Password reset",
        description: resetTemporary
          ? "Temporary password set — member must change it on next login."
          : "Password reset successfully.",
      });
    } catch {
      toast({ variant: "destructive", title: "Reset failed", description: "Could not reset the password." });
    }
  }

  async function handleSaveDetails() {
    if (!canSave) {
      toast({ variant: "destructive", title: "Group numbers required", description: "Fill in the group number for every checked leadership role." });
      return;
    }
    try {
      // Step 1: save dates, primary role, CG/family/huddle role labels, and flags.
      // Canonical group numbers (cgNumber, sharingHuddleNumber, familyGroupNumber) are
      // intentionally omitted here — the roles endpoint (step 2) is the single source
      // of truth for those columns when role-group mappings are present, preventing a
      // concurrent-write race condition where step 1 could overwrite step 2's values.
      await updateMember.mutateAsync({
        id: member.id,
        data: {
          salvationDate: (fields.salvationDate as string) || null,
          bearingDate: (fields.bearingDate as string) || null,
          dedicationDate: (fields.dedicationDate as string) || null,
          sharingPermissionDate: (fields.sharingPermissionDate as string) || null,
          isTestingAccount: fields.isTestingAccount,
          role: fields.role,
          cgRole: (fields.cgRole as string) || null,
          familyRole: (fields.familyRole as string) || null,
          sharingHuddleRole: (fields.sharingHuddleRole as string) || null,
        },
      });
      // Step 2: roles endpoint runs last — its canonical group column sync always wins.
      await updateRoles.mutateAsync({
        id: member.id,
        data: { ministryRoles: selectedRoles, roleGroupMappings },
      });
      // Step 3: discipleship toggle (no column conflicts with above).
      await updateDiscipleship.mutateAsync({
        id: member.id,
        data: { discipleshipEnabled },
      });
      invalidate();
      toast({ title: "Member updated", description: "Details saved successfully." });
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Could not update member details." });
    }
  }

  async function handleRequestStellarChange() {
    if (pendingStellar === member.stellarStatus) {
      toast({ variant: "destructive", title: "No change", description: "Select a different status to submit." });
      return;
    }
    try {
      await updateStellarStatus.mutateAsync({
        id: member.id,
        data: { stellarStatus: pendingStellar as typeof StellarStatusUpdateStellarStatus[keyof typeof StellarStatusUpdateStellarStatus] },
      });
      invalidate();
      toast({ title: "Approval requested", description: `Status change to ${pendingStellar} sent for Pastor review.` });
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Request failed", description: "Could not submit stellar status request." });
    }
  }

  const contactWarn = contactFieldWarning(member);

  return (
    <div className="p-4 bg-muted/30 border rounded-lg space-y-5">
      {contactWarn && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-medium">Emergency contact data issue: </span>
            {contactWarn}. Review the profile and correct the fields if needed.
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {([
          ["salvationDate", "Salvation Date"],
          ["bearingDate", "Bearing Date"],
          ["dedicationDate", "Dedication Date"],
          ["sharingPermissionDate", "Permission to Share Date"],
        ] as const).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input
              type="date"
              value={(fields[key] as string) ?? ""}
              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* Role & Group Assignment */}
      <div className="border-t pt-4 space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role &amp; Group Assignment</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Primary Role</Label>
            <Select
              value={(fields.role as string) ?? "Member"}
              onValueChange={(v) => setFields({ ...fields, role: v as MemberUpdate["role"] })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(MemberInputRole).map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CG Role</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. Member / Servant"
              value={(fields.cgRole as string) ?? ""}
              onChange={(e) => setFields({ ...fields, cgRole: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Family Role</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. Parent / Child"
              value={(fields.familyRole as string) ?? ""}
              onChange={(e) => setFields({ ...fields, familyRole: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sharing Huddle Role</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. Member / Captain"
              value={(fields.sharingHuddleRole as string) ?? ""}
              onChange={(e) => setFields({ ...fields, sharingHuddleRole: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ── Ministry Roles (multi-select with inline group number inputs) ── */}
      <div className="border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ministry Roles</Label>
          {rolesNeedingGroup.length > 0 && !allGroupNumbersFilled && (
            <span className="text-xs text-destructive font-medium">Fill in required group numbers below</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {MINISTRY_ROLE_OPTIONS.map(({ role, label, groupKey, groupLabel, placeholder }) => (
            <div key={role} className="space-y-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`role-${member.id}-${role}`}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRoles((prev) => [...prev, role]);
                    } else {
                      setSelectedRoles((prev) => prev.filter((r) => r !== role));
                      if (groupKey) {
                        setRoleGroupMappings((prev) => {
                          const next = { ...prev };
                          delete next[groupKey];
                          return next;
                        });
                      }
                    }
                  }}
                />
                <Label htmlFor={`role-${member.id}-${role}`} className="text-sm font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
              {groupKey && selectedRoles.includes(role) && (
                <div className="ml-6">
                  <Input
                    className={`h-7 text-sm ${!(roleGroupMappings[groupKey] ?? "").trim() ? "border-destructive ring-1 ring-destructive" : ""}`}
                    placeholder={`${groupLabel}: ${placeholder}`}
                    value={roleGroupMappings[groupKey] ?? ""}
                    onChange={(e) =>
                      setRoleGroupMappings((prev) => ({ ...prev, [groupKey]: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id={`disc-${member.id}`}
            checked={discipleshipEnabled}
            onCheckedChange={setDiscipleshipEnabled}
          />
          <Label htmlFor={`disc-${member.id}`} className="text-sm">Discipleship Enabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`test-${member.id}`}
            checked={fields.isTestingAccount ?? member.isTestingAccount}
            onCheckedChange={(v) => setFields({ ...fields, isTestingAccount: v === true })}
          />
          <Label htmlFor={`test-${member.id}`} className="text-sm">Testing Account</Label>
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reset Password</Label>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input
              type="password"
              placeholder="Min 6 characters"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="w-52"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              id={`temp-${member.id}`}
              checked={resetTemporary}
              onCheckedChange={setResetTemporary}
            />
            <Label htmlFor={`temp-${member.id}`} className="text-sm">Temporary (force change on login)</Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetPassword}
            disabled={resetPassword.isPending || !resetPwd}
          >
            {resetPassword.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </div>
      </div>

      <div className="flex items-end gap-3 pt-2 border-t">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Request Stellar Status Change</Label>
          <div className="flex gap-2">
            <Select value={pendingStellar} onValueChange={setPendingStellar}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(StellarStatusUpdateStellarStatus).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequestStellarChange}
              disabled={updateStellarStatus.isPending || !!member.pendingStellarStatus}
            >
              {updateStellarStatus.isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
          {member.pendingStellarStatus && (
            <p className="text-xs text-amber-600">Already pending: {member.pendingStellarStatus} — await Pastor action.</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigate(`/profile/${member.id}`)}
          >
            <ExternalLink className="h-3 w-3" />
            View Profile
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSaveDetails} disabled={updateMember.isPending || updateRoles.isPending || updateDiscipleship.isPending || !canSave}>
            {(updateMember.isPending || updateRoles.isPending || updateDiscipleship.isPending) ? "Saving…" : "Save Details"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Stellar Approvals tab (shared by Admin + Pastor) ─────────────────────────
function ApprovalsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = useListStellarApprovals(
    { status: "pending" },
    { query: { queryKey: ["/api/admin/stellar-status-approvals"] } },
  );
  const approve = useApproveStellarStatus();
  const reject = useRejectStellarStatus();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stellar-status-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/members"] });
  }

  async function handleApprove(id: number) {
    try {
      await approve.mutateAsync({ id });
      invalidate();
      toast({ title: "Approved", description: "Stellar status has been updated." });
    } catch {
      toast({ variant: "destructive", title: "Could not approve" });
    }
  }

  async function handleReject(id: number) {
    try {
      await reject.mutateAsync({ id });
      invalidate();
      toast({ title: "Rejected", description: "Status change request has been discarded." });
    } catch {
      toast({ variant: "destructive", title: "Could not reject" });
    }
  }

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading approvals…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Stellar Status Approvals</CardTitle>
        <CardDescription>
          Pending requests from Admins to change a member's stellar level. Only Pastors may approve or reject.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(pending ?? []).length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No pending approvals.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Church ID</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Requested Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pending ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.memberName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{a.memberChurchId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.currentStatus ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">{a.requestedStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.requestedByName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => handleApprove(a.id)}
                          disabled={approve.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleReject(a.id)}
                          disabled={reject.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isAdmin = user?.role === "Admin";
  const isPastor = user?.role === "Pastor";

  const { data: stats } = useGetAdminStats({ query: { queryKey: ["/api/admin/stats"] } });
  const { data: members } = useListMembers(undefined, { query: { queryKey: ["/api/members"] } });
  const { data: groups } = useListGroups(undefined, { query: { queryKey: ["/api/groups"] } });

  const createMember = useCreateMember();
  const updateStatus = useUpdateMemberStatus();
  const deleteMember = useDeleteMember();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const bulkImport = useBulkImportMembers();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterPendingLogin, setFilterPendingLogin] = useState(false);

  const [reg, setReg] = useState({
    churchId: "", firstName: "", lastName: "", password: "", email: "",
    accountType: MemberInputAccountType.PCM as MemberInput["accountType"],
    role: MemberInputRole.Member as MemberInput["role"],
    stellarStatus: MemberInputStellarStatus.SBG as MemberInput["stellarStatus"],
  });

  const [grp, setGrp] = useState({
    type: GroupInputType.CareGroup as (typeof GroupInputType)[keyof typeof GroupInputType],
    number: "", name: "", description: "",
  });

  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  const bulkResetPasswords = useAdminBulkResetPasswords();
  const [bulkPwd, setBulkPwd] = useState("");
  const [bulkPwdTemporary, setBulkPwdTemporary] = useState(false);
  const [bulkPwdResult, setBulkPwdResult] = useState<{ updated: number } | null>(null);

  const annualReset = useAdminAnnualReset();

  async function handleAnnualReset() {
    try {
      const result = await annualReset.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({
        title: "Annual reset complete",
        description: `Fragments reset for ${result.updated} member${result.updated !== 1 ? "s" : ""}.`,
      });
    } catch {
      toast({ variant: "destructive", title: "Reset failed", description: "Could not run the annual fragment reset. Check server logs." });
    }
  }

  if (!isAdmin && !isPastor) {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  function invalidateMembers() {
    queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!reg.churchId || !reg.firstName || !reg.lastName || !reg.password) {
      toast({ variant: "destructive", title: "Missing fields", description: "Church ID, name, and password are required." });
      return;
    }
    try {
      await createMember.mutateAsync({
        data: {
          churchId: reg.churchId, accountType: reg.accountType, password: reg.password,
          firstName: reg.firstName, lastName: reg.lastName, role: reg.role,
          stellarStatus: reg.stellarStatus, email: reg.email || null,
        },
      });
      invalidateMembers();
      toast({ title: "Member registered", description: `${reg.churchId} has been added.` });
      setReg({ churchId: "", firstName: "", lastName: "", password: "", email: "", accountType: MemberInputAccountType.PCM, role: MemberInputRole.Member, stellarStatus: MemberInputStellarStatus.SBG });
    } catch {
      toast({ variant: "destructive", title: "Registration failed", description: "Church ID may already exist." });
    }
  }

  async function handleStatusChange(id: number, status: MemberStatusUpdateStatus) {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      invalidateMembers();
      toast({ title: "Status updated" });
    } catch {
      toast({ variant: "destructive", title: "Could not update status" });
    }
  }

  async function handleDeleteMember(id: number) {
    try {
      await deleteMember.mutateAsync({ id });
      invalidateMembers();
      toast({ title: "Member deleted" });
    } catch {
      toast({ variant: "destructive", title: "Could not delete member" });
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!grp.number) {
      toast({ variant: "destructive", title: "Number required", description: "Please enter a group number." });
      return;
    }
    try {
      await createGroup.mutateAsync({ data: { type: grp.type, number: grp.number, name: grp.name || null, description: grp.description || null } });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Group created" });
      setGrp({ type: GroupInputType.CareGroup, number: "", name: "", description: "" });
    } catch {
      toast({ variant: "destructive", title: "Could not create group" });
    }
  }

  async function handleDeleteGroup(id: number) {
    try {
      await deleteGroup.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Group deleted" });
    } catch {
      toast({ variant: "destructive", title: "Could not delete group" });
    }
  }

  async function handleBulkResetPasswords() {
    if (!bulkPwd || bulkPwd.length < 6) {
      toast({ variant: "destructive", title: "Invalid password", description: "Password must be at least 6 characters." });
      return;
    }
    try {
      const result = await bulkResetPasswords.mutateAsync({ data: { password: bulkPwd, temporary: bulkPwdTemporary } });
      setBulkPwdResult(result);
      setBulkPwd("");
      toast({
        title: "Passwords reset",
        description: `${result.updated} member${result.updated !== 1 ? "s" : ""} updated.${bulkPwdTemporary ? " They must change their password on next login." : ""}`,
      });
    } catch {
      toast({ variant: "destructive", title: "Bulk reset failed", description: "Could not reset passwords." });
    }
  }

  async function handleBulkImport() {
    const parsed = parseBulkCsv(bulkText);
    if (parsed.length === 0) {
      toast({ variant: "destructive", title: "Nothing to import", description: "Paste CSV rows below the header." });
      return;
    }
    try {
      const result = await bulkImport.mutateAsync({ data: { members: parsed } });
      setBulkResult(result);
      invalidateMembers();
      toast({ title: "Import complete", description: `${result.imported} imported, ${result.skipped} skipped.` });
    } catch {
      toast({ variant: "destructive", title: "Import failed", description: "Check the CSV format and try again." });
    }
  }

  // Pastors see only the approvals view
  if (isPastor) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Stellar Approvals
          </h1>
          <p className="text-muted-foreground mt-2">Review and approve pending stellar status change requests.</p>
        </div>
        <ApprovalsTab />
      </div>
    );
  }

  // Full admin view
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-2">System administration and user management.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="py-4"><CardDescription className="font-medium text-xs uppercase tracking-wider">Total Members</CardDescription><CardTitle className="text-3xl">{stats?.totalMembers || 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="py-4"><CardDescription className="font-medium text-xs uppercase tracking-wider">Active Members</CardDescription><CardTitle className="text-3xl">{stats?.activeMembers || 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="py-4"><CardDescription className="font-medium text-xs uppercase tracking-wider">P2G Status (Top)</CardDescription><CardTitle className="text-3xl text-primary">{stats?.p2gMembers || 0}</CardTitle></CardHeader></Card>
        <Card
          className={stats?.pendingFirstLogin ? "border-amber-300 cursor-pointer hover:bg-amber-50/50 transition-colors" : ""}
          onClick={() => { if (stats?.pendingFirstLogin) { setFilterPendingLogin(true); const tab = document.querySelector('[data-value="members"]') as HTMLButtonElement; tab?.click(); } }}
        >
          <CardHeader className="py-4">
            <CardDescription className="font-medium text-xs uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              Pending First Login
            </CardDescription>
            <CardTitle className={`text-3xl ${stats?.pendingFirstLogin ? "text-amber-600" : ""}`}>
              {stats?.pendingFirstLogin ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Danger Zone — Admin only */}
      {isAdmin && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible system operations. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm font-medium">Reset Annual Fragments</p>
                <p className="text-xs text-muted-foreground">
                  Runs the January 1st annual reset manually — zeroes every member's fragment count and rebuilds scores for the new year. Use this if the server was down on New Year's Day and the automatic reset was missed.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={annualReset.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {annualReset.isPending ? "Resetting…" : "Reset Annual Fragments"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Annual Fragments?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will zero every member's fragment count and recalculate scores from scratch for the current year. This action cannot be undone. Only proceed if the automatic January 1st reset was missed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleAnnualReset}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, reset fragments
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="register" className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="members">Manage Members</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="import">Bulk Import</TabsTrigger>
          <TabsTrigger value="bulk-pwd">Bulk Password</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        {/* ── Register ── */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5" /> Register Member</CardTitle>
              <CardDescription>Add a new PCM or TCM member.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="grid gap-4 md:grid-cols-2 max-w-3xl">
                <div className="space-y-2"><Label htmlFor="churchId">Church ID</Label><Input id="churchId" placeholder="PCM0006" value={reg.churchId} onChange={(e) => setReg({ ...reg, churchId: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="reg-password">Initial Password</Label><Input id="reg-password" type="text" placeholder="member123" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="firstName">First Name</Label><Input id="firstName" value={reg.firstName} onChange={(e) => setReg({ ...reg, firstName: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="lastName">Last Name</Label><Input id="lastName" value={reg.lastName} onChange={(e) => setReg({ ...reg, lastName: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="reg-email">Email</Label><Input id="reg-email" type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select value={reg.accountType} onValueChange={(v) => setReg({ ...reg, accountType: v as MemberInput["accountType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.values(MemberInputAccountType).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={reg.role} onValueChange={(v) => setReg({ ...reg, role: v as MemberInput["role"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.values(MemberInputRole).map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Initial Stellar Status</Label>
                  <Select value={reg.stellarStatus} onValueChange={(v) => setReg({ ...reg, stellarStatus: v as MemberInput["stellarStatus"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.values(MemberInputStellarStatus).map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={createMember.isPending}>{createMember.isPending ? "Registering..." : "Register Member"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Manage Members ── */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Manage Members</CardTitle>
                  <CardDescription>Click the expand button to edit dates, discipleship, and submit stellar status changes.</CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="filter-pending-login"
                    checked={filterPendingLogin}
                    onCheckedChange={setFilterPendingLogin}
                  />
                  <Label htmlFor="filter-pending-login" className="text-sm flex items-center gap-1.5 cursor-pointer">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                    Pending first login only
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Church ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Stellar Status</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(members ?? [])
                      .filter((m) => !filterPendingLogin || m.mustChangePassword)
                      .map((m) => (
                      <>
                        <TableRow key={m.id} className={expandedId === m.id ? "bg-muted/20" : ""}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                              aria-label={expandedId === m.id ? "Collapse" : "Expand"}
                            >
                              {expandedId === m.id
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {m.churchId}
                            {m.isTestingAccount && (
                              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1">TEST</Badge>
                            )}
                            {m.mustChangePassword && (
                              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border border-amber-300 gap-0.5">
                                <KeyRound className="h-2.5 w-2.5" />
                                Pending
                              </Badge>
                            )}
                            {contactFieldWarning(m) && (
                              <Badge
                                className="ml-1.5 text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border border-red-300 gap-0.5"
                                title={contactFieldWarning(m) ?? undefined}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Contact
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{m.firstName} {m.lastName}</TableCell>
                          <TableCell>{m.role}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm">{m.stellarStatus}</span>
                              {m.pendingStellarStatus && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 w-fit border-amber-400 text-amber-700 bg-amber-50">
                                  pending: {m.pendingStellarStatus}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={m.status} onValueChange={(v) => handleStatusChange(m.id, v as MemberStatusUpdateStatus)}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteMember(m.id)} aria-label="Delete member">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedId === m.id && (
                          <TableRow key={`${m.id}-expanded`}>
                            <TableCell colSpan={7} className="p-3">
                              <MemberExpandedRow
                                member={m}
                                onClose={() => setExpandedId(null)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                    {(members ?? []).filter((m) => !filterPendingLogin || m.mustChangePassword).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {filterPendingLogin ? "No members with a pending first login." : "No members found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Groups ── */}
        <TabsContent value="groups">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create Group</CardTitle>
                <CardDescription>Care Groups, Sharing Huddles, and Family Groups.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={grp.type} onValueChange={(v) => setGrp({ ...grp, type: v as typeof grp.type })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.values(GroupInputType).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="grp-number">Number</Label><Input id="grp-number" placeholder="e.g. 1" value={grp.number} onChange={(e) => setGrp({ ...grp, number: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="grp-name">Name (optional)</Label><Input id="grp-name" value={grp.name} onChange={(e) => setGrp({ ...grp, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="grp-desc">Description (optional)</Label><Textarea id="grp-desc" value={grp.description} onChange={(e) => setGrp({ ...grp, description: e.target.value })} /></div>
                  <Button type="submit" disabled={createGroup.isPending}>{createGroup.isPending ? "Creating..." : "Create Group"}</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Existing Groups</CardTitle>
                <CardDescription>{groups?.length ?? 0} group(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {(groups ?? []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No groups yet.</div>
                ) : (
                  <div className="space-y-2">
                    {(groups ?? []).map((g) => (
                      <div key={g.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{g.type} #{g.number}</p>
                          {g.name && <p className="text-xs text-muted-foreground">{g.name}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)} aria-label="Delete group">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Bulk Import ── */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk Import</CardTitle>
              <CardDescription>Paste CSV rows from the PMDB template. The first line must be the header.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">{BULK_HEADER}</div>
              <Textarea
                rows={10}
                className="font-mono text-sm"
                placeholder={`${BULK_HEADER}\nPCM0100,PCM,Juan,Dela Cruz,Member,SBG,juan@example.com,member123`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <Button onClick={handleBulkImport} disabled={bulkImport.isPending}>
                {bulkImport.isPending ? "Importing..." : "Import Members"}
              </Button>
              {bulkResult && (
                <div className="rounded-md border p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-green-600">{bulkResult.imported}</span> imported,{" "}
                    <span className="font-medium text-yellow-600">{bulkResult.skipped}</span> skipped
                  </p>
                  {bulkResult.errors.length > 0 && (
                    <ul className="text-xs text-destructive list-disc pl-5 space-y-1">
                      {bulkResult.errors.map((err, i) => (<li key={i}>{err}</li>))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bulk Password Reset ── */}
        <TabsContent value="bulk-pwd">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk Password Reset</CardTitle>
              <CardDescription>Set one password for all members at once. Use this to reset everyone to a known default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="bulk-pwd-input">New Password (min 6 characters)</Label>
                  <Input
                    id="bulk-pwd-input"
                    type="password"
                    placeholder="e.g. member123"
                    value={bulkPwd}
                    onChange={(e) => setBulkPwd(e.target.value)}
                    className="w-64"
                  />
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                  <Switch
                    id="bulk-pwd-temp"
                    checked={bulkPwdTemporary}
                    onCheckedChange={setBulkPwdTemporary}
                  />
                  <Label htmlFor="bulk-pwd-temp">Temporary — force members to change on next login</Label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="destructive"
                  onClick={handleBulkResetPasswords}
                  disabled={bulkResetPasswords.isPending || !bulkPwd}
                >
                  {bulkResetPasswords.isPending ? "Resetting…" : "Reset All Passwords"}
                </Button>
                <p className="text-xs text-muted-foreground">This affects every member in the system.</p>
              </div>
              {bulkPwdResult && (
                <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    {bulkPwdResult.updated} member{bulkPwdResult.updated !== 1 ? "s" : ""} updated successfully.
                    {bulkPwdTemporary && " They will be prompted to change their password on next login."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Approvals ── */}
        <TabsContent value="approvals">
          <ApprovalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
