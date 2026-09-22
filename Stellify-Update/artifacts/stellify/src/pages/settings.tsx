import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Moon, Sun, KeyRound, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useChangePassword, useUpdateProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const changePassword = useChangePassword();
  const updateProfile = useUpdateProfile();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [accountFields, setAccountFields] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    nickname: user?.nickname ?? "",
  });

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "New password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "New password and confirmation must match.",
      });
      return;
    }
    try {
      await changePassword.mutateAsync({ data: { currentPassword, newPassword } });
      toast({ title: "Password changed", description: "Your password has been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({
        variant: "destructive",
        title: "Change failed",
        description: "Your current password is incorrect.",
      });
    }
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!accountFields.firstName.trim() || !accountFields.lastName.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "First and last name cannot be empty." });
      return;
    }
    try {
      await updateProfile.mutateAsync({
        data: {
          firstName: accountFields.firstName.trim(),
          lastName: accountFields.lastName.trim(),
          nickname: accountFields.nickname.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Account updated", description: "Your display name has been saved." });
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "Could not save account details." });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">Manage your app preferences and appearance.</p>
      </div>

      {/* ─── Appearance ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Stellify looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base">Theme</Label>
            <RadioGroup
              defaultValue={theme}
              onValueChange={(val) => setTheme(val as "light" | "dark")}
              className="grid grid-cols-2 gap-4 max-w-sm"
            >
              <div>
                <RadioGroupItem value="light" id="light" className="peer sr-only" />
                <Label
                  htmlFor="light"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Sun className="mb-3 h-6 w-6" />
                  Light
                </Label>
              </div>
              <div>
                <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                <Label
                  htmlFor="dark"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Moon className="mb-3 h-6 w-6" />
                  Dark
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* ─── Account ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Account
          </CardTitle>
          <CardDescription>Update your display name and nickname.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveAccount} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="acc-firstName">First Name</Label>
              <Input
                id="acc-firstName"
                value={accountFields.firstName}
                onChange={(e) => setAccountFields({ ...accountFields, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-lastName">Last Name</Label>
              <Input
                id="acc-lastName"
                value={accountFields.lastName}
                onChange={(e) => setAccountFields({ ...accountFields, lastName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-nickname">Nickname (optional)</Label>
              <Input
                id="acc-nickname"
                value={accountFields.nickname}
                onChange={(e) => setAccountFields({ ...accountFields, nickname: e.target.value })}
                placeholder="How you'd like to be called"
              />
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ─── Security ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Security
          </CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
