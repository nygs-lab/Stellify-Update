import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, MessageCircle, PartyPopper, CheckCircle, Circle, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetSharingHabits,
  useLogSharingPreparation,
  useLogSharingAttempt,
  useLogBearingResult,
  type SharingPreparation,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek } from "date-fns";

type PrepField = "lessonReviewed" | "scriptPrepared" | "prayedForTarget";

export default function SharingTracker() {
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
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: sharingHabit, isLoading } = useGetSharingHabits({
    query: {
      queryKey: ["/api/sharing-habits"],
    },
  });

  const logPreparation = useLogSharingPreparation();
  const logAttempt = useLogSharingAttempt();
  const logBearing = useLogBearingResult();

  const currentPrep: SharingPreparation | undefined = sharingHabit?.preparations?.find(
    (p) => p.weekStart === weekStart,
  );

  const [attemptOpen, setAttemptOpen] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [sharingMethod, setSharingMethod] = useState("");
  const [attemptResult, setAttemptResult] = useState("");

  const [bearingOpen, setBearingOpen] = useState(false);
  const [believerName, setBelieverName] = useState("");

  async function togglePrep(field: PrepField) {
    const next = {
      weekStart,
      lessonReviewed: currentPrep?.lessonReviewed ?? false,
      scriptPrepared: currentPrep?.scriptPrepared ?? false,
      prayedForTarget: currentPrep?.prayedForTarget ?? false,
      confidenceStatus: currentPrep?.confidenceStatus ?? false,
    };
    next[field] = !next[field];
    try {
      await logPreparation.mutateAsync({ data: next });
      queryClient.invalidateQueries({ queryKey: ["/api/sharing-habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {
      toast({ variant: "destructive", title: "Could not save", description: "Please try again." });
    }
  }

  async function handleAddAttempt() {
    if (!targetName.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Please enter who you shared with." });
      return;
    }
    try {
      await logAttempt.mutateAsync({
        data: {
          attemptDate: today,
          targetName: targetName.trim(),
          sharingMethod: sharingMethod.trim() || null,
          result: attemptResult.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sharing-habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Attempt recorded", description: "Keep sharing the Gospel!" });
      setAttemptOpen(false);
      setTargetName("");
      setSharingMethod("");
      setAttemptResult("");
    } catch {
      toast({ variant: "destructive", title: "Could not save", description: "Please try again." });
    }
  }

  async function handleAddBearing() {
    if (!believerName.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Please enter the new believer's name." });
      return;
    }
    try {
      await logBearing.mutateAsync({
        data: { bearingDate: today, believerName: believerName.trim() },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sharing-habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Praise God!", description: "A new believer has been recorded." });
      setBearingOpen(false);
      setBelieverName("");
    } catch {
      toast({ variant: "destructive", title: "Could not save", description: "Please try again." });
    }
  }

  const prepItems: { field: PrepField; label: string }[] = [
    { field: "lessonReviewed", label: "Lesson Reviewed" },
    { field: "scriptPrepared", label: "Script Prepared" },
    { field: "prayedForTarget", label: "Prayed for Target" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Heart className="h-8 w-8 text-primary" />
          Sharing Habit
        </h1>
        <p className="text-muted-foreground mt-2">Go therefore and make disciples of all nations.</p>
      </div>

      <div className="flex items-center gap-4 py-4 px-6 bg-card rounded-lg border shadow-sm">
        <div className="flex flex-col items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              (sharingHabit?.level ?? 0) >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            1
          </div>
          <span className="text-xs mt-1 font-medium">Preparation</span>
        </div>
        <div className={`h-1 flex-1 ${(sharingHabit?.level ?? 0) >= 2 ? "bg-primary" : "bg-muted"}`}></div>
        <div className="flex flex-col items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              (sharingHabit?.level ?? 0) >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </div>
          <span className="text-xs mt-1 font-medium">Attempt</span>
        </div>
        <div className={`h-1 flex-1 ${(sharingHabit?.level ?? 0) >= 3 ? "bg-primary" : "bg-muted"}`}></div>
        <div className="flex flex-col items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              (sharingHabit?.level ?? 0) >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
          <span className="text-xs mt-1 font-medium">Bearing</span>
        </div>
      </div>

      <Tabs defaultValue="level1" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="level1">Level 1: Preparation</TabsTrigger>
          <TabsTrigger value="level2">Level 2: Attempts</TabsTrigger>
          <TabsTrigger value="level3">Level 3: Bearing</TabsTrigger>
        </TabsList>

        <TabsContent value="level1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Preparation</CardTitle>
              <CardDescription>Prepare your heart and script to share the Gospel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {prepItems.map(({ field, label }) => {
                  const done = currentPrep?.[field] ?? false;
                  return (
                    <div key={field} className="flex items-center justify-between p-3 border rounded-md">
                      <span className="flex items-center gap-2">
                        {done ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                        {label}
                      </span>
                      <Button
                        variant={done ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => togglePrep(field)}
                        disabled={logPreparation.isPending}
                      >
                        {done ? "Completed" : "Mark Complete"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="level2" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sharing Attempts</CardTitle>
                <CardDescription>Record interactions where you shared the Gospel.</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setAttemptOpen(true)}>
                <MessageCircle className="h-4 w-4" /> Add Attempt
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
              ) : (sharingHabit?.attempts?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                  No attempts recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sharingHabit?.attempts?.map((attempt) => (
                    <div key={attempt.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{attempt.targetName}</p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.attemptDate}
                          {attempt.sharingMethod ? ` • ${attempt.sharingMethod}` : ""}
                        </p>
                      </div>
                      {attempt.result && (
                        <span className="text-xs text-muted-foreground italic">{attempt.result}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="level3" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bearing Results</CardTitle>
                <CardDescription>Celebrate souls brought to Christ.</CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={() => setBearingOpen(true)}
              >
                <PartyPopper className="h-4 w-4" /> Add Bearing
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
              ) : (sharingHabit?.bearings?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                  No bearing results yet. Keep praying and sharing!
                </div>
              ) : (
                <div className="space-y-2">
                  {sharingHabit?.bearings?.map((bearing) => (
                    <div key={bearing.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        <PartyPopper className="h-4 w-4 text-yellow-600" />
                        <p className="font-medium">{bearing.believerName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{bearing.bearingDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={attemptOpen} onOpenChange={setAttemptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Sharing Attempt</DialogTitle>
            <DialogDescription>Log an interaction where you shared the Gospel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetName">Who did you share with?</Label>
              <Input
                id="targetName"
                placeholder="Name"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sharingMethod">Method (optional)</Label>
              <Input
                id="sharingMethod"
                placeholder="e.g. One-on-one, Phone call"
                value={sharingMethod}
                onChange={(e) => setSharingMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attemptResult">Result / Notes (optional)</Label>
              <Input
                id="attemptResult"
                placeholder="How did it go?"
                value={attemptResult}
                onChange={(e) => setAttemptResult(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddAttempt} disabled={logAttempt.isPending}>
              {logAttempt.isPending ? "Saving..." : "Save Attempt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bearingOpen} onOpenChange={setBearingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Bearing Result</DialogTitle>
            <DialogDescription>Celebrate a soul brought to Christ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="believerName">New Believer's Name</Label>
              <Input
                id="believerName"
                placeholder="Name"
                value={believerName}
                onChange={(e) => setBelieverName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={handleAddBearing}
              disabled={logBearing.isPending}
            >
              {logBearing.isPending ? "Saving..." : "Record Bearing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
