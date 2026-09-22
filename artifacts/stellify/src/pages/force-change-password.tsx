import { useState } from "react";
import { useLocation } from "wouter";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

export default function ForceChangePassword() {
  const [, setLocation] = useLocation();
  const { user, logout, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const changePassword = useChangePassword();
  const authQueryKey = ["/api/auth/me", token];

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "New password must be at least 8 characters.",
      });
      return;
    }

    if (newPassword === currentPassword) {
      toast({
        variant: "destructive",
        title: "Same password",
        description: "Your new password must be different from your current password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Please make sure both new password fields match.",
      });
      return;
    }

    try {
      await changePassword.mutateAsync({ data: { currentPassword, newPassword } });

      queryClient.setQueryData(authQueryKey, (old: any) =>
        old ? { ...old, mustChangePassword: false } : old
      );

      toast({
        title: "Password changed",
        description: "Your password has been updated. Welcome to Stellify!",
      });

      setLocation("/");
    } catch {
      toast({
        variant: "destructive",
        title: "Could not change password",
        description: "Please check your current password and try again.",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md border-primary/20 shadow-2xl z-10 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif text-primary">Set Your Password</CardTitle>
            <CardDescription className="mt-1">
              Welcome, {user?.firstName}! For your security, please create a personal password before continuing.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input
                id="current"
                type="password"
                placeholder="Your current default password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
            >
              {changePassword.isPending ? "Saving..." : "Set Password & Continue"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => logout()}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Sign out instead
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
