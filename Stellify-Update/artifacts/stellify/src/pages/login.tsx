import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";
import stellifyLogo from "@assets/Gemini_Generated_Image__(4)_1782094958510.png";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const loginSchema = z.object({
  churchId: z.string().min(1, "Church ID is required").regex(/^(PCM|TCM)\d+$/, "Format must be PCM0001 or TCM0001"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [fpChurchId, setFpChurchId] = useState("");
  const [fpEmail, setFpEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      churchId: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsLoading(true);
      await login(values);
      setLocation("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Invalid church ID or password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function resetForgotState() {
    setResetStep(1);
    setFpChurchId("");
    setFpEmail("");
    setResetToken("");
    setNewPassword("");
  }

  async function handleRequestReset() {
    try {
      const res = await forgotPassword.mutateAsync({ data: { churchId: fpChurchId, email: fpEmail } });
      setResetToken(res.resetToken);
      setResetStep(2);
      toast({ title: "Identity verified", description: "Enter your new password below." });
    } catch {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: "Church ID and email do not match our records.",
      });
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    try {
      await resetPassword.mutateAsync({ data: { resetToken, newPassword } });
      toast({ title: "Password reset", description: "You can now log in with your new password." });
      setForgotOpen(false);
      resetForgotState();
    } catch {
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: "Could not reset password. Please try again.",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
      </Button>

      <Card className="w-full max-w-md border-primary/20 shadow-2xl z-10 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center p-4">
            <img src={stellifyLogo} alt="Stellify" className="w-full h-full object-contain" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-3xl font-serif text-primary">Stellify</CardTitle>
            <CardDescription className="text-sm">A sacred digital home for your spiritual journey</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="churchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Church ID</FormLabel>
                    <FormControl>
                      <Input placeholder="PCM0001" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? "Entering..." : "Enter"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    resetForgotState();
                    setForgotOpen(true);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (!open) resetForgotState();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetStep === 1
                ? "Verify your identity with your Church ID and registered email."
                : "Choose a new password for your account."}
            </DialogDescription>
          </DialogHeader>

          {resetStep === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-churchId">Church ID</Label>
                <Input
                  id="fp-churchId"
                  placeholder="PCM0001"
                  value={fpChurchId}
                  onChange={(e) => setFpChurchId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-email">Registered Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  placeholder="you@example.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-newPassword">New Password</Label>
                <Input
                  id="fp-newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {resetStep === 1 ? (
              <Button
                onClick={handleRequestReset}
                disabled={!fpChurchId || !fpEmail || forgotPassword.isPending}
              >
                {forgotPassword.isPending ? "Verifying..." : "Verify Identity"}
              </Button>
            ) : (
              <Button onClick={handleResetPassword} disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
