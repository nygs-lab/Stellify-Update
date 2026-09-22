import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  useListSermons, useCreateSermon, useUpdateSermon, useDeleteSermon,
  getListSermonsUrl,
  useListEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  getListEventsUrl,
  useListGuides, useCreateGuide, useUpdateGuide, useDeleteGuide,
  getListGuidesUrl,
  useListPrayerRequests, useCreatePrayerRequest, useUpdatePrayerRequest, useCompletePrayerRequest,
  getListPrayerRequestsUrl,
  useListCounselingRequests, useCreateCounselingRequest, useUpdateCounselingRequest, useCompleteCounselingRequest,
  getListCounselingRequestsUrl,
  useListCounselingLeaders,
  useListFeedback, useSubmitFeedback, useUpdateFeedback, useAdviseFeedback,
  getListFeedbackUrl,
} from "@workspace/api-client-react";
import type {
  Sermon, SermonUpdate,
  ChurchEvent, ChurchEventInput,
  Guide, GuideInput,
  PrayerRequest, PrayerRequestInput, PrayerRequestUpdate,
  CounselingRequest, CounselingRequestInput, CounselingRequestUpdate,
  Feedback, FeedbackInput, FeedbackUpdate,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Pencil, Trash2, Plus, CheckCircle2, ExternalLink,
  BookOpen, Calendar, FileText, Heart, Users, MessageSquare, Inbox,
  ChevronLeft, ChevronRight,
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  "Worship", "Caregroup", "Sharing Huddle", "Special Event",
  "On-site Event", "In Memory of the Lord Jesus", "Church Celebration",
];

const GUIDE_TYPES = [
  { value: "ApplicationUserGuide", label: "App User Guide" },
  { value: "MinistryGuide", label: "Ministry Guide" },
  { value: "MinisterGuide", label: "Minister Guide" },
];

const TARGET_LEVELS = [
  { value: "ChurchLevel", label: "Church" },
  { value: "CaregroupLevel", label: "Care Group" },
  { value: "SharingHuddleLevel", label: "Sharing Huddle" },
  { value: "AuditorLevel", label: "Auditor" },
  { value: "AdminLevel", label: "Admin" },
  { value: "PastorLevel", label: "Pastor" },
];

const VISIBILITY_OPTIONS = [
  { value: "Church", label: "Whole Church" },
  { value: "ServantOnly", label: "Care Group" },
  { value: "CaptainOnly", label: "Sharing Huddle" },
  { value: "PastorOnly", label: "Pastor Only" },
];

const CONNECT_TYPES = [
  { value: "Online", label: "Online" },
  { value: "InPerson", label: "In-person" },
];

const LEADER_ROLES = ["Pastor", "Servant", "SharingCaptain"] as const;

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function convertDriveLink(url?: string | null): string | null {
  if (!url) return null;
  // Google Slides presentation — use the embed URL which supports slide navigation
  const slidesMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false&delayms=60000`;
  }
  // Regular Drive file (PDF, video, etc.)
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!fileMatch) return null;
  return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
}

function isSlideLink(url?: string | null): boolean {
  if (!url) return false;
  return /\/presentation\/d\//.test(url);
}

function labelFor<T extends { value: string; label: string }>(list: T[], val?: string | null) {
  return list.find((x) => x.value === val)?.label ?? val ?? "—";
}

function visibilityLabel(v: string) {
  return VISIBILITY_OPTIONS.find((x) => x.value === v)?.label ?? v;
}

function leaderRoleToTarget(role: string): string {
  if (role === "SharingCaptain") return "Captain";
  return role;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "PPP"); } catch { return d; }
}

// ─── DRIVE PREVIEW ────────────────────────────────────────────────────────────

function DrivePreview({
  url,
  iframeRef,
}: {
  url?: string | null;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}) {
  const src = convertDriveLink(url);
  if (!src) return <p className="text-xs text-muted-foreground">No media linked.</p>;
  return (
    <iframe
      ref={iframeRef}
      src={src}
      className="w-full h-full rounded"
      allow="autoplay"
      title="Drive Preview"
    />
  );
}

// ─── BIBLICAL MESSAGE TAB ─────────────────────────────────────────────────────

function BiblicalMessageTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: sermons = [] } = useListSermons();
  const [dlg, setDlg] = useState<{ open: boolean; sermon?: Sermon }>({ open: false });
  const [preview, setPreview] = useState<Sermon | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [form, setForm] = useState<{
    title: string; speaker: string; publishDate: string; shortDescription: string; driveLink: string;
  }>({ title: "", speaker: "", publishDate: "", shortDescription: "", driveLink: "" });

  function openPreview(s: Sermon) {
    setSlideIndex(0);
    setPreview(s);
  }

  function handleSlideNext() {
    const iframe = previewIframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ action: "next" }), "*");
    }
    setSlideIndex((i) => i + 1);
  }

  function handleSlidePrev() {
    if (slideIndex === 0) return;
    const iframe = previewIframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ action: "prev" }), "*");
    }
    setSlideIndex((i) => i - 1);
  }

  function openAdd() {
    setForm({ title: "", speaker: "", publishDate: "", shortDescription: "", driveLink: "" });
    setDlg({ open: true });
  }
  function openEdit(s: Sermon) {
    setForm({
      title: s.title, speaker: s.speaker, publishDate: s.publishDate,
      shortDescription: s.shortDescription ?? "", driveLink: s.driveLink ?? "",
    });
    setDlg({ open: true, sermon: s });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListSermonsUrl()] });
  const createMut = useCreateSermon({
    mutation: { onSuccess: () => { inv(); toast.success("Sermon added"); setDlg({ open: false }); }, onError: () => toast.error("Failed to add sermon") },
  });
  const updateMut = useUpdateSermon({
    mutation: { onSuccess: () => { inv(); toast.success("Sermon updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });
  const deleteMut = useDeleteSermon({
    mutation: { onSuccess: () => { inv(); toast.success("Sermon deleted"); }, onError: () => toast.error("Failed to delete") },
  });

  function handleSave() {
    if (!form.title || !form.speaker || !form.publishDate) { toast.error("Title, speaker and date are required"); return; }
    const payload = {
      title: form.title, speaker: form.speaker, publishDate: form.publishDate,
      shortDescription: form.shortDescription || null, driveLink: form.driveLink || null,
    };
    if (dlg.sermon) {
      updateMut.mutate({ id: dlg.sermon.id, data: payload as SermonUpdate });
    } else {
      createMut.mutate({ data: payload });
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />Add Biblical Message
          </Button>
        </div>
      )}
      {sermons.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No recordings yet.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {sermons.map((s) => (
          <Card key={s.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {s.driveLink && (
              <div className="aspect-video border-b">
                <DrivePreview url={s.driveLink} />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {s.speaker} · {fmtDate(s.publishDate)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {s.driveLink && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(s)} title="Expand">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate({ id: s.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            {s.shortDescription && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{s.shortDescription}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) { setPreview(null); setSlideIndex(0); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-6">
              <DialogTitle className="truncate">{preview?.title}</DialogTitle>
              {isSlideLink(preview?.driveLink) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    onClick={handleSlidePrev}
                    disabled={slideIndex === 0}
                    title="Previous slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-16 text-center tabular-nums">
                    Slide {slideIndex + 1}
                  </span>
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    onClick={handleSlideNext}
                    title="Next slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="aspect-video">
            <DrivePreview url={preview?.driveLink} iframeRef={previewIframeRef} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.sermon ? "Edit Biblical Message" : "Add Biblical Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Speaker" value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Publish Date</Label>
              <Input type="date" value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} />
            </div>
            <Textarea
              placeholder="Short description (optional)"
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              rows={2}
            />
            <Input
              placeholder="Google Drive share link (optional)"
              value={form.driveLink}
              onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
            />
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.sermon ? "Save Changes" : "Add Message"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── EVENT CARD ───────────────────────────────────────────────────────────────

function EventCard({
  event: e, isAdmin, onEdit, onDelete,
}: {
  event: ChurchEvent; isAdmin: boolean;
  onEdit: (e: ChurchEvent) => void; onDelete: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{e.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{fmtDate(e.eventDate)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="secondary" className="text-xs">{e.eventType}</Badge>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(e)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(e.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      {(e.location || e.meetLink || e.description) && (
        <CardContent className="pt-0 text-sm space-y-1">
          {e.location && <p className="text-muted-foreground">📍 {e.location}</p>}
          {e.meetLink && (
            <a href={e.meetLink} target="_blank" rel="noreferrer" className="text-primary underline text-xs">
              Join Online
            </a>
          )}
          {e.description && <p className="text-muted-foreground">{e.description}</p>}
        </CardContent>
      )}
    </Card>
  );
}

// ─── EVENTS TAB ───────────────────────────────────────────────────────────────

function EventsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: events = [] } = useListEvents();
  const [dlg, setDlg] = useState<{ open: boolean; event?: ChurchEvent }>({ open: false });
  const [form, setForm] = useState<{
    title: string; eventDate: string; eventType: string;
    location: string; meetLink: string; description: string;
  }>({ title: "", eventDate: "", eventType: "", location: "", meetLink: "", description: "" });

  function openAdd() {
    setForm({ title: "", eventDate: "", eventType: "", location: "", meetLink: "", description: "" });
    setDlg({ open: true });
  }
  function openEdit(e: ChurchEvent) {
    setForm({
      title: e.title, eventDate: e.eventDate, eventType: e.eventType,
      location: e.location ?? "", meetLink: e.meetLink ?? "", description: e.description ?? "",
    });
    setDlg({ open: true, event: e });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListEventsUrl()] });
  const createMut = useCreateEvent({
    mutation: { onSuccess: () => { inv(); toast.success("Event added"); setDlg({ open: false }); }, onError: () => toast.error("Failed to add event") },
  });
  const updateMut = useUpdateEvent({
    mutation: { onSuccess: () => { inv(); toast.success("Event updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });
  const deleteMut = useDeleteEvent({
    mutation: { onSuccess: () => { inv(); toast.success("Event deleted"); }, onError: () => toast.error("Failed to delete") },
  });

  function handleSave() {
    if (!form.title || !form.eventDate || !form.eventType) { toast.error("Title, date and type are required"); return; }
    const payload = {
      title: form.title, eventDate: form.eventDate,
      eventType: form.eventType as ChurchEventInput["eventType"],
      location: form.location || null, meetLink: form.meetLink || null,
      description: form.description || null,
    };
    if (dlg.event) {
      updateMut.mutate({ id: dlg.event.id, data: payload });
    } else {
      createMut.mutate({ data: payload });
    }
  }

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.eventDate >= now);
  const past = events.filter((e) => e.eventDate < now);

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />Add Event
          </Button>
        </div>
      )}
      {events.length === 0 && <p className="text-center text-muted-foreground py-8">No events yet.</p>}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} isAdmin={isAdmin} onEdit={openEdit} onDelete={(id) => deleteMut.mutate({ id })} />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Past</p>
          <div className="grid gap-3 md:grid-cols-2">
            {past.map((e) => (
              <EventCard key={e.id} event={e} isAdmin={isAdmin} onEdit={openEdit} onDelete={(id) => deleteMut.mutate({ id })} />
            ))}
          </div>
        </div>
      )}

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg.event ? "Edit Event" : "Add Event"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date &amp; Time</Label>
              <Input type="datetime-local" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
              <SelectTrigger><SelectValue placeholder="Event type" /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Google Meet link (optional)" value={form.meetLink} onChange={(e) => setForm({ ...form, meetLink: e.target.value })} />
            <Textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.event ? "Save Changes" : "Add Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── GUIDES TAB ───────────────────────────────────────────────────────────────

function GuidesTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: guides = [] } = useListGuides();
  const [dlg, setDlg] = useState<{ open: boolean; guide?: Guide }>({ open: false });
  const [preview, setPreview] = useState<Guide | null>(null);
  const [form, setForm] = useState<{
    title: string; guideType: string; targetLevel: string; description: string; driveLink: string;
  }>({ title: "", guideType: "", targetLevel: "", description: "", driveLink: "" });

  function openAdd() {
    setForm({ title: "", guideType: "", targetLevel: "", description: "", driveLink: "" });
    setDlg({ open: true });
  }
  function openEdit(g: Guide) {
    setForm({
      title: g.title, guideType: g.guideType, targetLevel: g.targetLevel,
      description: g.description ?? "", driveLink: g.driveLink ?? "",
    });
    setDlg({ open: true, guide: g });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListGuidesUrl()] });
  const createMut = useCreateGuide({
    mutation: { onSuccess: () => { inv(); toast.success("Guide added"); setDlg({ open: false }); }, onError: () => toast.error("Failed to add guide") },
  });
  const updateMut = useUpdateGuide({
    mutation: { onSuccess: () => { inv(); toast.success("Guide updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });
  const deleteMut = useDeleteGuide({
    mutation: { onSuccess: () => { inv(); toast.success("Guide deleted"); }, onError: () => toast.error("Failed to delete") },
  });

  function handleSave() {
    if (!form.title || !form.guideType || !form.targetLevel) { toast.error("Title, type and level are required"); return; }
    const payload = {
      title: form.title,
      guideType: form.guideType as GuideInput["guideType"],
      targetLevel: form.targetLevel as GuideInput["targetLevel"],
      description: form.description || null,
      driveLink: form.driveLink || null,
    };
    if (dlg.guide) {
      updateMut.mutate({ id: dlg.guide.id, data: payload });
    } else {
      createMut.mutate({ data: payload });
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />Add Guide
          </Button>
        </div>
      )}
      {guides.length === 0 && <p className="text-center text-muted-foreground py-8">No guides yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => (
          <Card key={g.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {g.driveLink && (
              <div className="aspect-video border-b">
                <DrivePreview url={g.driveLink} />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{g.title}</CardTitle>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{labelFor(GUIDE_TYPES, g.guideType)}</Badge>
                    <Badge variant="secondary" className="text-xs">{labelFor(TARGET_LEVELS, g.targetLevel)}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {g.driveLink && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(g)} title="Expand">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate({ id: g.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            {g.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{g.description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          <DrivePreview url={preview?.driveLink} />
        </DialogContent>
      </Dialog>

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg.guide ? "Edit Guide" : "Add Guide"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.guideType} onValueChange={(v) => setForm({ ...form, guideType: v })}>
              <SelectTrigger><SelectValue placeholder="Guide type" /></SelectTrigger>
              <SelectContent>
                {GUIDE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.targetLevel} onValueChange={(v) => setForm({ ...form, targetLevel: v })}>
              <SelectTrigger><SelectValue placeholder="Target level" /></SelectTrigger>
              <SelectContent>
                {TARGET_LEVELS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
            <Input
              placeholder="Google Drive share link (optional)"
              value={form.driveLink}
              onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
            />
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.guide ? "Save Changes" : "Add Guide"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PRAYER REQUESTS TAB ──────────────────────────────────────────────────────

function PrayerTab({ userId }: { userId?: number }) {
  const qc = useQueryClient();
  const { data: requests = [] } = useListPrayerRequests();
  const [dlg, setDlg] = useState<{ open: boolean; request?: PrayerRequest }>({ open: false });
  const [form, setForm] = useState<{ description: string; visibility: string }>({
    description: "", visibility: "Church",
  });

  function openAdd() { setForm({ description: "", visibility: "Church" }); setDlg({ open: true }); }
  function openEdit(r: PrayerRequest) {
    setForm({ description: r.description, visibility: r.visibility });
    setDlg({ open: true, request: r });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListPrayerRequestsUrl()] });
  const createMut = useCreatePrayerRequest({
    mutation: { onSuccess: () => { inv(); toast.success("Prayer request submitted"); setDlg({ open: false }); }, onError: () => toast.error("Failed to submit") },
  });
  const updateMut = useUpdatePrayerRequest({
    mutation: { onSuccess: () => { inv(); toast.success("Request updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });

  function handleSave() {
    if (!form.description || !form.visibility) { toast.error("Description and visibility are required"); return; }
    if (dlg.request) {
      updateMut.mutate({
        id: dlg.request.id,
        data: { description: form.description, visibility: form.visibility as PrayerRequestUpdate["visibility"] },
      });
    } else {
      createMut.mutate({ data: { description: form.description, visibility: form.visibility as PrayerRequestInput["visibility"] } });
    }
  }

  const active = requests.filter((r) => !r.isDone);
  const done = requests.filter((r) => r.isDone);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" />Submit Prayer Request
        </Button>
      </div>
      {requests.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No prayer requests yet.</p>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-start gap-3">
                <Heart className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{r.description}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{visibilityLabel(r.visibility)}</Badge>
                    {r.memberName && (
                      <span className="text-xs text-muted-foreground">by {r.memberName}</span>
                    )}
                  </div>
                </div>
                {r.memberId === userId && !r.isDone && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(r)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Answered</p>
          {done.map((r) => (
            <Card key={r.id} className="opacity-60 mb-2">
              <CardContent className="py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm line-through">{r.description}</p>
                  {r.doneByName && (
                    <p className="text-xs text-muted-foreground">Prayed for by {r.doneByName}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.request ? "Edit Prayer Request" : "Submit Prayer Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="What would you like the church to pray for?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
            <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
              <SelectTrigger><SelectValue placeholder="Visible to" /></SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.request ? "Save Changes" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── COUNSELING TAB ───────────────────────────────────────────────────────────

function CounselingTab({ userId }: { userId?: number }) {
  const qc = useQueryClient();
  const { data: requests = [] } = useListCounselingRequests();
  const { data: leaders = [] } = useListCounselingLeaders();
  const [dlg, setDlg] = useState<{ open: boolean; request?: CounselingRequest }>({ open: false });
  const [form, setForm] = useState<{
    reason: string; preferredDate: string; connectType: string; counselorTarget: string;
  }>({ reason: "", preferredDate: "", connectType: "Online", counselorTarget: "Pastor" });

  function openAdd() {
    setForm({ reason: "", preferredDate: "", connectType: "Online", counselorTarget: "Pastor" });
    setDlg({ open: true });
  }
  function openEdit(r: CounselingRequest) {
    setForm({ reason: r.reason, preferredDate: r.preferredDate, connectType: r.connectType, counselorTarget: r.counselorTarget });
    setDlg({ open: true, request: r });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListCounselingRequestsUrl()] });
  const createMut = useCreateCounselingRequest({
    mutation: { onSuccess: () => { inv(); toast.success("Counseling request submitted"); setDlg({ open: false }); }, onError: () => toast.error("Failed to submit") },
  });
  const updateMut = useUpdateCounselingRequest({
    mutation: { onSuccess: () => { inv(); toast.success("Request updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });

  function handleSave() {
    if (!form.reason || !form.preferredDate || !form.connectType || !form.counselorTarget) {
      toast.error("All fields are required"); return;
    }
    const payload = {
      reason: form.reason, preferredDate: form.preferredDate,
      connectType: form.connectType as CounselingRequestInput["connectType"],
      counselorTarget: form.counselorTarget as CounselingRequestInput["counselorTarget"],
    };
    if (dlg.request) {
      updateMut.mutate({ id: dlg.request.id, data: payload as CounselingRequestUpdate });
    } else {
      createMut.mutate({ data: payload });
    }
  }

  const active = requests.filter((r) => !r.isDone);
  const done = requests.filter((r) => r.isDone);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" />Request Counseling
        </Button>
      </div>
      {requests.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No counseling requests yet.</p>
      )}

      {active.map((r) => (
        <Card key={r.id}>
          <CardContent className="py-3 flex items-start gap-3">
            <Users className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{r.reason}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{labelFor(CONNECT_TYPES, r.connectType)}</Badge>
                <Badge variant="secondary" className="text-xs">For: {r.counselorTarget}</Badge>
                <span className="text-xs text-muted-foreground">Preferred: {fmtDate(r.preferredDate)}</span>
                {r.memberName && <span className="text-xs text-muted-foreground">by {r.memberName}</span>}
              </div>
            </div>
            {r.memberId === userId && !r.isDone && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(r)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {done.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Completed</p>
          {done.map((r) => (
            <Card key={r.id} className="opacity-60 mb-2">
              <CardContent className="py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm line-through">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.counselorTarget} · {fmtDate(r.preferredDate)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.request ? "Edit Counseling Request" : "Request Counseling"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Reason for counseling"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
            />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Preferred Date</Label>
              <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
            </div>
            <Select value={form.connectType} onValueChange={(v) => setForm({ ...form, connectType: v })}>
              <SelectTrigger><SelectValue placeholder="Connect type" /></SelectTrigger>
              <SelectContent>
                {CONNECT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.counselorTarget} onValueChange={(v) => setForm({ ...form, counselorTarget: v })}>
              <SelectTrigger><SelectValue placeholder="Request counselor" /></SelectTrigger>
              <SelectContent>
                {leaders.length > 0
                  ? leaders.map((l) => (
                      <SelectItem key={l.id} value={leaderRoleToTarget(l.role)}>
                        {l.firstName} {l.lastName} ({l.role === "SharingCaptain" ? "Captain" : l.role})
                      </SelectItem>
                    ))
                  : (["Pastor", "Servant", "Captain"] as const).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.request ? "Save Changes" : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── FEEDBACK TAB ─────────────────────────────────────────────────────────────

function FeedbackTab({ userId }: { userId?: number }) {
  const qc = useQueryClient();
  const { data: feedbackList = [] } = useListFeedback();
  const [dlg, setDlg] = useState<{ open: boolean; feedback?: Feedback }>({ open: false });
  const [form, setForm] = useState<{ categoryTitle: string; description: string; isAnonymous: boolean }>({
    categoryTitle: "", description: "", isAnonymous: false,
  });

  function openAdd() { setForm({ categoryTitle: "", description: "", isAnonymous: false }); setDlg({ open: true }); }
  function openEdit(f: Feedback) {
    setForm({ categoryTitle: f.categoryTitle, description: f.description, isAnonymous: f.isAnonymous });
    setDlg({ open: true, feedback: f });
  }

  const inv = () => qc.invalidateQueries({ queryKey: [getListFeedbackUrl()] });
  const createMut = useSubmitFeedback({
    mutation: { onSuccess: () => { inv(); toast.success("Feedback submitted"); setDlg({ open: false }); }, onError: () => toast.error("Failed to submit") },
  });
  const updateMut = useUpdateFeedback({
    mutation: { onSuccess: () => { inv(); toast.success("Feedback updated"); setDlg({ open: false }); }, onError: () => toast.error("Failed to update") },
  });

  function handleSave() {
    if (!form.categoryTitle || !form.description) { toast.error("Category and description are required"); return; }
    if (dlg.feedback) {
      updateMut.mutate({ id: dlg.feedback.id, data: form as FeedbackUpdate });
    } else {
      createMut.mutate({ data: form as FeedbackInput });
    }
  }

  const pending = feedbackList.filter((f) => f.status === "Pending");
  const advised = feedbackList.filter((f) => f.status !== "Pending");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" />Submit Feedback
        </Button>
      </div>
      {feedbackList.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No feedback yet.</p>
      )}

      {pending.map((f) => (
        <Card key={f.id}>
          <CardContent className="py-3 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{f.categoryTitle}</p>
              <p className="text-sm text-muted-foreground">{f.description}</p>
              <div className="flex gap-2 mt-1">
                {f.isAnonymous && <Badge variant="outline" className="text-xs">Anonymous</Badge>}
                <Badge variant="secondary" className="text-xs">Pending</Badge>
              </div>
            </div>
            {f.memberId === userId && f.status === "Pending" && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(f)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {advised.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Taken into Advisement</p>
          {advised.map((f) => (
            <Card key={f.id} className="opacity-70 mb-2">
              <CardContent className="py-3 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{f.categoryTitle}</p>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                  {f.isAnonymous && <Badge variant="outline" className="text-xs mt-1">Anonymous</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlg.open} onOpenChange={(o) => setDlg({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg.feedback ? "Edit Feedback" : "Submit Feedback"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Category (e.g. Worship, Leadership, Events)"
              value={form.categoryTitle}
              onChange={(e) => setForm({ ...form, categoryTitle: e.target.value })}
            />
            <Textarea
              placeholder="Describe your feedback"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="anon"
                checked={form.isAnonymous}
                onCheckedChange={(c) => setForm({ ...form, isAnonymous: c })}
              />
              <Label htmlFor="anon" className="text-sm">Submit anonymously</Label>
            </div>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full">
              {dlg.feedback ? "Save Changes" : "Submit Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── LEADER INBOX TAB ─────────────────────────────────────────────────────────

function LeaderInboxTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "";

  const { data: prayers = [] } = useListPrayerRequests();
  const { data: counseling = [] } = useListCounselingRequests();
  const { data: feedbackList = [] } = useListFeedback();

  const completePrayer = useCompletePrayerRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [getListPrayerRequestsUrl()] }); toast.success("Marked as prayed for"); },
      onError: () => toast.error("Failed"),
    },
  });
  const completeCounseling = useCompleteCounselingRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [getListCounselingRequestsUrl()] }); toast.success("Marked as counseled"); },
      onError: () => toast.error("Failed"),
    },
  });
  const adviseFb = useAdviseFeedback({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: [getListFeedbackUrl()] }); toast.success("Feedback acknowledged"); },
      onError: () => toast.error("Failed"),
    },
  });

  // Only surface prayers that require *this* leader's specific action.
  // Church-visibility prayers are community items, not leader-action items.
  const pendingPrayers = prayers.filter((r) => {
    if (r.isDone) return false;
    if (role === "Admin" || role === "Pastor") return r.visibility === "PastorOnly" || r.visibility === "Church";
    if (role === "Servant") return r.visibility === "ServantOnly";
    if (role === "SharingCaptain") return r.visibility === "CaptainOnly";
    return false;
  });
  // Counseling is already group-scoped by the backend; all pending items need action.
  const pendingCounseling = counseling.filter((r) => !r.isDone);
  const pendingFeedback = feedbackList.filter((f) => f.status === "Pending");
  const total = pendingPrayers.length + pendingCounseling.length + pendingFeedback.length;

  if (total === 0) {
    return (
      <p className="text-center text-muted-foreground py-10">
        All caught up — no pending items in your inbox.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {pendingPrayers.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-400" />
            Prayer Requests ({pendingPrayers.length})
          </p>
          <div className="space-y-2">
            {pendingPrayers.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{r.description}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{visibilityLabel(r.visibility)}</Badge>
                      {r.memberName && <span className="text-xs text-muted-foreground">by {r.memberName}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline" className="shrink-0"
                    onClick={() => completePrayer.mutate({ id: r.id })}
                    disabled={completePrayer.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Prayed For
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingCounseling.length > 0 && (
        <div>
          <Separator />
          <p className="text-sm font-semibold mt-4 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Counseling Requests ({pendingCounseling.length})
          </p>
          <div className="space-y-2">
            {pendingCounseling.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.reason}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{labelFor(CONNECT_TYPES, r.connectType)}</Badge>
                      <span className="text-xs text-muted-foreground">Preferred: {fmtDate(r.preferredDate)}</span>
                      {r.memberName && <span className="text-xs text-muted-foreground">by {r.memberName}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline" className="shrink-0"
                    onClick={() => completeCounseling.mutate({ id: r.id })}
                    disabled={completeCounseling.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Counseled
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingFeedback.length > 0 && (
        <div>
          <Separator />
          <p className="text-sm font-semibold mt-4 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-yellow-500" />
            Feedback ({pendingFeedback.length})
          </p>
          <div className="space-y-2">
            {pendingFeedback.map((f) => (
              <Card key={f.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{f.categoryTitle}</p>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                    {f.isAnonymous && <Badge variant="outline" className="text-xs mt-1">Anonymous</Badge>}
                  </div>
                  <Button
                    size="sm" variant="outline" className="shrink-0"
                    onClick={() => adviseFb.mutate({ id: f.id })}
                    disabled={adviseFb.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Feedback Acknowledged
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ChurchHub() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const isLeader = LEADER_ROLES.includes(user?.role as (typeof LEADER_ROLES)[number]) || isAdmin;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Church Hub</h1>
        <p className="text-muted-foreground text-sm">
          Biblical messages, events, guides, prayer, counseling and feedback
        </p>
      </div>

      <Tabs defaultValue="biblical-message">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto gap-1 mb-4 flex-wrap">
            <TabsTrigger value="biblical-message" className="flex items-center gap-1.5 py-1.5">
              <BookOpen className="w-3.5 h-3.5" />Biblical Message
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-1.5 py-1.5">
              <Calendar className="w-3.5 h-3.5" />Events
            </TabsTrigger>
            <TabsTrigger value="guides" className="flex items-center gap-1.5 py-1.5">
              <FileText className="w-3.5 h-3.5" />Guides
            </TabsTrigger>
            <TabsTrigger value="prayer" className="flex items-center gap-1.5 py-1.5">
              <Heart className="w-3.5 h-3.5" />Prayer
            </TabsTrigger>
            <TabsTrigger value="counseling" className="flex items-center gap-1.5 py-1.5">
              <Users className="w-3.5 h-3.5" />Counseling
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-1.5 py-1.5">
              <MessageSquare className="w-3.5 h-3.5" />Feedback
            </TabsTrigger>
            {isLeader && (
              <TabsTrigger value="inbox" className="flex items-center gap-1.5 py-1.5">
                <Inbox className="w-3.5 h-3.5" />Inbox
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="biblical-message">
          <BiblicalMessageTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="guides">
          <GuidesTab isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="prayer">
          <PrayerTab userId={user?.id} />
        </TabsContent>
        <TabsContent value="counseling">
          <CounselingTab userId={user?.id} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab userId={user?.id} />
        </TabsContent>
        {isLeader && (
          <TabsContent value="inbox">
            <LeaderInboxTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
