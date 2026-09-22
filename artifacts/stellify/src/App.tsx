import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";

import Login from "@/pages/login";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import StellarBoard from "@/pages/stellarboard";
import Settings from "@/pages/settings";
import DiscipleHub from "@/pages/disciple/index";
import ChurchHub from "@/pages/church";
import MinistryHub from "@/pages/ministry";
import AdminPanel from "@/pages/admin";
import NotFound from "@/pages/not-found";
import ForceChangePassword from "@/pages/force-change-password";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: any, roles?: string[] }) {
  const { user, isLoading, isAuthenticated, mustChangePassword } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center text-primary">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (mustChangePassword) {
    return <Redirect to="/change-password" />;
  }

  if (roles && user) {
    const primaryRoleAllowed = roles.includes(user.role);
    const ministryRolesAllowed = Array.isArray(user.ministryRoles) && (user.ministryRoles as string[]).some(r => roles.includes(r));
    if (!primaryRoleAllowed && !ministryRolesAllowed) {
      return <Redirect to="/" />;
    }
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/change-password">
        {!isAuthenticated ? <Redirect to="/login" /> : <ForceChangePassword />}
      </Route>
      
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

      <Route path="/profile/:memberId">
        <ProtectedRoute component={Profile} />
      </Route>

      <Route path="/stellarboard">
        <ProtectedRoute component={StellarBoard} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      <Route path="/disciple">
        <ProtectedRoute component={DiscipleHub} />
      </Route>

      <Route path="/disciple/spiritual">
        <Redirect to="/disciple" />
      </Route>

      <Route path="/disciple/personal">
        <Redirect to="/disciple" />
      </Route>

      <Route path="/disciple/sharing">
        <Redirect to="/disciple" />
      </Route>
      
      <Route path="/church">
        <ProtectedRoute component={ChurchHub} />
      </Route>
      
      <Route path="/ministry">
        <ProtectedRoute component={MinistryHub} roles={["Admin", "Pastor", "Servant", "SharingCaptain", "CgAuditor", "ChurchAuditor"]} />
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute component={AdminPanel} roles={["Admin", "Pastor"]} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="stellify-theme">
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppLayout>
                <Router />
              </AppLayout>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
