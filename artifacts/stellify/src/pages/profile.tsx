import { useRef, useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useUpdateProfile,
  useUpdateMember,
  useGetMember,
  getGetMemberQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Lock, Camera, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFile, objectPathToUrl } from "@/lib/storage";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  nickname: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  contactNumber: z.string().optional().nullable(),
  foodPreferences: z.string().optional().nullable(),
  medicalCondition: z.string().optional().nullable(),
  bloodType: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelationship: z.string().optional().nullable(),
  emergencyContactNumber: z.string().optional().nullable(),
});

export default function Profile() {
  // ── All hooks unconditionally declared first ──────────────────────────────
  const { user, token } = useAuth();
  const { memberId: memberIdParam } = useParams<{ memberId?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const updateMember = useUpdateMember();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const targetMemberId = memberIdParam ? parseInt(memberIdParam, 10) : undefined;
  const isAdmin = user?.role === "Admin";

  // Ownership check: own profile if no memberId param OR param matches logged-in user's id
  const isOwnProfile = !targetMemberId || targetMemberId === user?.id;
  // Access gate: non-admin users cannot view other members' profiles
  const isUnauthorized = !!targetMemberId && !isOwnProfile && !isAdmin;

  // useEffect-based redirect so all hooks above are always called (Rules of Hooks)
  useEffect(() => {
    if (isUnauthorized) navigate("/");
  }, [isUnauthorized, navigate]);

  // Fetch another member's data — enabled only when admin is viewing a different member
  const { data: fetchedMember, isLoading: memberLoading } = useGetMember(
    targetMemberId ?? 0,
    {
      query: {
        queryKey: getGetMemberQueryKey(targetMemberId ?? 0),
        enabled: !!targetMemberId && !isOwnProfile && isAdmin,
      },
    },
  );

  // Resolve the displayed member data
  const profileData = isOwnProfile ? user : fetchedMember;

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: profileData?.firstName || "",
      lastName: profileData?.lastName || "",
      nickname: profileData?.nickname || "",
      email: profileData?.email || "",
      contactNumber: profileData?.contactNumber || "",
      foodPreferences: profileData?.foodPreferences || "",
      medicalCondition: profileData?.medicalCondition || "",
      bloodType: profileData?.bloodType || "",
      emergencyContactName: profileData?.emergencyContactName || "",
      emergencyContactRelationship: profileData?.emergencyContactRelationship || "",
      emergencyContactNumber: profileData?.emergencyContactNumber || "",
    },
  });
  // ── End of hooks section ──────────────────────────────────────────────────

  // Photo upload is available to the member themselves and to Admins
  const canEditPhoto = isOwnProfile || isAdmin;
  // Only admin or the member themselves can edit profile details
  const canEditDetails = isOwnProfile || isAdmin;
  const isPending = updateProfile.isPending || updateMember.isPending;
  const initials = `${profileData?.firstName?.[0] ?? ""}${profileData?.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  async function onSubmit(values: z.infer<typeof profileSchema>) {
    try {
      if (isOwnProfile) {
        await updateProfile.mutateAsync({ data: values });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me", token] });
      } else if (isAdmin && targetMemberId) {
        await updateMember.mutateAsync({ id: targetMemberId, data: values });
        queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(targetMemberId) });
      }
      toast({ title: "Profile updated", description: "Profile has been successfully updated." });
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "There was a problem updating the profile." });
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const objectPath = await uploadFile(file);
      if (isOwnProfile) {
        await updateProfile.mutateAsync({ data: { profilePicture: objectPath } });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me", token] });
      } else if (isAdmin && targetMemberId) {
        await updateMember.mutateAsync({ id: targetMemberId, data: { profilePicture: objectPath } });
        queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(targetMemberId) });
      }
      toast({ title: "Photo updated", description: "Profile picture has been updated." });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "There was a problem uploading the photo." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Render guards (after all hooks have been called)
  if (isUnauthorized) return null;

  if (!isOwnProfile && memberLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading member profile…</div>;
  }

  if (!isOwnProfile && !fetchedMember) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Member not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-3">
        {!isOwnProfile && (
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {isOwnProfile ? "My Profile" : `${profileData?.firstName ?? ""} ${profileData?.lastName ?? ""}`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isOwnProfile
              ? "Manage your personal information and contact details."
              : `Viewing ${profileData?.churchId ?? ""} — Admin view`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-primary/20 bg-card/50">
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <Avatar className="h-28 w-28 border-2 border-primary/30">
                <AvatarImage
                  src={objectPathToUrl(profileData?.profilePicture)}
                  alt={`${profileData?.firstName ?? ""} ${profileData?.lastName ?? ""}`}
                />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              {/* Photo upload: visible to the member themselves (isOwnProfile) or Admins (isAdmin) */}
              {canEditPhoto && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Change Photo"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50">
            <CardHeader>
              <CardTitle>Church Information</CardTitle>
              <CardDescription>Read-only official records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Church ID
                </p>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{profileData?.churchId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Role
                </p>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{profileData?.role}</p>
              </div>
              {/* Stellar Status: always read-only plain text for all users.
                  Changes go through the Admin → Pastor approval workflow. */}
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Stellar Status
                </p>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{profileData?.stellarStatus}</p>
                {(profileData as any)?.pendingStellarStatus && (
                  <p className="text-xs text-amber-600 mt-1">
                    Pending approval: {(profileData as any).pendingStellarStatus}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground/70 italic mt-4">
                {isOwnProfile
                  ? "To update this, please contact Church IT or your Care Group Servant."
                  : "Status changes are submitted via the Admin → Manage Members tab."}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nickname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nickname</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Number</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4">Health & Emergency</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bloodType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Blood Type</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="medicalCondition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medical Conditions</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} placeholder="None" disabled={!canEditDetails} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="foodPreferences"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Food Preferences / Allergies</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Contact Name</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Contact Number</FormLabel>
                            <FormControl><Input {...field} value={field.value || ""} disabled={!canEditDetails} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {canEditDetails && (
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
